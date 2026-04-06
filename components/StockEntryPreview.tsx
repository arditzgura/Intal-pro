
import React, { useState } from 'react';
import { StockEntry, BusinessConfig } from '../types';
import { X, Printer, FileCheck, Loader2, Landmark, Package, Truck, Calendar, Download, Image as ImageIcon } from 'lucide-react';

interface Props {
  entry: StockEntry;
  business: BusinessConfig;
  onClose: () => void;
  onEdit: (entry: StockEntry) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const StockEntryPreview: React.FC<Props> = ({ entry, business, onClose, onEdit }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isPngExporting, setIsPngExporting] = useState(false);

  const handlePrint = (format: 'A4' | '80mm') => {
    document.body.classList.remove('format-80mm');
    if (format === '80mm') document.body.classList.add('format-80mm');
    setTimeout(() => { 
      window.print(); 
      setTimeout(() => document.body.classList.remove('format-80mm'), 500);
    }, 150);
  };

  const exportPDF = async () => {
    const element = document.getElementById('stock-entry-printable');
    if (!element || isExporting) return;
    setIsExporting(true);
    try {
      const opt = { 
        margin: 0, 
        filename: `Flethyrje_${entry.entryNumber}.pdf`, 
        image: { type: 'jpeg', quality: 1.0 }, 
        html2canvas: { 
          scale: 4, 
          useCORS: true,
          onclone: (clonedDoc: Document) => {
            const el = clonedDoc.getElementById('stock-entry-printable');
            if (el) {
              el.style.transform = 'none';
              el.parentElement!.style.transform = 'none';
              el.parentElement!.style.padding = '0';
              el.parentElement!.style.margin = '0';
            }
          }
        }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
      };
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (e) { 
      console.error("Stock PDF Export Error:", e); 
    } finally { 
      setIsExporting(false); 
    }
  };

  const exportPNG = async () => {
    const element = document.getElementById('stock-entry-printable');
    if (!element || isPngExporting) return;
    setIsPngExporting(true);
    try {
      // @ts-ignore
      const canvas = await html2canvas(element, { 
        scale: 4, 
        useCORS: true, 
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc: Document) => {
          const el = clonedDoc.getElementById('stock-entry-printable');
          if (el) {
            el.style.transform = 'none';
            el.parentElement!.style.transform = 'none';
          }
        }
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.download = `Flethyrje_${entry.entryNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Stock PNG Export Error:", e);
    } finally {
      setIsPngExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[400] flex flex-col items-center overflow-y-auto py-10 px-4">
      {/* Paneli i Kontrolleve */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[410] print:hidden">
        <div className="bg-white p-2 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-2">
          <button onClick={exportPNG} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all">
            {isPngExporting ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} PNG
          </button>
          <button onClick={exportPDF} className="bg-[#D81B60] text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#AD1457] transition-all">
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />} PDF
          </button>
          <button onClick={() => handlePrint('A4')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
            <Printer size={16} /> A4
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-900 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="mt-16 print:mt-0 transition-all transform scale-[0.55] sm:scale-75 md:scale-90 lg:scale-100 origin-top">
        <div id="stock-entry-printable" className="bg-white shadow-2xl print:shadow-none" style={{ width: '210mm', minHeight: '297mm', padding: '20mm 20mm', position: 'relative', boxSizing: 'border-box' }}>
          
          <div className="roll-hide h-full flex flex-col">
            {/* Header: Logo & Title */}
            <div className="flex justify-between items-start mb-10 pb-10 border-b-4 border-slate-900">
              <div className="space-y-4">
                <div className="flex flex-col">
                  {business.logoUrl ? (
                    <img src={business.logoUrl} alt="Logo" className="h-20 object-contain" />
                  ) : (
                    <>
                      <span className="text-5xl font-black text-slate-900 tracking-tighter italic leading-none">INTAL<sup className="text-sm">®</sup></span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 ml-1">SISTEMI I MENAXHIMIT TË MAGAZINËS</span>
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{business.address}</p>
                  <p className="text-[10px] font-bold text-slate-500">Tel: {business.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">FLETËHYRJE</h1>
                <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 space-y-1">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nr. Dokumentit</p>
                   <p className="text-xl font-black text-slate-900">#{entry.entryNumber}</p>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl text-indigo-600 shadow-sm">
                   <Truck size={24} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ORIGJINA / FURNITORI</p>
                   <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{entry.origin}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl text-indigo-600 shadow-sm">
                   <Calendar size={24} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">DATA E PRANIMIT</p>
                   <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{formatDate(entry.date)}</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4 text-left rounded-l-xl">ARTIKULLI</th>
                    <th className="px-4 py-4 text-center">SASIA</th>
                    <th className="px-6 py-4 text-center">BLERJE</th>
                    <th className="px-6 py-4 text-center">SHITJE</th>
                    <th className="px-6 py-4 text-right rounded-r-xl">VLERA TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entry.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                         <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.name}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                         <span className="inline-block bg-slate-100 px-3 py-1 rounded-lg font-black text-xs text-slate-700">{item.quantity}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">{item.purchasePrice.toLocaleString()} L</td>
                      <td className="px-6 py-4 text-center text-xs font-black text-emerald-600">{item.sellingPrice.toLocaleString()} L</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{item.total.toLocaleString()} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Boxes */}
            <div className="mt-12 pt-10 border-t-2 border-slate-100">
               <div className="flex justify-between items-start">
                  <div className="max-w-sm">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">SHËNIME / KOMENTE:</p>
                     <p className="text-xs font-bold text-slate-600 italic leading-relaxed">
                        {entry.notes || 'Nuk ka shënime shtesë për këtë fletëhyrje.'}
                     </p>
                  </div>
                  <div className="w-80 space-y-3">
                     <div className="flex justify-between items-center px-4 py-2 text-slate-500">
                        <span className="text-[10px] font-black uppercase tracking-widest">TOTALI BLERJES:</span>
                        <span className="text-sm font-black">{entry.totalPurchaseValue.toLocaleString()} L</span>
                     </div>
                     <div className="flex justify-between items-center px-4 py-2 text-emerald-600">
                        <span className="text-[10px] font-black uppercase tracking-widest">VLERA NË SHITJE:</span>
                        <span className="text-sm font-black">{entry.totalSellingValue.toLocaleString()} L</span>
                     </div>
                     <div className="bg-slate-900 p-6 rounded-[32px] flex justify-between items-center text-white shadow-xl">
                        <span className="text-xs font-black uppercase tracking-widest opacity-50">FITIMI:</span>
                        <span className="text-2xl font-black text-indigo-400">{(entry.totalSellingValue - entry.totalPurchaseValue).toLocaleString()} L</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Signature Area */}
            <div className="mt-20 grid grid-cols-2 gap-20">
               <div className="text-center">
                  <div className="border-b border-slate-300 h-12 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DORËZOI</p>
               </div>
               <div className="text-center">
                  <div className="border-b border-slate-300 h-12 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PRANOI</p>
               </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-10 text-center">
               <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">GJENERUAR NGA SISTEMI INTAL PRO ANALYTICS - {new Date().toLocaleDateString('sq-AL')}</p>
            </div>
          </div>

          {/* Thermal View (Simplified) */}
          <div className="roll-only">
             <div className="text-center border-b border-dashed pb-2 mb-4">
                <h2 className="text-lg font-black uppercase">FLETËHYRJE</h2>
                <p className="text-xs font-bold">#{entry.entryNumber}</p>
                <p className="text-[10px]">{formatDate(entry.date)}</p>
             </div>
             <div className="space-y-2 mb-4">
                <p className="text-xs font-bold">Origjina: <span className="uppercase font-black">{entry.origin}</span></p>
             </div>
             <div className="border-b border-dashed mb-2"></div>
             {entry.items.map((item, i) => (
               <div key={i} className="mb-2 text-xs">
                  <p className="font-black uppercase">{item.name}</p>
                  <div className="flex justify-between">
                     <span>{item.quantity} x {item.purchasePrice.toLocaleString()} L</span>
                     <span className="font-black">{item.total.toLocaleString()} L</span>
                  </div>
               </div>
             ))}
             <div className="border-t-2 border-black pt-2 mt-4 space-y-1">
                <div className="flex justify-between text-sm font-black">
                   <span>TOTAL BLERJE:</span>
                   <span>{entry.totalPurchaseValue.toLocaleString()} L</span>
                </div>
                <div className="flex justify-between text-xs opacity-60">
                   <span>VLERA SHITJE:</span>
                   <span>{entry.totalSellingValue.toLocaleString()} L</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockEntryPreview;
