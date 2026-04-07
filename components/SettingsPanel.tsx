
import React, { useRef, useState } from 'react';
import { BusinessConfig, Invoice } from '../types';
import { Save, Download, Upload, Info, Building2, Phone, Mail, Globe, MapPin, Tag, ImageIcon, Trash2, FileText, Play, X, Layers } from 'lucide-react';

const SAMPLE_INVOICE: Invoice = {
  id: 'sample',
  invoiceNumber: '5501',
  date: new Date().toISOString(),
  clientId: 'sample',
  clientName: 'ARDIAN FILANI',
  clientCity: 'TIRANË',
  clientPhone: '+355 69 123 456',
  currency: 'Lek',
  subtotal: 14200,
  tax: 0,
  previousBalance: 3000,
  previousBalanceLabel: 'Gjendja (+)',
  amountPaid: 10000,
  amountPaidLabel: 'Paguar (-)',
  total: 7200,
  status: 'Pa paguar',
  notes: 'Dorëzim i menjëhershëm.',
  items: [
    { itemId: '1', name: 'KËMISHË MESHKUJ', quantity: 10, price: 800, total: 8000 },
    { itemId: '2', name: 'BLUZE E ZEZË', quantity: 5, price: 600, total: 3000 },
    { itemId: '3', name: 'PANTALLONA SPORTIVE', quantity: 3, price: 500, total: 1500 },
    { itemId: '4', name: 'ÇORAPE KLASIKE (PAKETË)', quantity: 8, price: 150, total: 1200 },
    { itemId: '5', name: 'SHAPKA DIMRI', quantity: 2, price: 250, total: 500 },
  ],
};

const TEMPLATES: { id: 1|2|3|4|5; label: string; desc: string }[] = [
  { id: 1, label: 'Standard',  desc: 'Header i errët, kolonë klasike' },
  { id: 2, label: 'Kompakt',   desc: 'Rreshta të ngushtë, shkrim i vogël' },
  { id: 3, label: 'Lista',     desc: 'Pa tabelë, artikulli bold + sasia' },
  { id: 4, label: 'Striped',   desc: 'Rreshta me ngjyra alternative' },
  { id: 5, label: 'Modern',    desc: 'Vija anësore me ngjyrë, pa kufij' },
];

const FONTS = [
  { value: 'Inter, sans-serif',            label: 'Inter (Default)' },
  { value: '"Courier New", monospace',     label: 'Courier (Monospace)' },
  { value: 'Georgia, serif',              label: 'Georgia (Serif)' },
  { value: '"Arial Narrow", Arial, sans-serif', label: 'Arial Narrow' },
  { value: '"Times New Roman", serif',    label: 'Times New Roman' },
];

interface Props {
  config: BusinessConfig;
  onUpdate: (c: BusinessConfig) => void;
  onExport: () => void;
  onImport: (file: File) => Promise<boolean>;
}

