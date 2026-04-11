
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Item, Invoice, StockEntry, StockEntryItem } from '../types';
import { Plus, Hash, Package, Trash2, Save, ArrowLeft, Calendar, Truck, PackageSearch, Search } from 'lucide-react';

interface Props {
  items: Item[];
  invoices: Invoice[];
  onSave: (entry: StockEntry, updateGlobalPrices: boolean) => void;
  onCancel: () => void;
  nextNumber: string;
  initialData?: StockEntry | null;
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const StockEntryGenerator: React.FC<Props> = ({ items, invoices, onSave, onCancel, nextNumber, initialData }) => {
  const [entryNumber, setEntryNumber] = useState(nextNumber);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [origin, setOrigin] = useState('MAGAZINA QENDRORE');
  const [entryItems, setEntryItems] = useState<StockEntryItem[]>([]);
  const [notes, setNotes] = useState('');
  const [updateGlobalPrices, setUpdateGlobalPrices] = useState(true);

  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (initialData) {
      setEntryNumber(initialData.entryNumber);
      setDate(initialData.date);
      setOrigin(initialData.origin);
      setEntryItems(initialData.items);
      setNotes(initialData.notes || '');
    } else {
      setEntryItems([{
        itemId: 'manual-' + Date.now(),
        name: '',
        quantity: 1,
        purchasePrice: 0,
        sellingPrice: 0,
        total: 0
      }]);
    }
  }, [initialData, nextNumber]);

  const matchesFuzzy = (target: string, query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const targetLower = target.toLowerCase();
    const queryParts = q.split(' ').filter(p => p.length > 0);
    return queryParts.every(part => targetLower.includes(part));
  };

  const itemSalesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.status === 'Anuluar') return;
      inv.items.forEach(it => {
        const key = it.name.trim().toLowerCase();
        counts[key] = (counts[key] || 0) + Number(it.quantity);
      });
    });
    return counts;
  }, [invoices]);

  const getFilteredItemsSorted = (query: string) =>
    items
      .filter(i => matchesFuzzy(i.name, query))
      .sort((a, b) => (itemSalesCount[b.name.trim().toLowerCase()] || 0) - (itemSalesCount[a.name.trim().toLowerCase()] || 0))
      .slice(0, 10);

  const addRow = () => {
    setEntryItems([...entryItems, { itemId: 'm-' + Date.now(), name: '', quantity: 1, purchasePrice: 0, sellingPrice: 0, total: 0 }]);
  };

  const removeRow = (idx: number) => {
    if (entryItems.length === 1) return;
    setEntryItems(entryItems.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, updates: any) => {
    setEntryItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const updated = { ...item, ...updates };
        // Support string intermediate values for negative numbers
        const q = typeof updated.quantity === 'string' ? (parseFloat(updated.quantity) || 0) : updated.quantity;
        const pp = typeof updated.purchasePrice === 'string' ? (parseFloat(updated.purchasePrice) || 0) : updated.purchasePrice;
        updated.total = q * pp;
        return updated;
      }
      return item;
    }));
  };

  const selectItem = (idx: number, item: Item) => {
    updateRow(idx, { itemId: item.id, name: item.name, sellingPrice: item.price, purchasePrice: item.purchasePrice || 0 });
    setActiveSearchIdx(null);
    
    setTimeout(() => {
      const qtyInput = qtyRefs.current[idx];
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const filtered = getFilteredItemsSorted(entryItems[idx].name);
    
    if (activeSearchIdx === idx && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIdx(prev => (prev + 1) % filtered.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIdx(prev => (prev - 1 + filtered.length) % filtered.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(idx, filtered[highlightedIdx]);
        return;
      } else if (e.key === 'Escape') {
        setActiveSearchIdx(null);
        return;
      }
    }

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (idx < entryItems.length - 1) {
        nameRefs.current[idx + 1]?.focus();
      } else if (entryItems[idx].name.trim() !== '') {
        addRow();
        setTimeout(() => nameRefs.current[idx + 1]?.focus(), 50);
      }
    }
  };

  const handleNumberKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.key === 'ArrowUp' && idx > 0) {
        nameRefs.current[idx - 1]?.focus();
      } else if (e.key === 'ArrowDown') {
        if (idx < entryItems.length - 1) {
          nameRefs.current[idx + 1]?.focus();
        } else {
          addRow();
          setTimeout(() => nameRefs.current[idx + 1]?.focus(), 50);
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx < entryItems.length - 1) {
        nameRefs.current[idx + 1]?.focus();
      } else {
        addRow();
        setTimeout(() => nameRefs.current[idx + 1]?.focus(), 50);
      }
    }
  };

  const totalPurchaseValue = useMemo(() => entryItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0), [entryItems]);
  const totalSellingValue = useMemo(() => entryItems.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0)), 0), [entryItems]);

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-2xl space-y-8 relative">
      <div className="flex justify-between items-center pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ArrowLeft size={24} /></button>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
              {initialData ? 'Ndrysho Fletëhyrjen' : 'Fletëhyrje e Re'}
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nr. {entryNumber} | Format: {formatDateDisplay(date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg">
             <Hash size={16} className="text-slate-400" />
             <input className="bg-transparent border-none outline-none font-black w-24 text-right" value={entryNumber} onChange={e => setEntryNumber(e.target.value)} />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={14} /> Data e Hyrjes
          </label>
          <input 
            type="date" 
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-indigo-500 transition-all"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Truck size={14} /> Origjina / Furnitori
          </label>
          <input 
            type="text" 
            placeholder="Psh: Magazina QENDRORE"
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-indigo-500 transition-all uppercase"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 shadow-sm relative">
        <div className="grid grid-cols-12 bg-indigo-900 text-white py-4 px-6 text-[10px] font-black uppercase tracking-widest rounded-t-2xl">
          <div className="col-span-5">Artikulli</div>
          <div className="col-span-1 text-center">Sasia</div>
          <div className="col-span-2 text-center">Blerje (L)</div>
          <div className="col-span-2 text-center">Shitje (L)</div>
          <div className="col-span-1 text-right">Vlera</div>
          <div className="col-span-1"></div>
        </div>
        <div className="bg-white divide-y divide-slate-50 rounded-b-2xl">
          {entryItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 px-6 py-4 items-center group relative z-[1]">
              <div className="col-span-5 relative">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-slate-300 shrink-0" />
                  <input
                    ref={el => { nameRefs.current[idx] = el; }}
                    className="w-full font-bold outline-none bg-transparent"
                    placeholder="Kërko artikullin..."
                    value={item.name}
                    onChange={e => updateRow(idx, { name: e.target.value })}
                    onKeyDown={e => handleKeyDown(e, idx)}
                    onFocus={() => {setActiveSearchIdx(idx); setHighlightedIdx(0);}}
                    onBlur={() => setTimeout(() => setActiveSearchIdx(null), 200)}
                  />
                </div>
                
                {activeSearchIdx === idx && item.name.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border-2 border-indigo-600 shadow-2xl z-[200] rounded-2xl mt-1 overflow-hidden ring-4 ring-indigo-600/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Search size={12} className="text-indigo-600" />
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Zgjidh Artikullin</span>
                      </div>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase">Enter për të zgjedhur</span>
                    </div>
                    <div className="flex flex-col max-h-[300px] overflow-y-auto">
                    {getFilteredItemsSorted(item.name).map((i, sIdx) => (
                      <button
                        key={i.id}
                        onMouseDown={() => selectItem(idx, i)}
                        onMouseEnter={() => setHighlightedIdx(sIdx)}
                        className={`w-full text-left px-5 py-3 flex justify-between items-center transition-all border-b border-slate-50 last:border-none ${highlightedIdx === sIdx ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-black uppercase tracking-tight">{i.name}</span>
                          <span className={`text-[10px] font-bold uppercase ${highlightedIdx === sIdx ? 'text-indigo-200' : 'text-slate-400'}`}>{i.unit}</span>
                        </div>
                        <div className="text-right">
                          <p className={`text-[9px] font-bold uppercase ${highlightedIdx === sIdx ? 'text-indigo-200' : 'text-slate-400'}`}>Shitje</p>
                          <p className={`text-sm font-black ${highlightedIdx === sIdx ? 'text-white' : 'text-indigo-600'}`}>{i.price.toLocaleString()} L</p>
                        </div>
                      </button>
                    ))}
                    {getFilteredItemsSorted(item.name).length === 0 && (
                      <div className="px-4 py-6 text-center bg-slate-50/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Nuk u gjet asnjë artikull</p>
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-1 px-2">
                <input 
                  ref={el => { qtyRefs.current[idx] = el; }} 
                  type="number" 
                  className="w-full text-center font-black outline-none bg-slate-50 rounded-lg py-1" 
                  value={item.quantity} 
                  onChange={e => updateRow(idx, { quantity: e.target.value })}
                  onKeyDown={e => handleNumberKeyDown(e, idx)}
                />
              </div>
              <div className="col-span-2 px-2">
                <input 
                  type="number" 
                  className="w-full text-center font-black text-blue-600 outline-none bg-blue-50/50 rounded-lg py-1" 
                  value={item.purchasePrice} 
                  onChange={e => updateRow(idx, { purchasePrice: e.target.value })}
                  onKeyDown={e => handleNumberKeyDown(e, idx)}
                />
              </div>
              <div className="col-span-2 px-2">
                <input 
                  type="number" 
                  className="w-full text-center font-black text-emerald-600 outline-none bg-emerald-50/50 rounded-lg py-1" 
                  value={item.sellingPrice} 
                  onChange={e => updateRow(idx, { sellingPrice: e.target.value })}
                  onKeyDown={e => handleNumberKeyDown(e, idx)}
                />
              </div>
              <div className="col-span-1 text-right font-black text-slate-900">{(Number(item.total) || 0).toLocaleString()}</div>
              <div className="col-span-1 text-right">
                <button onClick={() => removeRow(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
        <div className="space-y-4 w-full md:w-auto">
          <button onClick={addRow} className="flex items-center gap-2 px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase text-xs hover:bg-indigo-50 transition-all">
            <Plus size={18} /> Shto Rresht
          </button>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-6 rounded-full transition-all relative ${updateGlobalPrices ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <input type="checkbox" className="hidden" checked={updateGlobalPrices} onChange={() => setUpdateGlobalPrices(!updateGlobalPrices)} />
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${updateGlobalPrices ? 'left-5' : 'left-1'}`}></div>
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-800 transition-colors">Përditëso çmimet në listën globale</span>
          </label>
        </div>

        <div className="w-full md:w-96 bg-slate-900 p-8 rounded-3xl text-white shadow-2xl space-y-6">
           <div className="space-y-3">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Vlera Blerjes</span>
                <span className="text-lg font-black">{totalPurchaseValue.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center text-emerald-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Vlera në Shitje</span>
                <span className="text-lg font-black">{totalSellingValue.toLocaleString()} L</span>
              </div>
              <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Fitimi i Parashikuar</span>
                 <span className="text-2xl font-black text-indigo-400">{(totalSellingValue - totalPurchaseValue).toLocaleString()} L</span>
              </div>
           </div>
           
           <button onClick={() => {
             if (entryItems.every(i => i.name.trim() === '')) {
               alert("Shtoni të paktën një artikull.");
               return;
             }
             onSave({
               id: initialData?.id || Date.now().toString(),
               entryNumber,
               date,
               origin: origin.toUpperCase(),
               items: entryItems.filter(i => i.name.trim() !== '').map(it => ({
                 ...it,
                 quantity: Number(it.quantity) || 0,
                 purchasePrice: Number(it.purchasePrice) || 0,
                 sellingPrice: Number(it.sellingPrice) || 0,
                 total: Number(it.total) || 0
               })),
               totalPurchaseValue,
               totalSellingValue,
               notes
             }, updateGlobalPrices);
           }} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
             Ruaj Flethyrjen
           </button>
        </div>
      </div>
    </div>
  );
};

export default StockEntryGenerator;
