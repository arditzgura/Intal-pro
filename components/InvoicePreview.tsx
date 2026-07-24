
import React, { useState, useEffect, useRef } from 'react';
import { Invoice, Client, BusinessConfig } from '../types';
import { X, Printer, FileCheck, Loader2, Star, Image as ImageIcon, Instagram, MapPin, Coins, Send, Pencil, Save, RotateCcw } from 'lucide-react';

interface Props {
  invoice: Invoice;
  business: BusinessConfig;
  client?: Client;
  onClose: () => void;
  onEdit: (invoice: Invoice) => void;
  onSave?: (invoice: Invoice) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const formatTime = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('T')) return new Date().toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return "00:00"; }
};

// Çmim me vizë — pa transform (html2canvas nuk i renderron transform saktë)
const StrikePrice = ({ orig, curr, style }: { orig: number; curr: string; style?: React.CSSProperties }) => (
  <span style={{ position: 'relative', display: 'inline-block', color: '#94a3b8', marginRight: '4px', lineHeight: 1.3, ...style }}>
    {orig.toLocaleString()} {curr}
    <span style={{ position: 'absolute', left: 0, right: 0, top: '42%', height: '1.5px', background: '#94a3b8', display: 'block' }} />
  </span>
);

const InvoicePreview: React.FC<Props> = ({ invoice, business, client, onClose, onEdit, onSave }) => {
  const [isPngExporting,  setIsPngExporting]  = useState(false);
  const [isPdfExporting,  setIsPdfExporting]  = useState(false);
  const [isSharing,       setIsSharing]       = useState(false);
  const [editMode,        setEditMode]        = useState(false);
  const [draft,           setDraft]           = useState<Invoice>(invoice);
  const [invoiceZoom,     setInvoiceZoom]     = useState(1);
  const scaleWrapRef = useRef<HTMLDivElement>(null);
  const clientFileName = invoice.clientName.trim().replace(/\s+/g, '_');

  // Lejo zoom-in/out me touch kur preview është hapur
  useEffect(() => {
    const vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const original = vp?.content || '';
    if (vp) vp.content = 'width=device-width, initial-scale=1.0';
    return () => { if (vp) vp.content = original; };
  }, []);

  // Shkallëzo faturën që të përshtahet me gjerësinë e ekranit
  useEffect(() => {
    const update = () => {
      if (!scaleWrapRef.current) return;
      const containerW = scaleWrapRef.current.offsetWidth;
      const invoiceW = 794; // 210mm @ 96dpi
      setInvoiceZoom(Math.min(1, containerW / invoiceW));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const enterEdit = () => { setDraft(invoice); setEditMode(true); };
  const cancelEdit = () => { setDraft(invoice); setEditMode(false); };

  const updateDraftItem = (idx: number, field: 'quantity' | 'price' | 'name', val: string | number) => {
    const newItems = draft.items.map((it, i) => {
      if (i !== idx) return it;
      const q = field === 'quantity' ? Number(val) : it.quantity;
      const p = field === 'price'    ? Number(val) : it.price;
      const n = field === 'name'     ? String(val) : it.name;
      return { ...it, name: n, quantity: q, price: p, total: q * p };
    });
    const newSubtotal = newItems.reduce((s, it) => s + it.total, 0);
    setDraft(d => ({ ...d, items: newItems, subtotal: newSubtotal, total: newSubtotal }));
  };

  const handleSaveDraft = () => {
    const balDue = draft.subtotal + (draft.previousBalance || 0) - (draft.amountPaid || 0);
    const status = balDue <= 0 ? 'E paguar' as const : 'Pa paguar' as const;
    const saved: Invoice = { ...draft, status };
    onSave?.(saved);
    setEditMode(false);
  };

  const inv = editMode ? draft : invoice;

  // ── Hap print preview (A4 ose 80mm) ──────────────────────────────────────
  const handlePrint = async (format: 'A4' | '80mm') => {
    document.body.classList.remove('format-80mm');

    let styleEl = document.getElementById('print-page-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'print-page-style';
      document.head.appendChild(styleEl);
    }

    const tw = business.thermalWidth ?? 80;

    if (format === '80mm') {
      styleEl.textContent = `@page { size: ${tw}mm auto !important; margin: 2mm !important; }`;
      document.body.classList.add('format-80mm');
    } else {
      styleEl.textContent = '@page { size: A4 portrait; margin: 0; }';
    }

    // Prit rirenderin e DOM
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 400));

    const eAPI = (window as any).electronAPI;
    if (eAPI?.printWithDialog) {
      const opts: any = { silent: false, printBackground: true };
      if (format === '80mm') {
        const rollEl = document.querySelector<HTMLElement>('.roll-only');
        const h = rollEl ? Math.ceil(rollEl.scrollHeight * 0.2646) + 10 : 400;
        opts.pageSize = { width: tw * 1000, height: Math.max(h, 100) * 1000 };
      } else {
        opts.pageSize = 'A4';
      }
      await eAPI.printWithDialog(opts);
    } else {
      window.print();
    }

    setTimeout(() => {
      document.body.classList.remove('format-80mm');
      if (styleEl) styleEl.textContent = '';
    }, 2000);
  };

  // ── PNG → ruaj në Desktop ─────────────────────────────────────────────────
  const exportPNG = async () => {
    if (isPngExporting) return;
    setIsPngExporting(true);
    try {
      const blob = await captureInvoiceBlob();
      if (!blob) return;
      const fileName = clientFileName + '_fatura.png';
      const eAPI = (window as any).electronAPI;
      if (eAPI?.saveToDesktop) {
        const ab = await blob.arrayBuffer();
        await eAPI.saveToDesktop(Array.from(new Uint8Array(ab)), fileName);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } finally { setIsPngExporting(false); }
  };

  // ── PDF → ruaj në Desktop ─────────────────────────────────────────────────
  const exportPDF = async () => {
    if (isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      const fileName = clientFileName + '_fatura.pdf';
      const eAPI = (window as any).electronAPI;
      if (eAPI?.savePdf) {
        // Electron: printToPDF → ruaj në Desktop
        // Ngarko PDF nëpërmjet html2pdf dhe kalo buffer-in
        const element = document.getElementById('invoice-printable');
        if (!element) return;
        const opt = {
          margin: 0,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, onclone: (doc: any) => {
            const el = doc.getElementById('invoice-printable');
            if (el) { el.style.transform = 'none'; el.style.boxShadow = 'none'; if (el.parentElement) el.parentElement.style.zoom = '1'; }
          }},
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          outputType: 'blob',
        };
        // @ts-ignore
        const pdfBlob: Blob = await html2pdf().set(opt).from(element).outputPdf('blob');
        const ab = await pdfBlob.arrayBuffer();
        await eAPI.savePdf(Array.from(new Uint8Array(ab)), fileName);
      } else {
        // Browser fallback
        const element = document.getElementById('invoice-printable');
        if (!element) return;
        const opt = {
          margin: 0, filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, onclone: (doc: any) => {
            const el = doc.getElementById('invoice-printable');
            if (el) { el.style.transform = 'none'; if (el.parentElement) el.parentElement.style.zoom = '1'; }
          }},
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };
        // @ts-ignore
        await html2pdf().set(opt).from(element).save();
      }
    } finally { setIsPdfExporting(false); }
  };

  // ── WhatsApp → hap Share dialog me PNG ───────────────────────────────────
  const sendWhatsApp = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const blob = await captureInvoiceBlob();
      if (!blob) return;
      const fileName = clientFileName + '_fatura.png';
      const eAPI = (window as any).electronAPI;
      if (eAPI?.shareImage) {
        const ab = await blob.arrayBuffer();
        await eAPI.shareImage(Array.from(new Uint8Array(ab)), fileName);
      } else {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally { setIsSharing(false); }
  };

  const balanceDue = (inv.subtotal + (inv.previousBalance || 0)) - (inv.amountPaid || 0);
  const isSurplus = balanceDue < 0;
  const isPaidInFull = balanceDue <= 0;

  const getCurrency = (type: 'short' | 'full' = 'full') => {
    if (inv.currency === 'EUR') return type === 'short' ? '€' : 'EURO';
    return type === 'short' ? 'L' : 'Lekë';
  };

  // Kap PNG direkt nga elementi — DOM pa scale, pa lëvizje
  const captureInvoiceBlob = async (): Promise<Blob | null> => {
    const source = document.getElementById('invoice-printable');
    if (!source) return null;

    // Prit font-et të ngarkohen plotësisht
    await document.fonts.ready;

    // @ts-ignore
    const canvas = await html2canvas(source, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
      // windowWidth: 1280 → Tailwind aplikon lg:scale-100 (transform:scale(1) = asgjë)
      windowWidth: 1280,
      onclone: (clonedDoc: Document) => {
        const el = clonedDoc.getElementById('invoice-printable');
        if (!el) return;

        // Hiq vetëm transform/boxShadow inline — mos prek className (Tailwind duhet)
        el.style.transform = 'none';
        el.style.boxShadow = 'none';

        // Wrapper: hiq vetëm transform/zoom inline, jo className
        const wrap = el.parentElement;
        if (wrap) {
          wrap.style.transform = 'none';
          wrap.style.zoom = '1';
          wrap.style.margin = '0';
        }

        // A4 të jenë visible, 80mm të fshihen
        el.querySelectorAll<HTMLElement>('.roll-only').forEach(e => (e.style.display = 'none'));
        el.querySelectorAll<HTMLElement>('.roll-hide').forEach(e => (e.style.display = 'flex'));
      },
    });

    return new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
  };

  const displayCity = inv.clientCity || client?.city || 'TIRANË';

  // Label-et e editueshmë
  const lArt = business.labelArtikulli  ?? 'ARTIKULLI';
  const lSas = business.labelSasia      ?? 'SASIA';
  const lCmi = business.labelCmimi      ?? 'ÇMIMI';
  const lTot = business.labelTotali     ?? 'TOTALI';
  const lNen = business.labelNentotali  ?? 'NËNTOTALI';
  const lGje = business.labelGjendja    ?? 'GJENDJA';
  const lPag = business.labelPaguar     ?? 'PAGUAR';
  const lDet = business.labelDetyrimi   ?? 'DETYRIMI';
  const lTep = business.labelTeprica    ?? 'TEPRICA';
  const lFat = business.labelFature     ?? 'FATURË';
  const lKli = business.labelKlienti    ?? 'KLIENTI';
  const lFal = business.labelFaleminderit ?? 'FALEMINDERIT QË NA BESUAT!';

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[300] flex flex-col items-center overflow-y-auto py-10 px-4"
         onClick={onClose}>
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[310] print:hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-white p-2 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={handleSaveDraft} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all active:scale-95"><Save size={16}/> Ruaj</button>
              <button onClick={cancelEdit} className="bg-amber-50 border border-amber-300 text-amber-700 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-amber-100 transition-all"><RotateCcw size={14}/> Anulo</button>
            </>
          ) : (
            <>
              <button onClick={exportPNG}  className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all">{isPngExporting ? <Loader2 size={16} className="animate-spin"/> : <ImageIcon size={16}/>} PNG</button>
              <button onClick={exportPDF}  className="bg-[#D81B60] text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#AD1457] transition-all">{isPdfExporting ? <Loader2 size={16} className="animate-spin"/> : <FileCheck size={16}/>} PDF</button>
              <button onClick={sendWhatsApp} className="bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#1da851] transition-all">{isSharing ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} WhatsApp</button>
              <button onClick={() => handlePrint('A4')}   className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all"><Printer size={16}/> A4</button>
              <button onClick={() => handlePrint('80mm')} className="bg-slate-100 text-slate-800 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all"><Printer size={16}/> 80MM</button>
              {onSave && <><div className="w-px h-6 bg-slate-200 mx-1"></div><button onClick={enterEdit} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all"><Pencil size={14}/> Edit</button></>}
            </>
          )}
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-900 rounded-xl transition-all"><X size={24} /></button>
        </div>
      </div>

      <div ref={scaleWrapRef} className="mt-16 print:mt-0 w-full" onClick={e => e.stopPropagation()}>
        <div style={{ zoom: invoiceZoom }} className="print:zoom-[1]">
        <div id="invoice-printable" className="bg-white shadow-2xl print:shadow-none flex flex-col" style={{ width: '210mm', minHeight: '297mm', padding: '10mm 15mm', position: 'relative', boxSizing: 'border-box', overflow: 'hidden' }}>
          
          {/* Watermark */}
          {business.watermarkUrl && (
            <div style={{
              position: 'absolute',
              left: `${business.watermarkX ?? 50}%`,
              top: `${business.watermarkY ?? 50}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}>
              <img src={business.watermarkUrl} alt="" style={{ width: `${(business.watermarkSize ?? 60) * 1.98}px`, maxWidth: 'calc(210mm - 30mm)', opacity: (business.watermarkOpacity ?? 20) / 100, objectFit: 'contain', display: 'block' }} />
            </div>
          )}

          {/* FORMATI A4 */}
          <div className="roll-hide flex-1 flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  {business.logoUrl ? <img src={business.logoUrl} alt="Logo" className="h-16 object-contain" /> : <><span className="text-4xl font-black text-[#D81B60] tracking-tighter italic leading-none">INTAL<sup className="text-xs">®</sup></span><span className="text-[8px] font-black text-slate-900 uppercase tracking-[0.2em] mt-0.5 ml-0.5">ALBANIAN UNDERWEAR</span></>}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black text-[#D81B60] uppercase tracking-widest">{business.slogan || 'CILËSIA ËSHTË PRIORITETI YNË'}</p>
                  <p className="text-[8px] font-bold text-slate-700 uppercase leading-none">{business.address}</p>
                  <p className="text-[8px] font-bold text-slate-700 leading-none">Tel: {business.phone}</p>
                  {business.website && <p className="text-[8px] font-bold text-slate-700 leading-none">{business.website}</p>}
                </div>
              </div>
              <div className="relative flex flex-col items-end pt-2">
                <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tight mb-1 z-20 relative px-2 bg-white/80">{lFat}</h1>
                <div className="w-44 py-2 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-sm z-10">
                  {editMode
                    ? <input className="text-xs font-black text-slate-900 text-center bg-white border border-indigo-300 rounded px-2 py-0.5 w-32 outline-none" value={draft.invoiceNumber} onChange={e => setDraft(d => ({...d, invoiceNumber: e.target.value}))} />
                    : <span className="text-xs font-black text-slate-900">NR. {inv.invoiceNumber}</span>
                  }
                  <div className="flex flex-col items-center">
                    {editMode
                      ? <input type="date" className="text-[10px] font-black text-indigo-600 bg-white border border-indigo-300 rounded px-1 py-0.5 outline-none mt-0.5" value={draft.date.split('T')[0]} onChange={e => setDraft(d => ({...d, date: e.target.value + 'T00:00:00'}))} />
                      : <><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DATA: {formatDate(inv.date)}</span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ORA: {formatTime(inv.date)}</span></>
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[8px] font-black text-[#D81B60] uppercase tracking-widest mb-1">{lKli}:</p>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{invoice.clientName}</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mt-1">{displayCity}</p>
              </div>
              <div className="flex flex-col items-end gap-2 mt-0">
                <div className={`p-2 rounded-xl w-40 text-center border ${isSurplus ? 'bg-amber-50 border-amber-100' : isPaidInFull ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isSurplus ? 'text-amber-600' : isPaidInFull ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isSurplus ? lTep : lDet}
                  </p>
                  <p className={`text-[15px] font-black leading-none ${isSurplus ? 'text-amber-600' : isPaidInFull ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {Math.abs(balanceDue).toLocaleString()} {inv.currency === 'EUR' ? 'EURO' : 'LEKË'}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-1.5 rounded-xl w-40 text-center flex items-center justify-center gap-1">
                  <Star size={10} className="text-amber-500" fill="currentColor" />
                  <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest">PIKËT: <span className="text-slate-900">{client?.points || 0}</span></p>
                </div>
              </div>
            </div>

            <div className="flex-1 mt-1">
              {(() => {
                const tpl = business.invoiceTemplate || 1;
                const fsNum = business.itemFontSize || 10;
                const fs = `${fsNum}px`;
                const fsSub = `${fsNum - 1}px`;
                const ff = business.itemFont || 'Inter, sans-serif';
                const items = inv.items;

                const editInput = (idx: number, field: 'quantity'|'price', val: number) => (
                  <input
                    type="number" min="0" step="any"
                    defaultValue={val}
                    onBlur={e => updateDraftItem(idx, field, e.target.value)}
                    style={{ width: field === 'quantity' ? '50px' : '70px', border: '1px solid #a5b4fc', borderRadius: '4px', padding: '1px 4px', fontWeight: 900, fontSize: fs, fontFamily: ff, textAlign: 'center', outline: 'none', background: '#eef2ff' }}
                  />
                );

                if (tpl === 1) return (
                  <table className="w-full border-collapse">
                    <thead><tr style={{ background: '#0F172A', color: '#fff', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}><th style={{ padding: '5px 12px', textAlign: 'left', width: '50%' }}>{lArt}</th><th style={{ padding: '5px 8px', textAlign: 'center' }}>{lSas}</th><th style={{ padding: '5px 12px', textAlign: 'center' }}>{lCmi}</th><th style={{ padding: '5px 12px', textAlign: 'right' }}>{lTot}</th></tr></thead>
                    <tbody style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 12px', fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b' }}>{item.name}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#475569' }}>{editMode ? editInput(i,'quantity',item.quantity) : item.quantity}</td>
                          {item.originalPrice && item.originalPrice !== item.price
                            ? <td style={{ padding: '5px 12px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#475569' }}><StrikePrice orig={item.originalPrice!} curr={getCurrency('short')} /><span style={{fontWeight:900}}>{editMode ? editInput(i,'price',item.price) : <>{item.price.toLocaleString()} {getCurrency('short')}</>}</span></td>
                            : <td style={{ padding: '5px 12px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#475569' }}>{editMode ? editInput(i,'price',item.price) : <>{item.price.toLocaleString()} {getCurrency('short')}</>}</td>
                          }
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#0f172a' }}>{item.total.toLocaleString()} {getCurrency('short')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );

                if (tpl === 2) return (
                  <table className="w-full border-collapse">
                    <thead><tr style={{ background: '#e2e8f0', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}><th style={{ padding: '3px 8px', textAlign: 'left', width: '50%' }}>{lArt}</th><th style={{ padding: '3px 6px', textAlign: 'center' }}>{lSas}</th><th style={{ padding: '3px 8px', textAlign: 'center' }}>{lCmi}</th><th style={{ padding: '3px 8px', textAlign: 'right' }}>{lTot}</th></tr></thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                          <td style={{ padding: '2px 8px', fontSize: fs, fontFamily: ff, fontWeight: 700, textTransform: 'uppercase', color: '#334155', lineHeight: 1.2 }}>{item.name}</td>
                          <td style={{ padding: '2px 6px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 700, color: '#64748b' }}>{item.quantity}</td>
                          {item.originalPrice && item.originalPrice !== item.price
                            ? <td style={{ padding: '2px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 700, color: '#64748b' }}><StrikePrice orig={item.originalPrice!} curr={getCurrency('short')} /><span style={{fontWeight:700}}>{item.price.toLocaleString()} {getCurrency('short')}</span></td>
                            : <td style={{ padding: '2px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 700, color: '#64748b' }}>{item.price.toLocaleString()} {getCurrency('short')}</td>
                          }
                          <td style={{ padding: '2px 8px', textAlign: 'right', fontSize: fs, fontFamily: ff, fontWeight: 700, color: '#0f172a' }}>{item.total.toLocaleString()} {getCurrency('short')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );

                if (tpl === 3) return (
                  <div style={{ borderTop: '1px solid #e2e8f0' }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ borderBottom: '1px solid #f1f5f9', padding: '4px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', lineHeight: 1.2 }}>{item.name}</div>
                          <div style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#64748b', marginTop: '1px' }}>
                            {item.quantity} × {item.originalPrice && item.originalPrice !== item.price
                              ? <><StrikePrice orig={item.originalPrice!} curr="" style={{ marginRight:'2px' }} /><span style={{fontWeight:900,color:'#475569'}}>{item.price.toLocaleString()}</span></>
                              : item.price.toLocaleString()
                            } {getCurrency('short')}
                          </div>
                        </div>
                        <div style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{item.total.toLocaleString()} {getCurrency('short')}</div>
                      </div>
                    ))}
                  </div>
                );

                if (tpl === 4) return (
                  <table className="w-full border-collapse">
                    <thead><tr style={{ background: '#0F172A', color: '#fff', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}><th style={{ padding: '5px 12px', textAlign: 'left', width: '50%' }}>{lArt}</th><th style={{ padding: '5px 8px', textAlign: 'center' }}>{lSas}</th><th style={{ padding: '5px 12px', textAlign: 'center' }}>{lCmi}</th><th style={{ padding: '5px 12px', textAlign: 'right' }}>{lTot}</th></tr></thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                          <td style={{ padding: '5px 12px', fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b' }}>{item.name}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#475569' }}>{item.quantity}</td>
                          {item.originalPrice && item.originalPrice !== item.price
                            ? <td style={{ padding: '5px 12px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#475569' }}><StrikePrice orig={item.originalPrice!} curr={getCurrency('short')} /><span style={{fontWeight:900}}>{item.price.toLocaleString()} {getCurrency('short')}</span></td>
                            : <td style={{ padding: '5px 12px', textAlign: 'center', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#475569' }}>{item.price.toLocaleString()} {getCurrency('short')}</td>
                          }
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#0f172a' }}>{item.total.toLocaleString()} {getCurrency('short')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );

                // tpl === 5: Modern
                return (
                  <div>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid #4f46e5', paddingLeft: '8px', marginBottom: '4px', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b' }}>{item.name}</span>
                          <span style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#64748b', marginLeft: '6px' }}>
                            {item.quantity} × {item.originalPrice && item.originalPrice !== item.price
                              ? <><StrikePrice orig={item.originalPrice!} curr="" style={{ marginRight:'2px' }} /><span style={{fontWeight:900,color:'#4f46e5'}}>{item.price.toLocaleString()}</span></>
                              : item.price.toLocaleString()
                            }
                          </span>
                        </div>
                        <span style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#4f46e5', whiteSpace: 'nowrap' }}>{item.total.toLocaleString()} {getCurrency('short')}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="mt-4">
              <div className="flex justify-between items-end mb-4 gap-10">
                <div className="flex-1 self-start">
                   {editMode
                     ? <div className="bg-slate-50 p-4 rounded-2xl border border-indigo-200 max-w-sm"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SHËNIME:</p><textarea rows={3} className="w-full text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none resize-none" value={draft.notes || ''} onChange={e => setDraft(d => ({...d, notes: e.target.value || undefined}))} /></div>
                     : inv.notes && (<div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-sm"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SHËNIME:</p><p className="text-[10px] font-bold text-slate-700 whitespace-pre-wrap leading-relaxed italic">{inv.notes}</p></div>)
                   }
                   <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center gap-1.5"><Instagram size={14} className="text-slate-900" /><p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">@INTALALBANIA</p></div>
                      {business.qrCodeUrl && (
                        <div className="bg-white p-1 border border-slate-100 rounded-lg shadow-sm">
                          <img src={business.qrCodeUrl} alt="QR Code" className="h-12 w-12 object-contain grayscale" />
                        </div>
                      )}
                   </div>
                </div>
                <div className="w-64 bg-white border-2 border-slate-900 rounded-[20px] overflow-hidden">
                   <div className="p-3 space-y-1.5">
                      <div className="flex justify-between items-center text-slate-400 text-[11px] font-black uppercase tracking-widest"><span>{lNen}:</span><span className="text-slate-900 text-[13px]">{inv.subtotal.toLocaleString()} {getCurrency('short')}</span></div>
                      {(inv.previousBalance !== 0 || editMode) && (
                        <div className="flex justify-between items-center text-amber-600 text-[11px] font-black uppercase tracking-widest">
                          <span>{inv.previousBalanceLabel?.replace(/\(\+\)/g, '').trim() || lGje}:</span>
                          {editMode
                            ? <input type="number" step="any" defaultValue={draft.previousBalance || 0} onBlur={e => setDraft(d => ({...d, previousBalance: Number(e.target.value)}))} className="w-24 text-right border border-amber-300 rounded px-1 py-0.5 text-[11px] font-black bg-amber-50 outline-none" />
                            : <span className="text-[13px]">{inv.previousBalance.toLocaleString()} {getCurrency('short')}</span>
                          }
                        </div>
                      )}
                      {(inv.amountPaid !== 0 || editMode) && (
                        <div className="flex justify-between items-center text-blue-600 text-[11px] font-black uppercase tracking-widest">
                          <span>{inv.amountPaidLabel?.replace(/\(\-\)/g, '').trim() || lPag}:</span>
                          {editMode
                            ? <input type="number" step="any" defaultValue={draft.amountPaid || 0} onBlur={e => setDraft(d => ({...d, amountPaid: Number(e.target.value)}))} className="w-24 text-right border border-blue-300 rounded px-1 py-0.5 text-[11px] font-black bg-blue-50 outline-none" />
                            : <span className="text-[13px]">- {inv.amountPaid.toLocaleString()} {getCurrency('short')}</span>
                          }
                        </div>
                      )}
                      {editMode && (
                        <div className="flex justify-between items-center text-emerald-600 text-[11px] font-black uppercase tracking-widest">
                          <span>DATA PAGESËS:</span>
                          <input type="date" value={draft.paymentDate || ''} onChange={e => setDraft(d => ({...d, paymentDate: e.target.value || undefined}))} className="border border-emerald-300 rounded px-1 py-0.5 text-[10px] font-black bg-emerald-50 outline-none" />
                        </div>
                      )}
                   </div>
                   <div className={`p-3 flex justify-between items-center border-t border-slate-900 ${isSurplus ? 'bg-amber-50' : isPaidInFull ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">{isSurplus ? `${lTep}:` : `${lDet}:`}</span>
                      <span className={`text-2xl font-black tracking-tighter ${isSurplus ? 'text-amber-600' : isPaidInFull ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Math.abs(balanceDue).toLocaleString()} {inv.currency === 'EUR' ? 'EURO' : 'LEKË'}
                      </span>
                   </div>
                </div>
              </div>
              <div className="text-center pt-3 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-0.5">{lFal}</p>
                <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-lg mx-auto">RAPORTI I BESNIKËRISË: BLERJET GRUMBULLOJNË PIKË QË MUND TË PËRDOREN SI ZBRITJE NË TË ARDHMEN.</p>
              </div>
            </div>
          </div>
          
          {/* FORMATI 80MM (PRINTER THERMAL) - Përditësuar me +2pt font dhe layout të ri */}
          <div className="roll-only" style={{ width: '100%', padding: '0', color: '#000', fontFamily: 'Inter, sans-serif' }}>

             <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                <h2 style={{ fontSize: '18pt', margin: '0', fontWeight: '900', textTransform: 'uppercase', lineHeight: '1' }}>{business.name}</h2>
                <div style={{ fontSize: '10pt', margin: '2px 0', lineHeight: '1.1' }}>{business.address}</div>
                <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>Tel: {business.phone}</div>
                {business.website && <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{business.website}</div>}
             </div>
             
             <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
             
             <div style={{ fontSize: '11pt', marginBottom: '1px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>FATURË NR:</span>
                <span style={{ fontWeight: 'bold' }}>#{invoice.invoiceNumber}</span>
             </div>
             <div style={{ fontSize: '11pt', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>DATA:</span>
                <span>{formatDate(invoice.date)}</span>
             </div>
             
             {/* Kuadrat i vetëm për Klientin dhe Pikët: Emri dhe Qyteti paralel brenda tij */}
             <div style={{ display: 'flex', border: '2px solid #000', marginBottom: '4px', overflow: 'hidden' }}>
                {/* Majtas: Klienti (Emri BOLD dhe Qyteti në krah me të njëjtën madhësi pa bold) */}
                <div style={{ flex: '2.5', padding: '5px', display: 'flex', flexDirection: 'column', borderRight: '2px solid #000' }}>
                    <span style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', opacity: 0.8, marginBottom: '2px' }}>KLIENTI</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap' }}>
                       <span style={{ fontSize: '12pt', fontWeight: '900', textTransform: 'uppercase', lineHeight: '1' }}>{invoice.clientName}</span>
                       <span style={{ fontSize: '12pt', fontWeight: 'normal', textTransform: 'uppercase', opacity: 0.85 }}>({displayCity})</span>
                    </div>
                </div>
                
                {/* Djathtas: Pikët - vetëm për klientë të regjistruar */}
                {client && invoice.clientId !== 'manual' && (
                <div style={{ flex: '1', padding: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#f8f8f8' }}>
                    <span style={{ fontSize: '8pt', fontWeight: '900', textTransform: 'uppercase', opacity: 0.8, marginBottom: '2px' }}>PIKËT</span>
                    <span style={{ fontSize: '16pt', fontWeight: '900', lineHeight: '1' }}>{client.points || 0}</span>
                </div>
                )}
             </div>
             
             <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
             
             {/* Lista e Artikujve 80mm - Hapësira minimale dhe +2pt shkrim */}
             <div style={{ marginBottom: '4px' }}>
                {invoice.items.map((item, i) => (
                  <div key={i} style={{ marginBottom: '2px', borderBottom: '0.2px solid #eee' }}>
                    <div style={{ fontSize: '12.5pt', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: '1' }}>{item.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5pt', paddingLeft: '2px', marginTop: '1px' }}>
                      <span>{item.quantity} x {item.originalPrice && item.originalPrice !== item.price
                        ? <><StrikePrice orig={item.originalPrice!} curr="" style={{ marginRight:'2px', opacity:0.7 }} /><strong>{item.price.toLocaleString()}</strong></>
                        : item.price.toLocaleString()
                      }</span>
                      <span style={{ fontWeight: 'bold' }}>{item.total.toLocaleString()} {getCurrency('short')}</span>
                    </div>
                  </div>
                ))}
             </div>
             
             <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
             
             {/* Totali 80mm - +2pt shkrim */}
             <div style={{ lineHeight: '1.3' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt' }}>
                   <span>NËNTOTALI:</span>
                   <span>{invoice.subtotal.toLocaleString()} {getCurrency('short')}</span>
                </div>
                {invoice.previousBalance !== 0 && (
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt' }}>
                      <span>{invoice.previousBalanceLabel?.replace(/\(\+\)/g, '').trim() || 'GJENDJA'}:</span>
                      <span>{invoice.previousBalance.toLocaleString()} {getCurrency('short')}</span>
                   </div>
                )}
                {invoice.amountPaid !== 0 && (
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt' }}>
                      <span>{invoice.amountPaidLabel?.replace(/\(\-\)/g, '').trim() || 'PAGUAR'}:</span>
                      <span>- {invoice.amountPaid.toLocaleString()} {getCurrency('short')}</span>
                   </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '16pt', marginTop: '4px', borderTop: '2px solid #000', paddingTop: '4px' }}>
                  <span style={{ fontSize: '12pt' }}>{isSurplus ? 'TEPRICA:' : 'TOTALI:'}</span>
                  <span>{Math.abs(balanceDue).toLocaleString()} {getCurrency('short')}</span>
                </div>
             </div>

             {/* Statusi i Pageses ne fund - +2pt shkrim */}
             <div style={{ marginTop: '8px', textAlign: 'center', border: '2px solid #000', padding: '4px' }}>
                <span style={{ fontSize: '13pt', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   STATUSI: {invoice.status === 'E paguar' ? 'PAGUAR' : 'PA PAGUAR'}
                </span>
             </div>

             {invoice.notes && (
               <div style={{ marginTop: '6px', fontSize: '10pt', fontStyle: 'italic', border: '1px dashed #ccc', padding: '3px', lineHeight: '1.1' }}>
                  <strong>SHËNIME:</strong> {invoice.notes}
               </div>
             )}

             {business.qrCodeUrl && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                   <img src={business.qrCodeUrl} alt="QR Code" style={{ maxWidth: '30mm', height: 'auto', margin: '0 auto', display: 'block', filter: 'grayscale(100%)' }} />
                </div>
             )}
             
             <div style={{ textAlign: 'center', fontSize: '10pt', fontWeight: 'bold', marginTop: '10px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
                FALEMINDERIT! JU MIRËPRESIM PËRSËRI!
             </div>
          </div>
        </div>
        </div>{/* /zoom wrapper */}
      </div>
    </div>
  );
};

export default InvoicePreview;