const LiveInvoicePaper: React.FC<{ invoice: Invoice; business: BusinessConfig; onUpdate?: (c: BusinessConfig) => void }> = ({ invoice, business, onUpdate }) => {
  const getCurrency = (type: 'short' | 'full' = 'full') => invoice.currency === 'EUR' ? (type === 'short' ? '€' : 'EURO') : (type === 'short' ? 'L' : 'Lekë');
  const balanceDue = (invoice.subtotal + (invoice.previousBalance || 0)) - (invoice.amountPaid || 0);
  const isSurplus = balanceDue < 0;
  const isPaidInFull = balanceDue <= 0;
  const tpl = business.invoiceTemplate || 1;
  const fs = `${business.itemFontSize || 10}px`;
  const ff = business.itemFont || 'Inter, sans-serif';

  const renderItems = () => {
    const items = invoice.items;
    if (tpl === 1) return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#0F172A', color: '#fff', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <th style={{ padding: '5px 12px', textAlign: 'left', width: '50%' }}>ARTIKULLI</th>
          <th style={{ padding: '5px 8px', textAlign: 'center' }}>SASIA</th>
          <th style={{ padding: '5px 12px', textAlign: 'center' }}>ÇMIMI</th>
          <th style={{ padding: '5px 12px', textAlign: 'right' }}>TOTALI</th>
        </tr></thead>
        <tbody style={{ borderBottom: '1px solid #e2e8f0' }}>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '5px 12px', fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b' }}>{item.name}</td>
              <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, color: '#475569' }}>{item.quantity}</td>
              <td style={{ padding: '5px 12px', textAlign: 'center', fontSize: fs, fontFamily: ff, color: '#475569' }}>{item.price.toLocaleString()} {getCurrency('short')}</td>
              <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#0f172a' }}>{item.total.toLocaleString()} {getCurrency('short')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    if (tpl === 2) return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#e2e8f0', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase' }}>
          <th style={{ padding: '3px 8px', textAlign: 'left', width: '50%' }}>ARTIKULLI</th>
          <th style={{ padding: '3px 6px', textAlign: 'center' }}>SASIA</th>
          <th style={{ padding: '3px 8px', textAlign: 'center' }}>ÇMIMI</th>
          <th style={{ padding: '3px 8px', textAlign: 'right' }}>TOTALI</th>
        </tr></thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
              <td style={{ padding: '2px 8px', fontSize: fs, fontFamily: ff, fontWeight: 700, textTransform: 'uppercase', color: '#334155', lineHeight: 1.2 }}>{item.name}</td>
              <td style={{ padding: '2px 6px', textAlign: 'center', fontSize: fs, fontFamily: ff, color: '#64748b' }}>{item.quantity}</td>
              <td style={{ padding: '2px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, color: '#64748b' }}>{item.price.toLocaleString()} {getCurrency('short')}</td>
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
              <div style={{ fontSize: `${(business.itemFontSize || 10) - 1.5}px`, fontFamily: ff, color: '#94a3b8', marginTop: '1px' }}>{item.quantity} × {item.price.toLocaleString()} {getCurrency('short')}</div>
            </div>
            <div style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{item.total.toLocaleString()} {getCurrency('short')}</div>
          </div>
        ))}
      </div>
    );
    if (tpl === 4) return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#0F172A', color: '#fff', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }}>
          <th style={{ padding: '5px 12px', textAlign: 'left', width: '50%' }}>ARTIKULLI</th>
          <th style={{ padding: '5px 8px', textAlign: 'center' }}>SASIA</th>
          <th style={{ padding: '5px 12px', textAlign: 'center' }}>ÇMIMI</th>
          <th style={{ padding: '5px 12px', textAlign: 'right' }}>TOTALI</th>
        </tr></thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
              <td style={{ padding: '5px 12px', fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b' }}>{item.name}</td>
              <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: fs, fontFamily: ff, color: '#475569' }}>{item.quantity}</td>
              <td style={{ padding: '5px 12px', textAlign: 'center', fontSize: fs, fontFamily: ff, color: '#475569' }}>{item.price.toLocaleString()} {getCurrency('short')}</td>
              <td style={{ padding: '5px 12px', textAlign: 'right', fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#0f172a' }}>{item.total.toLocaleString()} {getCurrency('short')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <div>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid #4f46e5', paddingLeft: '8px', marginBottom: '4px', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b' }}>{item.name}</span>
              <span style={{ fontSize: `${(business.itemFontSize || 10) - 1.5}px`, fontFamily: ff, color: '#94a3b8', marginLeft: '6px' }}>{item.quantity} × {item.price.toLocaleString()}</span>
            </div>
            <span style={{ fontSize: fs, fontFamily: ff, fontWeight: 900, color: '#4f46e5', whiteSpace: 'nowrap' }}>{item.total.toLocaleString()} {getCurrency('short')}</span>
          </div>
        ))}
      </div>
    );
  };

  const paperRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const dragStart = React.useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (!onUpdate) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: business.watermarkX ?? 50,
      posY: business.watermarkY ?? 50,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !paperRef.current) return;
      const rect = paperRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - dragStart.current.mouseX) / rect.width) * 100;
      const dy = ((ev.clientY - dragStart.current.mouseY) / rect.height) * 100;
      const nx = Math.max(0, Math.min(100, dragStart.current.posX + dx));
      const ny = Math.max(0, Math.min(100, dragStart.current.posY + dy));
      onUpdate({ ...business, watermarkX: Math.round(nx), watermarkY: Math.round(ny) });
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const wx = business.watermarkX ?? 50;
  const wy = business.watermarkY ?? 50;

  return (
    <div ref={paperRef} style={{ background: '#fff', width: '210mm', minHeight: '297mm', padding: '10mm 15mm', boxSizing: 'border-box', boxShadow: '0 25px 50px rgba(0,0,0,0.4)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {business.watermarkUrl && (
        <div
          onMouseDown={onUpdate ? onMouseDown : undefined}
          style={{
            position: 'absolute',
            left: `${wx}%`,
            top: `${wy}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 0,
            cursor: onUpdate ? 'move' : 'default',
            userSelect: 'none',
          }}
          title={onUpdate ? 'Tërhiq për të lëvizur watermark-un' : ''}
        >
          <img src={business.watermarkUrl} alt="" style={{ width: `${(business.watermarkSize ?? 60) * 1.98}px`, maxWidth: '160mm', opacity: (business.watermarkOpacity ?? 20) / 100, objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
          {onUpdate && (
            <div style={{ position: 'absolute', inset: 0, border: '1.5px dashed #7c3aed55', borderRadius: 4, pointerEvents: 'none' }} />
          )}
        </div>
      )}
      {/* Content above watermark */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          {business.logoUrl
            ? <img src={business.logoUrl} alt="Logo" style={{ height: '64px', objectFit: 'contain', marginBottom: '6px' }} />
            : <div style={{ fontSize: '32px', fontWeight: 900, color: '#D81B60', fontStyle: 'italic', lineHeight: 1 }}>INTAL<sup style={{ fontSize: '10px' }}>®</sup></div>
          }
          <div style={{ fontSize: '8px', fontWeight: 900, color: '#D81B60', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '4px' }}>{business.slogan || 'CILËSIA ËSHTË PRIORITETI YNË'}</div>
          <div style={{ fontSize: '8px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{business.address}</div>
          <div style={{ fontSize: '8px', color: '#475569', fontWeight: 700 }}>Tel: {business.phone}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ fontSize: '32px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase' }}>FATURË</div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '6px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>NR. {invoice.invoiceNumber}</div>
            <div style={{ fontSize: '7px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>DATA: {new Date().toLocaleDateString('sq-AL')}</div>
          </div>
        </div>
      </div>

      {/* Client row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 900, color: '#D81B60', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>KLIENTI:</div>
          <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', lineHeight: 1 }}>{invoice.clientName}</div>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginTop: '4px' }}>{invoice.clientCity}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ padding: '6px 12px', borderRadius: '10px', width: '140px', textAlign: 'center', background: isSurplus ? '#fffbeb' : isPaidInFull ? '#f0fdf4' : '#fff1f2', border: `1px solid ${isSurplus ? '#fde68a' : isPaidInFull ? '#bbf7d0' : '#fecdd3'}` }}>
            <div style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: isSurplus ? '#d97706' : isPaidInFull ? '#16a34a' : '#e11d48', marginBottom: '2px' }}>{isSurplus ? 'TEPRICA' : 'DETYRIMI'}</div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: isSurplus ? '#d97706' : isPaidInFull ? '#16a34a' : '#e11d48' }}>{Math.abs(balanceDue).toLocaleString()} {getCurrency('full')}</div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{ flex: 1, marginTop: '4px' }}>{renderItems()}</div>

      {/* Totals */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '240px', border: '2px solid #0f172a', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}><span>NËNTOTALI:</span><span style={{ color: '#0f172a' }}>{invoice.subtotal.toLocaleString()} {getCurrency('short')}</span></div>
            {invoice.previousBalance !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#d97706' }}><span>GJENDJA:</span><span>{invoice.previousBalance.toLocaleString()} {getCurrency('short')}</span></div>}
            {invoice.amountPaid !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#2563eb' }}><span>PAGUAR:</span><span>- {invoice.amountPaid.toLocaleString()} {getCurrency('short')}</span></div>}
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0f172a', background: isSurplus ? '#fffbeb' : isPaidInFull ? '#f0fdf4' : '#fff1f2' }}>
            <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>{isSurplus ? 'TEPRICA:' : 'DETYRIMI:'}</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: isSurplus ? '#d97706' : isPaidInFull ? '#16a34a' : '#e11d48' }}>{Math.abs(balanceDue).toLocaleString()} {getCurrency('short')}</span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', borderTop: '1px solid #f1f5f9', marginTop: '16px', paddingTop: '10px' }}>
        <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#0f172a' }}>FALEMINDERIT QË NA BESUAT!</p>
      </div>
      </div> {/* end content zIndex wrapper */}
    </div>
  );
};

const SettingsPanel: React.FC<Props> = ({ config, onUpdate, onExport, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => onUpdate({ ...config, watermarkUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onUpdate({ ...config, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate({ ...config, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    onUpdate({ ...config, logoUrl: undefined });
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate({ ...config, qrCodeUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeQr = () => {
    onUpdate({ ...config, qrCodeUrl: undefined });
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
           <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Building2 size={24}/></div>
           <h3 className="font-black text-slate-800 text-xl">Profili i Biznesit</h3>
        </div>

        {/* Logo Upload Section */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Logo e Biznesit (Për Faturat)</label>
          <div className="flex items-center gap-6 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <div className="w-24 h-24 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
              ) : (
                <ImageIcon size={32} className="text-slate-200" />
              )}
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Upload size={14} /> Ngarko Logo
              </button>
              {config.logoUrl && (
                <button 
                  onClick={removeLogo}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-600 text-[10px] font-bold uppercase"
                >
                  <Trash2 size={12} /> Hiqe Logon
                </button>
              )}
              <input 
                type="file" 
                ref={logoInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleLogoUpload}
              />
              <p className="text-[10px] text-slate-400">Rekomandohet format PNG ose JPG, max 1MB.</p>
            </div>
          </div>
        </div>

        {/* QR Code Upload Section */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">QR Kod (Për Faturat 80mm)</label>
          <div className="flex items-center gap-6 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <div className="w-24 h-24 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {config.qrCodeUrl ? (
                <img src={config.qrCodeUrl} alt="QR Preview" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="bg-slate-100 p-3 rounded-lg text-slate-300">QR</div>
              )}
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => qrInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Upload size={14} /> Ngarko QR Kod
              </button>
              {config.qrCodeUrl && (
                <button 
                  onClick={removeQr}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-600 text-[10px] font-bold uppercase"
                >
                  <Trash2 size={12} /> Hiqe QR Kodin
                </button>
              )}
              <input 
                type="file" 
                ref={qrInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleQrUpload}
              />
              <p className="text-[10px] text-slate-400">Ky kod do të shfaqet në fund të faturës termale.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Emri i Biznesit (Të shfaqet në faturë)</label>
            <input 
              name="name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              value={config.name}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">NIPT / NUDS</label>
              <input 
                name="nipt"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                value={config.nipt}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Telefoni</label>
              <input 
                name="phone"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                value={config.phone}
                onChange={handleChange}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Adresa Zyrtare</label>
            <textarea 
              name="address"
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              value={config.address}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
              <input 
                name="email"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                value={config.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Website</label>
              <input 
                name="website"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                value={config.website}
                onChange={handleChange}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sllogani / Shënim në fund të faturës</label>
            <input 
              name="slogan"
              placeholder="Psh: Faleminderit që na besuat!"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none italic text-slate-500"
              value={config.slogan}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="space-y-8">
         <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl shadow-slate-900/20 space-y-6">
            <div className="flex items-center gap-3">
               <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500"><Info size={24}/></div>
               <h3 className="font-black text-xl">Menaxhimi i të Dhënave</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Ky program i ruan të dhënat lokalisht në pajisjen tuaj. Për siguri maksimale, rekomandohet të bëni Backup rregullisht.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <button 
                 onClick={onExport}
                 className="flex flex-col items-center gap-3 p-6 bg-slate-800 rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all group"
               >
                  <Download className="text-blue-400 group-hover:scale-110 transition-transform" size={32} />
                  <div className="text-center">
                    <span className="block font-bold">Eksporto Backup</span>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Ruaj në Disk (.json)</span>
                  </div>
               </button>

               <button
                 onClick={() => { setImportStatus('idle'); setImportError(''); fileInputRef.current?.click(); }}
                 disabled={importStatus === 'loading'}
                 className="flex flex-col items-center gap-3 p-6 bg-slate-800 rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all group disabled:opacity-60"
               >
                  <Upload className={`group-hover:scale-110 transition-transform ${importStatus === 'error' ? 'text-rose-400' : importStatus === 'success' ? 'text-emerald-300' : 'text-emerald-400'}`} size={32} />
                  <div className="text-center">
                    <span className="block font-bold">
                      {importStatus === 'loading' ? 'Duke importuar...' : importStatus === 'success' ? '✓ U importua!' : importStatus === 'error' ? '✗ Dështoi' : 'Importo Backup'}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                      {importStatus === 'error' ? importError : 'Rikthe të dhënat'}
                    </span>
                  </div>
               </button>
               <input
                 type="file"
                 ref={fileInputRef}
                 className="hidden"
                 accept=".json,application/json,text/plain"
                 onChange={async (e) => {
                   const file = e.target.files?.[0];
                   if (!file) return;
                   setImportStatus('loading');
                   try {
                     const ok = await onImport(file);
                     if (ok) {
                       setImportStatus('success');
                     } else {
                       setImportStatus('error');
                       setImportError('Skedari i pavlefshëm');
                     }
                   } catch (err: any) {
                     setImportStatus('error');
                     setImportError(err?.message || 'Gabim i panjohur');
                   }
                   // reset input so same file can be re-selected
                   e.target.value = '';
                 }}
               />
            </div>
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
               <Tag size={18} className="text-[#D81B60]" /> Përdorimi Offline
            </h4>
            <p className="text-sm text-slate-500 mb-4">
               Ky aplikacion është i instaluar lokalisht. Mund ta përdorni edhe pa internet. Ikonën do ta gjeni në Desktop ose në listën e aplikacioneve tuaja.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
               <p className="text-xs text-blue-700 font-medium">
                  <strong>Këshillë:</strong> Nëse keni shumë artikuj, importojini ato përmes backup-it për të kursyer kohë.
               </p>
            </div>
         </div>
      </div>

      {/* Template Picker - full width */}
      <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><FileText size={24}/></div>
            <h3 className="font-black text-slate-800 text-xl">Pamja e Faturës — Stili i Artikujve</h3>
          </div>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Play size={14} strokeWidth={3}/> Provo
          </button>
        </div>

        {/* 5 template cards */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Zgjidhni Templatein</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {TEMPLATES.map(t => {
              const active = (config.invoiceTemplate || 1) === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onUpdate({ ...config, invoiceTemplate: t.id })}
                  className={`relative rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md ${active ? 'border-indigo-600 bg-indigo-50 shadow-lg shadow-indigo-600/10' : 'border-slate-100 hover:border-slate-300'}`}
                >
                  {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600" />}
                  {/* Mini items preview */}
                  <div className="mb-3 space-y-0.5 pointer-events-none select-none">
                    {t.id === 1 && (
                      <div className="text-[6px]">
                        <div className="bg-slate-800 text-white px-1 py-0.5 flex justify-between font-black uppercase">
                          <span>ARTIKULLI</span><span>TOTALI</span>
                        </div>
                        {['ARTIKULL A','ARTIKULL B','ARTIKULL C'].map((n,i)=>(
                          <div key={i} className="flex justify-between px-1 py-0.5 border-b border-slate-100">
                            <span className="font-black uppercase">{n}</span><span>1,200 L</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.id === 2 && (
                      <div className="text-[5.5px] leading-tight">
                        <div className="bg-slate-200 px-1 py-0.5 flex justify-between font-black uppercase">
                          <span>ARTIKULLI</span><span>TOT</span>
                        </div>
                        {['ARTIKULL A','ARTIKULL B','ARTIKULL C'].map((n,i)=>(
                          <div key={i} className="flex justify-between px-1 border-b border-slate-50">
                            <span className="uppercase">{n}</span><span>1,200 L</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.id === 3 && (
                      <div className="text-[5.5px] leading-tight space-y-0.5">
                        {['ARTIKULL A','ARTIKULL B','ARTIKULL C'].map((n,i)=>(
                          <div key={i} className="border-b border-slate-100 pb-0.5">
                            <div className="font-black uppercase">{n}</div>
                            <div className="flex justify-between text-slate-500"><span>2 x 600 L</span><span className="font-black">1,200 L</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.id === 4 && (
                      <div className="text-[5.5px] leading-tight">
                        <div className="bg-slate-800 text-white px-1 py-0.5 flex justify-between font-black uppercase">
                          <span>ARTIKULLI</span><span>TOTALI</span>
                        </div>
                        {['ARTIKULL A','ARTIKULL B','ARTIKULL C'].map((n,i)=>(
                          <div key={i} className={`flex justify-between px-1 py-0.5 ${i%2===0?'bg-slate-50':''}`}>
                            <span className="uppercase font-black">{n}</span><span>1,200 L</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.id === 5 && (
                      <div className="text-[5.5px] leading-tight space-y-0.5">
                        {['ARTIKULL A','ARTIKULL B','ARTIKULL C'].map((n,i)=>(
                          <div key={i} className="flex justify-between pl-1.5 py-0.5 border-l-2 border-indigo-500">
                            <span className="font-black uppercase">{n}</span><span className="text-slate-500">1,200 L</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-indigo-600' : 'text-slate-700'}`}>{t.label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font & Size */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Fonti i Artikujve</label>
            <select
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-indigo-500 transition-all"
              value={config.itemFont || 'Inter, sans-serif'}
              onChange={e => onUpdate({ ...config, itemFont: e.target.value })}
            >
              {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
              Madhësia e Shkronjave — Artikujt: <span className="text-indigo-600">{config.itemFontSize || 10}pt</span>
            </label>
            <input
              type="range" min={7} max={16} step={0.5}
              value={config.itemFontSize || 10}
              onChange={e => onUpdate({ ...config, itemFontSize: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-bold">
              <span>7pt (Shumë i vogël)</span><span>16pt (Shumë i madh)</span>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div className="pt-6 border-t border-slate-100 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-violet-50 p-2 rounded-lg text-violet-600"><Layers size={18}/></div>
            <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest">Watermark (Vulë / Logo mbi Faturë)</h4>
          </div>

          <div className="flex items-center gap-6 p-5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <div className="w-20 h-20 bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
              {config.watermarkUrl
                ? <img src={config.watermarkUrl} alt="Watermark" className="w-full h-full object-contain p-2" style={{ opacity: (config.watermarkOpacity ?? 20) / 100 }} />
                : <Layers size={28} className="text-slate-200" />
              }
            </div>
            <div className="space-y-2">
              <button onClick={() => watermarkInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
                <Upload size={14}/> Ngarko Watermark
              </button>
              {config.watermarkUrl && (
                <button onClick={() => onUpdate({ ...config, watermarkUrl: undefined })}
                  className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:text-rose-600 text-[10px] font-bold uppercase">
                  <Trash2 size={12}/> Hiqe Watermark
                </button>
              )}
              <input ref={watermarkInputRef} type="file" accept="image/*" className="hidden" onChange={handleWatermarkUpload} />
              <p className="text-[10px] text-slate-400">Rekomandohet PNG me sfond transparent.</p>
            </div>
          </div>

          {config.watermarkUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Madhësia: <span className="text-violet-600">{config.watermarkSize ?? 60}%</span>
                </label>
                <input type="range" min={10} max={100} step={5}
                  value={config.watermarkSize ?? 60}
                  onChange={e => onUpdate({ ...config, watermarkSize: parseInt(e.target.value) })}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>10% (E vogël)</span><span>100% (E madhe)</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Opacity: <span className="text-violet-600">{config.watermarkOpacity ?? 20}%</span>
                </label>
                <input type="range" min={5} max={80} step={5}
                  value={config.watermarkOpacity ?? 20}
                  onChange={e => onUpdate({ ...config, watermarkOpacity: parseInt(e.target.value) })}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                  <span>5% (Shumë transparente)</span><span>80% (E dukshme)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Live Preview Modal */}
    {showPreview && (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[400] flex overflow-hidden">
        {/* Left: controls panel */}
        <div className="w-80 shrink-0 bg-white flex flex-col overflow-y-auto border-r border-slate-200">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 flex items-center gap-2"><Play size={14} className="text-indigo-600"/> Provo Templatein</h3>
            <button onClick={() => setShowPreview(false)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"><X size={20}/></button>
          </div>

          <div className="p-6 space-y-6">
            {/* Template */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template</label>
              <div className="space-y-2">
                {TEMPLATES.map(t => {
                  const active = (config.invoiceTemplate || 1) === t.id;
                  return (
                    <button key={t.id} onClick={() => onUpdate({ ...config, invoiceTemplate: t.id })}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${active ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-300'}`}
                    >
                      <p className={`text-xs font-black uppercase ${active ? 'text-indigo-600' : 'text-slate-700'}`}>{t.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fonti</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-indigo-500 transition-all"
                value={config.itemFont || 'Inter, sans-serif'}
                onChange={e => onUpdate({ ...config, itemFont: e.target.value })}
              >
                {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Madhësia: <span className="text-indigo-600">{config.itemFontSize || 10}pt</span>
              </label>
              <input type="range" min={7} max={16} step={0.5}
                value={config.itemFontSize || 10}
                onChange={e => onUpdate({ ...config, itemFontSize: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                <span>7pt</span><span>16pt</span>
              </div>
            </div>
          </div>

          {/* Watermark in modal */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Layers size={11}/> Watermark</label>
            {config.watermarkUrl ? (
              <>
                <div className="flex items-center gap-3">
                  <img src={config.watermarkUrl} alt="" className="w-10 h-10 object-contain rounded-lg border border-slate-100 bg-slate-50" style={{ opacity: (config.watermarkOpacity ?? 20) / 100 }} />
                  <button onClick={() => onUpdate({ ...config, watermarkUrl: undefined })} className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1"><Trash2 size={10}/> Hiqe</button>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Madhësia: <span className="text-violet-600">{config.watermarkSize ?? 60}%</span></label>
                  <input type="range" min={10} max={100} step={5} value={config.watermarkSize ?? 60} onChange={e => onUpdate({ ...config, watermarkSize: parseInt(e.target.value) })} className="w-full accent-violet-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase">Opacity: <span className="text-violet-600">{config.watermarkOpacity ?? 20}%</span></label>
                  <input type="range" min={5} max={80} step={5} value={config.watermarkOpacity ?? 20} onChange={e => onUpdate({ ...config, watermarkOpacity: parseInt(e.target.value) })} className="w-full accent-violet-600" />
                </div>
              </>
            ) : (
              <button onClick={() => watermarkInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:border-violet-400 hover:text-violet-500 transition-all flex items-center justify-center gap-2">
                <Upload size={12}/> Ngarko Watermark
              </button>
            )}
          </div>
        </div>

        {/* Right: live invoice preview — paper only */}
        <div className="flex-1 overflow-y-auto flex items-start justify-center py-10 px-4">
          <LiveInvoicePaper invoice={SAMPLE_INVOICE} business={config} onUpdate={onUpdate} />
        </div>
      </div>
    )}
    </>
  );
};

export default SettingsPanel;
