
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, Item, Invoice, InvoiceItem } from '../types';
import { Plus, Hash, Trash2, CheckCircle2, Calculator, RotateCcw, CheckCheck, MessageSquareText, MapPin, Coins, Wallet, X, Users, Search, ChevronDown, Box, Package, Tag, ArrowRight, PackageSearch, Save, Clock } from 'lucide-react';
import { loadData, saveData, STORAGE_KEYS, clearData } from '../utils/storage';

interface Props {
  clients: Client[];
  items: Item[];
  invoices: Invoice[];
  onSubmit: (invoice: Invoice) => void;
  onCancel: () => void;
  onAddItem?: (item: Item) => void;
  initialData?: Invoice | null;
  defaultInvoiceNumber?: string;
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y}`;
};

const InvoiceGenerator: React.FC<Props> = ({ clients, items, invoices, onSubmit, onCancel, onAddItem, initialData, defaultInvoiceNumber }) => {
  const [clientName, setClientName] = useState(initialData?.clientName || '');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialData?.clientId || null);
  const [clientCity, setClientCity] = useState(initialData?.clientCity || '');
  const [shipTo, setShipTo] = useState(initialData?.clientPhone || '');
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber || `5507`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-CA') + 'T' + new Date().toTimeString().split(' ')[0]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [currency, setCurrency] = useState<'Lek' | 'EUR'>('Lek');
  const [previousBalance, setPreviousBalance] = useState<number | string>(0);
  const [amountPaid, setAmountPaid] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  
  const [prevBalanceLabel, setPrevBalanceLabel] = useState('Gjendja (+)');
  const [amountPaidLabel, setAmountPaidLabel] = useState('Paguar (-)');
  
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const draftDataRef = useRef<any>(null);

  const [activeItemSearchIdx, setActiveItemSearchIdx] = useState<number | null>(null);
  const [highlightedItemIdx, setHighlightedItemIdx] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const [isClientSearchActive, setIsClientSearchActive] = useState(false);
  const [highlightedClientIdx, setHighlightedClientIdx] = useState(0);
  const [quickAddItem, setQuickAddItem] = useState<{ name: string; idx: number } | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({ unit: 'copë', price: 0, purchasePrice: 0 });

  const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const itemInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (activeItemSearchIdx !== null) {
      const el = itemInputRefs.current[activeItemSearchIdx];
      if (el) {
        const rect = el.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(500, rect.width) });
      }
    } else {
      setDropdownPos(null);
    }
  }, [activeItemSearchIdx]);

  // Funksioni për të krijuar objektin e draftit
  const getCurrentDraftData = () => ({
    clientName,
    clientId: selectedClientId,
    clientCity,
    clientPhone: shipTo,
    items: invoiceItems.filter(i => i.name.trim() !== '' || i.quantity > 0),
    invoiceNumber,
    date: invoiceDate,
    previousBalance,
    amountPaid,
    currency,
    previousBalanceLabel: prevBalanceLabel,
    amountPaidLabel: amountPaidLabel,
    notes
  });

  // 1. Ngarkimi Fillestar (Initial Load / Load Draft)
  useEffect(() => {
    if (initialData) {
      setClientName(initialData.clientName);
      setSelectedClientId(initialData.clientId);
      setClientCity(initialData.clientCity || '');
      setInvoiceItems(initialData.items);
      setInvoiceNumber(initialData.invoiceNumber);
      setInvoiceDate(initialData.date);
      setPreviousBalance(initialData.previousBalance || 0);
      setAmountPaid(initialData.amountPaid || 0);
      setShipTo(initialData.clientPhone || '');
      setCurrency(initialData.currency || 'Lek');
      setPrevBalanceLabel(initialData.previousBalanceLabel || 'Gjendja (+)');
      setAmountPaidLabel(initialData.amountPaidLabel || 'Paguar (-)');
      setNotes(initialData.notes || '');
    } else {
      const draft = loadData<any>(STORAGE_KEYS.DRAFT, null);
      if (draft && !isDraftLoaded) {
        setClientName(draft.clientName || '');
        setSelectedClientId(draft.clientId || null);
        setClientCity(draft.clientCity || '');
        setInvoiceItems(draft.items?.length > 0 ? draft.items : [{ itemId: 'm-' + Date.now(), name: '', quantity: 0, price: 0, total: 0 }]);
        setInvoiceNumber(draft.invoiceNumber || defaultInvoiceNumber || "5507");
        setInvoiceDate(draft.date || (new Date().toLocaleDateString('en-CA') + 'T' + new Date().toTimeString().split(' ')[0]));
        setPreviousBalance(draft.previousBalance || 0);
        setAmountPaid(draft.amountPaid || 0);
        setShipTo(draft.clientPhone || '');
        setCurrency(draft.currency || 'Lek');
        setPrevBalanceLabel(draft.previousBalanceLabel || 'Gjendja (+)');
        setAmountPaidLabel(draft.amountPaidLabel || 'Paguar (-)');
        setNotes(draft.notes || '');
        setIsDraftLoaded(true);
        setLastSaved("Draft i rikuperuar");
      } else {
        if (defaultInvoiceNumber) setInvoiceNumber(defaultInvoiceNumber);
        if (invoiceItems.length === 0) setInvoiceItems([{ itemId: 'm-' + Date.now(), name: '', quantity: 0, price: 0, total: 0 }]);
      }
    }
  }, [initialData, defaultInvoiceNumber]);

  // 2. Ruajtja e të dhënave aktuale në Ref për t'u përdorur te cleanup
  useEffect(() => {
    if (!initialData) {
      draftDataRef.current = getCurrentDraftData();
    }
  }, [
    clientName, selectedClientId, clientCity, shipTo, invoiceItems, 
    invoiceNumber, invoiceDate, previousBalance, amountPaid, 
    currency, prevBalanceLabel, amountPaidLabel, notes, initialData
  ]);

  // 3. Ruajtja e draftit VETËM kur komponenti çmontohet (navigimi larg pa ruajtur)
  useEffect(() => {
    return () => {
      // Ruajmë draftin vetëm nëse nuk jemi duke bërë submit dhe nuk është editim i një fature ekzistuese
      if (!initialData && !isSubmittingRef.current) {
        const data = draftDataRef.current;
        if (data && (data.clientName.trim() !== '' || data.items.some((i: any) => i.name.trim() !== ''))) {
          saveData(STORAGE_KEYS.DRAFT, data);
        }
      }
    };
  }, [initialData]);

  useEffect(() => {
    if (selectedClientId && !initialData) {
      const clientInvoices = invoices
        .filter(inv => inv.clientId === selectedClientId && inv.status !== 'Anuluar')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (clientInvoices.length > 0) {
        const last = clientInvoices[0];
        setPreviousBalance((last.subtotal + (last.previousBalance || 0)) - (last.amountPaid || 0));
      } else {
        setPreviousBalance(0);
      }
    }
  }, [selectedClientId, invoices, initialData]);

  const subtotal = useMemo(() => invoiceItems.reduce((sum, item) => sum + item.total, 0), [invoiceItems]);
  const prevBalNum = typeof previousBalance === 'string' ? (parseFloat(previousBalance) || 0) : previousBalance;
  const paidNum = typeof amountPaid === 'string' ? (parseFloat(amountPaid) || 0) : amountPaid;
  const grandTotal = subtotal + prevBalNum;
  const balanceDue = grandTotal - paidNum;
  const isSurplus = balanceDue < 0;

  const matchesFuzzy = (target: string, query: string) => {
    const qRaw = query.toLowerCase().trim();
    if (!qRaw) return true;
    const targetLower = target.toLowerCase();
    const queryParts = qRaw.split(/\s+/).filter(p => p.length > 0);
    return queryParts.every(part => targetLower.includes(part));
  };

  const filteredClients = useMemo(() => {
    if (!clientName.trim() || selectedClientId) return [];
    return clients.filter(c => matchesFuzzy(`${c.name} ${c.city || ''}`, clientName)).slice(0, 10);
  }, [clients, clientName, selectedClientId]);

  const selectClient = (client: Client) => {
    setClientName(client.name);
    setSelectedClientId(client.id);
    setClientCity(client.city || '');
    setShipTo(client.address || client.city || '');
    setIsClientSearchActive(false);
  };

  const updateItem = (idx: number, updates: Partial<InvoiceItem>) => {
    setInvoiceItems(prev => prev.map((ii, i) => {
      if (i === idx) {
        const newItem = { ...ii, ...updates };
        const q = updates.quantity !== undefined ? (Number(updates.quantity) || 0) : ii.quantity;
        const p = updates.price !== undefined ? (Number(updates.price) || 0) : ii.price;
        newItem.total = q * p;
        return newItem;
      }
      return ii;
    }));
  };

  const removeItem = (idx: number) => {
    if (invoiceItems.length === 1) {
      setInvoiceItems([{ itemId: 'm-' + Date.now(), name: '', quantity: 0, price: 0, total: 0 }]);
    } else {
      setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));
    }
  };

  const selectItemForInvoice = (idx: number, item: Item) => {
    let price = item.price;
    if (selectedClientId) {
      const pref = item.preferentialPrices?.find(p => p.clientId === selectedClientId);
      if (pref) price = pref.price;
    }
    updateItem(idx, { itemId: item.id, name: item.name, price });
    setActiveItemSearchIdx(null);
    setTimeout(() => {
        qtyInputRefs.current[idx]?.focus();
        qtyInputRefs.current[idx]?.select();
    }, 50);
  };

  const addRow = () => {
    setInvoiceItems([...invoiceItems, { itemId: 'm-' + Date.now(), name: '', quantity: 0, price: 0, total: 0 }]);
    const nextIdx = invoiceItems.length;
    setTimeout(() => itemInputRefs.current[nextIdx]?.focus(), 50);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const filtered = items.filter(i => matchesFuzzy(i.name, invoiceItems[idx].name)).slice(0, 10);
    
    if (activeItemSearchIdx === idx && filtered.length > 0 && invoiceItems[idx].name.trim() !== '') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedItemIdx(prev => (prev + 1) % filtered.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedItemIdx(prev => (prev - 1 + filtered.length) % filtered.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectItemForInvoice(idx, filtered[highlightedItemIdx]);
        return;
      } else if (e.key === 'Escape') {
        setActiveItemSearchIdx(null);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.key === 'Enter') {
          qtyInputRefs.current[idx]?.focus();
          qtyInputRefs.current[idx]?.select();
      } else {
        if (idx < invoiceItems.length - 1) {
          itemInputRefs.current[idx + 1]?.focus();
        } else if (invoiceItems[idx].name.trim() !== '') {
          addRow();
        }
      }
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      itemInputRefs.current[idx - 1]?.focus();
    }
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent, idx: number, type: 'qty' | 'price') => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (e.key === 'ArrowUp') {
        itemInputRefs.current[idx]?.focus();
      } else if (e.key === 'ArrowDown') {
        if (idx < invoiceItems.length - 1) {
          itemInputRefs.current[idx + 1]?.focus();
        } else if (invoiceItems[idx].name.trim() !== '') {
          addRow();
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'qty') {
        priceInputRefs.current[idx]?.focus();
        priceInputRefs.current[idx]?.select();
      } else {
        if (idx < invoiceItems.length - 1) {
          itemInputRefs.current[idx + 1]?.focus();
        } else if (invoiceItems[idx].name.trim() !== '') {
          addRow();
        }
      }
    }
  };

  const handleClientKeyDown = (e: React.KeyboardEvent) => {
    if (isClientSearchActive && filteredClients.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedClientIdx(prev => (prev + 1) % filteredClients.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedClientIdx(prev => (prev - 1 + filteredClients.length) % filteredClients.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectClient(filteredClients[highlightedClientIdx]);
      } else if (e.key === 'Escape') {
        setIsClientSearchActive(false);
      }
    }
  };

  const handleSaveInvoice = (isPaid: boolean = false) => {
    if (!clientName.trim()) return alert("Vendosni emrin e klientit.");
    
    // Aktivizojmë flagun e dorëzimit që të ndalojmë ruajtjen e draftit gjatë unmount
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const finalSubtotal = Number(subtotal) || 0;
    const finalPrevBal = Number(prevBalNum) || 0;
    const finalPaid = isPaid ? (finalSubtotal + finalPrevBal) : (Number(paidNum) || 0);
    const finalBalanceDue = finalSubtotal + finalPrevBal - finalPaid;
    
    // Pastrojmë draftin menjëherë nga memorie
    clearData(STORAGE_KEYS.DRAFT);

    onSubmit({
      id: initialData?.id || Date.now().toString(),
      invoiceNumber, 
      date: invoiceDate, 
      clientId: selectedClientId || 'manual', 
      clientName, 
      clientCity, 
      clientPhone: shipTo,
      items: invoiceItems.filter(i => i.name.trim() !== ''), 
      currency, 
      subtotal: finalSubtotal, 
      tax: 0,
      previousBalance: finalPrevBal, 
      previousBalanceLabel: prevBalanceLabel, 
      amountPaid: finalPaid, 
      amountPaidLabel,
      total: finalSubtotal, 
      status: (finalBalanceDue <= 0 || isPaid) ? 'E paguar' as const : 'Pa paguar' as const, 
      notes: notes.trim() || undefined
    });
  };

  const handleClearForm = () => {
    if(confirm("A jeni i sigurt që dëshironi të fshini të gjitha të dhënat e kësaj fature?")) { 
      clearData(STORAGE_KEYS.DRAFT); 
      setClientName('');
      setSelectedClientId(null);
      setClientCity('');
      setShipTo('');
      setInvoiceItems([{ itemId: 'm-' + Date.now(), name: '', quantity: 0, price: 0, total: 0 }]);
      setPreviousBalance(0);
      setAmountPaid(0);
      setNotes('');
      setLastSaved(null);
    }
  };

  return (
    <>
    <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 shadow-xl min-h-screen relative animate-in fade-in duration-300">
      {/* Header Fature */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 md:mb-12 gap-6">
        <div className="w-full md:w-1/2">
           <div className="border-l-4 border-[#D81B60] bg-slate-50 p-4 md:p-6 rounded-r-lg">
              <p className="font-black text-slate-800 uppercase tracking-tighter text-lg md:text-xl">Intal Albania</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-slate-600 text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} className="text-slate-400" /> Faturë: {formatDateDisplay(invoiceDate)}
                </p>
                {lastSaved && !initialData && (
                   <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-100 shadow-sm animate-pulse">
                     <Save size={10} /> {lastSaved}
                   </span>
                )}
              </div>
           </div>
        </div>
        <div className="w-full md:text-right flex flex-col items-start md:items-end gap-3">
          <div className="flex items-center gap-3 w-full justify-between md:justify-end">
            <button onClick={handleClearForm} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"><RotateCcw size={14} /> PASTRO</button>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">Faturë</h1>
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setCurrency('Lek')} 
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${currency === 'Lek' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Lek
              </button>
              <button 
                onClick={() => setCurrency('EUR')} 
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${currency === 'EUR' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                EUR
              </button>
            </div>
            
            <div className="inline-flex items-center bg-slate-900 rounded-lg overflow-hidden h-10">
               <div className="bg-slate-800 px-3 flex items-center h-full text-slate-400"><Hash size={14} /></div>
               <input className="px-3 py-2 w-20 md:w-32 text-right outline-none font-black text-white bg-slate-900 text-sm" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Seksioni Klienti */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 mb-8">
        <div className="md:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">Klienti {selectedClientId && <CheckCircle2 size={12} className="text-emerald-500" />}</label>
              <textarea 
                className={`w-full p-4 border-2 rounded-xl outline-none h-20 md:h-24 resize-none text-sm font-bold transition-all ${selectedClientId ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 focus:border-indigo-500'}`} 
                placeholder="Emri i klientit..." 
                value={clientName} 
                onChange={e => { setClientName(e.target.value); if (selectedClientId) setSelectedClientId(null); setIsClientSearchActive(true); }} 
                onFocus={() => setIsClientSearchActive(true)}
                onKeyDown={handleClientKeyDown}
              />
              {isClientSearchActive && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 w-full min-w-[320px] bg-white border-2 border-indigo-600 shadow-2xl z-[9999] rounded-2xl mt-2 py-2 animate-in fade-in duration-200">
                  <div className="px-4 py-2 border-b border-slate-100 mb-1 flex items-center gap-2">
                    <Users size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Zgjidh Klientin</span>
                  </div>
                  {filteredClients.map((c, idx) => (
                    <button key={c.id} onMouseDown={() => selectClient(c)} onMouseEnter={() => setHighlightedClientIdx(idx)} className={`w-full text-left px-5 py-3 flex flex-col transition-all border-l-4 ${highlightedClientIdx === idx ? 'bg-indigo-600 text-white border-white' : 'hover:bg-slate-50 border-transparent'}`}>
                      <span className="text-sm font-black uppercase tracking-tight">{c.name}</span>
                      <span className={`text-[10px] font-bold uppercase ${highlightedClientIdx === idx ? 'text-indigo-100' : 'text-slate-400'}`}>{c.city || '---'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kontakti</label>
              <textarea className="w-full p-4 border-2 border-slate-100 rounded-xl outline-none h-20 md:h-24 resize-none text-sm focus:border-indigo-500 transition-all" value={shipTo} onChange={e => setShipTo(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="md:col-span-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</label>
           <input type="date" className="w-full bg-transparent text-sm font-bold outline-none h-10 cursor-pointer" value={invoiceDate.split('T')[0]} onChange={e => setInvoiceDate(`${e.target.value}T00:00:00`)} />
        </div>
      </div>

      {/* Tabela e Artikujve */}
      <div className="mb-6 relative">
        <div className="overflow-x-auto overflow-y-visible pb-4 custom-scrollbar">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-12 bg-slate-900 text-white py-4 px-6 rounded-t-xl text-[10px] font-black uppercase tracking-widest relative z-[2]">
              <div className="col-span-6">Artikulli</div>
              <div className="col-span-2 text-center">Sasia</div>
              <div className="col-span-2 text-center">Çmimi ({currency === 'EUR' ? '€' : 'L'})</div>
              <div className="col-span-1.5 text-right flex-1 text-right">Shuma</div>
              <div className="col-span-0.5 text-right"></div>
            </div>
            <div className="border-x border-b border-slate-100 rounded-b-xl divide-y divide-slate-100 bg-white relative z-[20]">
               {invoiceItems.map((item, idx) => (
                 <div key={idx} className={`grid grid-cols-12 px-4 py-3 md:px-6 items-center gap-4 relative transition-all group ${activeItemSearchIdx === idx ? 'z-[1000] bg-indigo-50/10' : 'z-0 hover:bg-slate-50/50'}`}>
                    <div className="col-span-6 relative">
                      <div className={`px-1 py-1 border-b-2 transition-all ${activeItemSearchIdx === idx ? 'border-indigo-600' : 'border-transparent'}`}>
                        <input 
                          ref={el => { itemInputRefs.current[idx] = el; }}
                          className="w-full text-sm font-black outline-none uppercase bg-transparent placeholder:text-slate-300 placeholder:font-normal" 
                          value={item.name} 
                          onChange={e => { updateItem(idx, { name: e.target.value }); setActiveItemSearchIdx(idx); setHighlightedItemIdx(0); }} 
                          onFocus={(e) => { setActiveItemSearchIdx(idx); (e.target as HTMLInputElement).select(); }}
                          onBlur={() => setTimeout(() => { if (activeItemSearchIdx === idx) setActiveItemSearchIdx(null); }, 200)}
                          onKeyDown={e => handleItemKeyDown(e, idx)}
                          placeholder="Kërko artikullin..." 
                        />
                      </div>

                      {activeItemSearchIdx === idx && item.name.trim() !== '' && dropdownPos && (
                        <div style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999999 }} className="bg-white border-2 border-indigo-600 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-2xl py-2 overflow-hidden ring-4 ring-indigo-600/10 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
                          <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <PackageSearch size={14} className="text-indigo-600" />
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Zgjidh Artikullin</span>
                             </div>
                             <span className="text-[9px] font-bold text-indigo-400 uppercase">Shtyp Enter për të zgjedhur</span>
                          </div>
                          
                          <div className="flex flex-col max-h-[350px] overflow-y-auto custom-scrollbar">
                            {items.filter(i => matchesFuzzy(i.name, item.name)).slice(0, 15).map((i, sIdx) => (
                              <button 
                                key={i.id} 
                                onMouseDown={(e) => { e.preventDefault(); selectItemForInvoice(idx, i); }} 
                                onMouseEnter={() => setHighlightedItemIdx(sIdx)} 
                                className={`w-full text-left px-5 py-3 flex justify-between items-center transition-all border-b border-slate-50 last:border-none ${highlightedItemIdx === sIdx ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                              >
                                <div className="flex flex-col">
                                   <span className="text-sm font-black uppercase truncate tracking-tight">{i.name}</span>
                                   <span className={`text-[10px] font-bold uppercase ${highlightedItemIdx === sIdx ? 'text-indigo-200' : 'text-slate-400'}`}>{i.unit}</span>
                                </div>
                                <div className="text-right">
                                   <p className={`text-[9px] font-bold uppercase ${highlightedItemIdx === sIdx ? 'text-indigo-200' : 'text-slate-400'}`}>Çmimi</p>
                                   <p className={`text-sm font-black whitespace-nowrap ${highlightedItemIdx === sIdx ? 'text-white' : 'text-indigo-600'}`}>
                                      {i.price.toLocaleString()} L
                                   </p>
                                </div>
                              </button>
                            ))}
                          </div>
                          
                          {items.filter(i => matchesFuzzy(i.name, item.name)).length === 0 && (
                            <div className="px-4 py-6 text-center bg-slate-50/50 space-y-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Ky artikull nuk ekziston</p>
                              {onAddItem && (
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); setQuickAddItem({ name: item.name, idx }); setQuickAddForm({ unit: 'copë', price: 0, purchasePrice: 0 }); setActiveItemSearchIdx(null); }}
                                  className="flex items-center gap-2 mx-auto bg-[#D81B60] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#AD1457] transition-all"
                                >
                                  <Plus size={14} /> Ta shtojmë?
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 px-2">
                      <input 
                        ref={el => { qtyInputRefs.current[idx] = el; }}
                        type="number" 
                        className="w-full text-center font-black outline-none bg-slate-50 rounded-lg py-1 border-b-2 border-transparent focus:border-indigo-400 transition-all shadow-inner" 
                        value={item.quantity === 0 ? '' : item.quantity} 
                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                        onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} 
                        onKeyDown={(e) => handleNumericKeyDown(e, idx, 'qty')}
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-2 px-2">
                        <input 
                          ref={el => { priceInputRefs.current[idx] = el; }}
                          type="number" 
                          className="w-full text-center font-black text-indigo-600 outline-none bg-indigo-50/50 rounded-lg py-1 border-b-2 border-transparent focus:border-indigo-400 transition-all shadow-inner" 
                          value={item.price === 0 ? '' : item.price} 
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          onChange={e => updateItem(idx, { price: parseFloat(e.target.value) || 0 })} 
                          onKeyDown={(e) => handleNumericKeyDown(e, idx, 'price')}
                          placeholder="0.00"
                        />
                    </div>

                    <div className="col-span-1.5 text-right font-black text-slate-900 text-sm flex-1">
                      {item.total.toLocaleString()}
                    </div>
                    <div className="col-span-0.5 text-right">
                      <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-200 hover:text-rose-500 transition-all active:scale-90">
                        <Trash2 size={16} />
                      </button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kontrollet dhe Permbledhja */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-10 relative z-[1] pb-24">
        
        <div className="flex-1 w-full space-y-6">
           <button 
             onClick={addRow} 
             className="flex items-center gap-2 px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase text-xs hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
           >
             <Plus size={18} strokeWidth={3} /> Shto Rresht të Ri
           </button>

           <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <MessageSquareText size={16} className="text-[#D81B60]" /> Shënime për këtë faturë
              </label>
              <textarea 
                className="w-full h-32 bg-white border border-slate-200 rounded-2xl p-4 outline-none text-sm font-medium focus:border-[#D81B60] transition-all shadow-sm resize-none" 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Shkruaj shënime shtesë këtu..." 
              />
           </div>
        </div>
        
        <div className="w-full md:w-[420px] bg-white p-10 rounded-[48px] border border-slate-200 shadow-2xl space-y-8 relative overflow-hidden shrink-0">
           <div className="absolute -right-12 -top-12 bg-slate-50 w-48 h-48 rounded-full blur-3xl opacity-50"></div>
           <div className="flex items-center gap-3 text-[#D81B60] relative z-10">
              <Calculator size={24} strokeWidth={3} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Llogaritja Finale</h3>
           </div>
           
           <div className="space-y-6 relative z-10">
              <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center text-xs font-black uppercase border border-slate-100">
                <span className="text-slate-400 tracking-widest">Nëntotali:</span>
                <span className="text-slate-900 text-base">{subtotal.toLocaleString()} {currency === 'EUR' ? '€' : 'L'}</span>
              </div>
              
              <div className="bg-amber-50/50 p-6 rounded-3xl space-y-2 border border-amber-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <Coins size={16} className="text-amber-600" />
                  <input className="bg-transparent border-none text-[10px] font-black text-amber-600 uppercase outline-none w-full" value={prevBalanceLabel} onChange={e => setPrevBalanceLabel(e.target.value)} />
                </div>
                <input type="number" className="w-full bg-white px-5 py-4 rounded-2xl font-black text-amber-700 outline-none text-lg shadow-inner border border-amber-100 focus:border-amber-400 transition-all" value={previousBalance} onFocus={(e) => (e.target as HTMLInputElement).select()} onChange={e => setPreviousBalance(e.target.value)} />
              </div>
              
              <div className="bg-emerald-50/50 p-6 rounded-3xl space-y-2 border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-emerald-600" />
                  <input className="bg-transparent border-none text-[10px] font-black text-emerald-600 uppercase outline-none w-full" value={amountPaidLabel} onChange={e => setAmountPaidLabel(e.target.value)} />
                </div>
                <input type="number" className="w-full bg-white px-5 py-4 rounded-2xl font-black text-emerald-700 outline-none text-lg shadow-inner border border-emerald-100 focus:border-emerald-400 transition-all" value={amountPaid} onFocus={(e) => (e.target as HTMLInputElement).select()} onChange={e => setAmountPaid(e.target.value)} />
              </div>
              
              <div className={`p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden transition-all duration-500 transform hover:scale-[1.02] ${isSurplus ? 'bg-amber-500 border-b-8 border-amber-700' : 'bg-slate-900 border-b-8 border-rose-600'}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   {isSurplus ? <Coins size={80} /> : <Calculator size={80} />}
                </div>
                <div className="relative z-10">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80 mb-3 block">{isSurplus ? 'TEPRICA NË FAVOR' : 'DETYRIMI PËRFUNDIMTAR'}</span>
                  <div className="flex justify-baseline gap-2 items-baseline">
                     <span className="text-5xl font-black tracking-tighter">{Math.abs(balanceDue).toLocaleString()}</span>
                     <span className="text-sm font-black opacity-50 uppercase tracking-widest">{currency === 'EUR' ? 'EUR' : 'LEK'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <button 
                  onClick={() => handleSaveInvoice(false)} 
                  className="w-full bg-[#D81B60] hover:bg-[#AD1457] text-white py-8 rounded-[40px] font-black uppercase tracking-[0.15em] shadow-xl shadow-[#D81B60]/20 flex items-center justify-center gap-4 transition-all active:scale-95 group"
                >
                  <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform" /> Ruaj Faturën
                </button>
                <button 
                  onClick={() => handleSaveInvoice(true)} 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-8 rounded-[40px] font-black uppercase tracking-[0.15em] shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-4 transition-all active:scale-95 group"
                >
                  <CheckCheck size={24} className="group-hover:scale-110 transition-transform" /> Ruaj si të Paguar
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
    {/* Quick-add artikull */}
    {quickAddItem && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#D81B60]/10 p-2 rounded-xl"><Package size={20} className="text-[#D81B60]" /></div>
            <div>
              <h3 className="font-black text-slate-900 uppercase text-sm">Shto Artikull të Ri</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Artikulli nuk është i regjistruar</p>
            </div>
          </div>
          <div className="bg-slate-50 px-4 py-3 rounded-xl">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Emri</p>
            <p className="font-black text-slate-900 uppercase text-sm">{quickAddItem.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Njësia</label>
              <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none" value={quickAddForm.unit} onChange={e => setQuickAddForm(f => ({ ...f, unit: e.target.value }))}>
                <option value="copë">Copë</option>
                <option value="kg">Kg</option>
                <option value="litër">Litër</option>
                <option value="pako">Pako</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kosto Blerje</label>
              <input type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none" value={quickAddForm.purchasePrice || ''} onChange={e => setQuickAddForm(f => ({ ...f, purchasePrice: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Çmimi i Shitjes (Lek)</label>
            <input type="number" step="0.01" autoFocus className="w-full p-3 bg-slate-50 border-2 border-[#D81B60]/30 focus:border-[#D81B60] rounded-xl font-black text-lg text-emerald-600 outline-none transition-all" value={quickAddForm.price || ''} onChange={e => setQuickAddForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} placeholder="0" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setQuickAddItem(null)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all">Anulo</button>
            <button
              onClick={() => {
                if (!quickAddItem || !onAddItem) return;
                const newItem: Item = { id: Date.now().toString(), name: quickAddItem.name, unit: quickAddForm.unit, price: quickAddForm.price, purchasePrice: quickAddForm.purchasePrice, preferentialPrices: [] };
                onAddItem(newItem);
                selectItemForInvoice(quickAddItem.idx, newItem);
                setQuickAddItem(null);
              }}
              className="flex-1 bg-[#D81B60] text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#AD1457] transition-all"
            >
              Shto &amp; Zgjidh
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default InvoiceGenerator;
