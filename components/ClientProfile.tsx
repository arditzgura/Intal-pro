
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Client, Invoice, Item, PreferentialPrice } from '../types';
import { X, FileText, Package, TrendingUp, Download, Calendar, CalendarDays, DollarSign, Tag, ArrowRight, Info, Star, MapPin, Clock, BarChart3, Calculator, Wallet, CheckCircle2, ChevronRight, Landmark, History, PieChart, TrendingUp as ProfitIcon, Phone, Mail, Home, Search, Box, Plus, Trash2, ArrowDownWideNarrow, PlusCircle, Filter, ArrowLeft, UserCircle2 } from 'lucide-react';
import { exportClientAnalysisToExcel } from '../utils/exportUtils';

interface Props {
  client: Client;
  invoices: Invoice[];
  items: Item[];
  onUpdateItems: (newItems: Item[]) => void;
  onUpdateClient: (updatedClient: Client) => void;
  onClose: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onNewInvoice: (client: Client) => void;
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const ClientProfile: React.FC<Props> = ({ client, invoices, items, onUpdateItems, onUpdateClient, onClose, onViewInvoice, onNewInvoice }) => {
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateClient({ ...client, photo: reader.result as string });
    reader.readAsDataURL(file);
  };
  const [activeTab, setActiveTab] = useState<'overview' | 'prices' | 'profile'>('overview');
  const [profileForm, setProfileForm] = useState({ name: client.name, city: client.city || '', phone: client.phone || '', email: client.email || '', address: client.address || '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'day' | 'month' | 'year'>('year');
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [itemSortBy, setItemSortBy] = useState<'value' | 'qty' | 'profit'>('value');

  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItemForPref, setSelectedItemForPref] = useState<Item | null>(null);
  const [prefPrice, setPrefPrice] = useState<number | ''>('');
  const itemSearchRef = useRef<HTMLInputElement | null>(null);
  const [itemDropdownPos, setItemDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    invoices.forEach(i => years.add(i.date.slice(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const getConvVal = (val: number, curr?: string) => curr === 'EUR' ? val * 100 : val;

  const filteredInvoices = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const checkPeriod = (date: string) => {
      const d = date.slice(0, 10);
      if (filterMode === 'all') return true;
      if (filterMode === 'today') return d === todayStr;
      if (filterMode === 'day') return d === selectedDay;
      if (filterMode === 'month') return date.slice(0, 7) === selectedMonth;
      return date.slice(0, 4) === selectedYear;
    };
    return invoices.filter(inv => inv.clientId === client.id && inv.status !== 'Anuluar' && checkPeriod(inv.date))
                   .sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, client.id, filterMode, selectedDay, selectedMonth, selectedYear]);

  const periodStats = useMemo(() => {
    const spent = filteredInvoices.reduce((sum, inv) => sum + getConvVal(inv.total, inv.currency), 0);
    
    // Arketimet llogariten sipas datës së pagesës (paymentDate)
    const paid = invoices.reduce((sum, inv) => {
      if (inv.clientId !== client.id || inv.status !== 'E paguar' || inv.status === 'Anuluar') return sum;
      
      const pDate = (inv.paymentDate || inv.date).slice(0, 10);
      const todayStr = new Date().toLocaleDateString('en-CA');
      let isInPeriod = false;

      if (filterMode === 'all') isInPeriod = true;
      else if (filterMode === 'today') isInPeriod = pDate === todayStr;
      else if (filterMode === 'day') isInPeriod = pDate === selectedDay;
      else if (filterMode === 'month') isInPeriod = pDate.slice(0, 7) === selectedMonth;
      else if (filterMode === 'year') isInPeriod = pDate.slice(0, 4) === selectedYear;

      if (isInPeriod) {
        return sum + getConvVal(inv.amountPaid || 0, inv.currency);
      }
      return sum;
    }, 0);

    return { spent, paid, balance: spent - paid };
  }, [filteredInvoices, invoices, client.id, filterMode, selectedDay, selectedMonth, selectedYear]);

  const globalStats = useMemo(() => {
    const clientInvoices = invoices.filter(inv => inv.clientId === client.id && inv.status !== 'Anuluar')
                                   .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const totalSpent = clientInvoices.reduce((sum, inv) => sum + getConvVal(inv.total, inv.currency), 0);
    const totalPaid = clientInvoices.reduce((sum, inv) => sum + getConvVal(inv.amountPaid || 0, inv.currency), 0);
    
    // Logjika e re: Detyrimi mbetur merret vetem nga fatura e fundit ( Rolling Balance )
    let balance = 0;
    if (clientInvoices.length > 0) {
      const latest = clientInvoices[0];
      const balDue = (latest.subtotal + (latest.previousBalance || 0)) - (latest.amountPaid || 0);
      balance = getConvVal(balDue, latest.currency);
    }

    return { totalSpent, totalPaid, balance };
  }, [invoices, client.id]);

  const itemSummary = useMemo(() => {
    const summaryMap: Record<string, any> = {};
    filteredInvoices.forEach(inv => {
      inv.items.forEach(itemPart => {
        const globalItem = items.find(i => i.name === itemPart.name || i.id === itemPart.itemId);
        const purchasePrice = Number(globalItem?.purchasePrice || 0);
        const sellPriceLek = getConvVal(itemPart.price, inv.currency);
        const qty = Number(itemPart.quantity);
        const profitPerUnit = sellPriceLek - purchasePrice;

        if (!summaryMap[itemPart.name]) {
          summaryMap[itemPart.name] = { name: itemPart.name, totalQty: 0, totalValue: 0, totalProfit: 0 };
        }
        summaryMap[itemPart.name].totalQty += qty;
        summaryMap[itemPart.name].totalValue += getConvVal(itemPart.total, inv.currency);
        summaryMap[itemPart.name].totalProfit += (profitPerUnit * qty);
      });
    });

    let result = Object.values(summaryMap);
    return result.sort((a:any, b:any) => {
      if (itemSortBy === 'qty') return b.totalQty - a.totalQty;
      if (itemSortBy === 'profit') return b.totalProfit - a.totalProfit;
      return b.totalValue - a.totalValue;
    });
  }, [filteredInvoices, items, itemSortBy]);

  const clientPreferentialPrices = useMemo(() => {
    return items.filter(i => i.preferentialPrices?.some(p => p.clientId === client.id))
                .map(i => ({ item: i, price: i.preferentialPrices!.find(p => p.clientId === client.id)!.price }));
  }, [items, client.id]);

  const filteredItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return [];
    return items.filter(i => i.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).slice(0, 5);
  }, [items, itemSearchQuery]);

  useEffect(() => {
    if (filteredItems.length > 0 && itemSearchRef.current) {
      const rect = itemSearchRef.current.getBoundingClientRect();
      setItemDropdownPos({ top: rect.bottom + 12, left: rect.left, width: rect.width });
    } else {
      setItemDropdownPos(null);
    }
  }, [filteredItems.length]);

  const addOrUpdatePrefPrice = () => {
    if (!selectedItemForPref || prefPrice === '') return;
    const newItems = items.map(i => {
      if (i.id === selectedItemForPref.id) {
        const otherPrefs = i.preferentialPrices?.filter(p => p.clientId !== client.id) || [];
        return { ...i, preferentialPrices: [...otherPrefs, { clientId: client.id, price: Number(prefPrice) }] };
      }
      return i;
    });
    onUpdateItems(newItems);
    setSelectedItemForPref(null);
    setPrefPrice('');
    setItemSearchQuery('');
  };

  const removePrefPrice = (itemId: string) => {
    const newItems = items.map(i => {
      if (i.id === itemId) {
        return { ...i, preferentialPrices: i.preferentialPrices?.filter(p => p.clientId !== client.id) || [] };
      }
      return i;
    });
    onUpdateItems(newItems);
  };

  const monthNames: Record<string, string> = {
    '01': 'Janar', '02': 'Shkurt', '03': 'Mars', '04': 'Prill', '05': 'Maj', '06': 'Qershor',
    '07': 'Korrik', '08': 'Gusht', '09': 'Shtator', '10': 'Tetor', '11': 'Nëntor', '12': 'Dhjetor'
  };

  const getPeriodLabel = () => {
    if (filterMode === 'all') return 'Gjithë Kohës';
    if (filterMode === 'today') return 'Sot';
    if (filterMode === 'day') return selectedDay.split('-').reverse().join('/');
    if (filterMode === 'month') {
        const [y, m] = selectedMonth.split('-');
        return `${monthNames[m]} ${y}`;
    }
    return `Viti ${selectedYear}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[150] flex items-center justify-center p-4">
      <div className="bg-slate-50 w-full max-w-7xl h-[95vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        <div className="bg-white px-10 py-8 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center shrink-0 gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={onClose}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
            >
              <ArrowLeft size={16} /> Mbrapa
            </button>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 text-slate-400 flex items-center justify-center hover:ring-2 hover:ring-indigo-500 transition-all group shrink-0"
              title="Ngarko foto"
            >
              {client.photo
                ? <img src={client.photo} alt={client.name} className="w-full h-full object-cover" />
                : <Landmark size={24} />
              }
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Plus size={18} className="text-white" strokeWidth={3} />
              </div>
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <div>
              <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{client.name}</h2>
              </div>
              <p className="text-[10px] font-black text-slate-400 mt-1 flex items-center gap-4 uppercase"><MapPin size={12}/> {client.city} <Phone size={12}/> {client.phone}</p>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
             <button onClick={() => setActiveTab('overview')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Analitika</button>
             <button onClick={() => setActiveTab('prices')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'prices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Çmimet</button>
             <button onClick={() => setActiveTab('profile')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'profile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Profili</button>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => onNewInvoice(client)} className="bg-[#D81B60] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg shadow-[#D81B60]/20 whitespace-nowrap">Faturë e Re</button>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900"><X size={32} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'overview' ? (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div className="space-y-6">
                 <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="bg-indigo-600 p-2 rounded-xl text-white"><BarChart3 size={18} /></div>
                       <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Filtrimi i Analizës: {getPeriodLabel()}</h3>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
                      {['all', 'today', 'day', 'month', 'year'].map(m => (
                        <button key={m} onClick={() => setFilterMode(m as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${filterMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                          {m === 'all' ? 'Gjithë Kohës' : m === 'today' ? 'Sot' : m === 'day' ? 'Data' : m === 'month' ? 'Muaji' : 'Viti'}
                        </button>
                      ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all">
                      <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign size={80}/></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Faturuar në Periudhë</p>
                      <p className="text-4xl font-black text-slate-900 tracking-tighter">{periodStats.spent.toLocaleString()} <span className="text-sm font-bold opacity-30">L</span></p>
                   </div>
                   <div className="bg-emerald-50/50 p-8 rounded-[40px] border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all">
                      <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><ProfitIcon size={80}/></div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Fitimi Neto nga Ky Klient</p>
                      <p className="text-4xl font-black text-emerald-600 tracking-tighter">{itemSummary.reduce((s,x)=>s+x.totalProfit, 0).toLocaleString()} <span className="text-sm font-bold opacity-30">L</span></p>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={80}/></div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Detyrimi Global Mbetur</p>
                      <p className="text-4xl font-black">{globalStats.balance.toLocaleString()} <span className="text-sm font-bold opacity-30">L</span></p>
                   </div>
                   <div className="bg-white p-8 rounded-[40px] border border-slate-100 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Besnikëria</span>
                        <span className="text-amber-600 font-black text-xs flex items-center gap-1"><Star size={12} fill="currentColor"/> {client.points || 0} PIKË</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                         <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, globalStats.totalSpent > 0 ? (globalStats.totalPaid/globalStats.totalSpent)*100 : 100)}%` }} />
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Kthimi i Pagesave: {Math.min(100, globalStats.totalSpent > 0 ? (globalStats.totalPaid/globalStats.totalSpent)*100 : 100).toFixed(1)}%</p>
                   </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pb-20">
                 <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                       <h4 className="font-black text-[11px] uppercase text-slate-500 flex items-center gap-3">
                         <Package size={18} /> Analiza e Artikujve të Blerë
                       </h4>
                       <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                          <button onClick={()=>setItemSortBy('qty')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${itemSortBy==='qty'?'bg-white text-slate-900 shadow-sm':'text-slate-400'}`}>Sasia</button>
                          <button onClick={()=>setItemSortBy('profit')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${itemSortBy==='profit'?'bg-white text-slate-900 shadow-sm':'text-slate-400'}`}>Fitimi</button>
                          <button onClick={()=>setItemSortBy('value')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${itemSortBy==='value'?'bg-white text-slate-900 shadow-sm':'text-slate-400'}`}>Vlera</button>
                       </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                       <table className="w-full text-left">
                          <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 sticky top-0">
                            <tr><th className="px-8 py-5">Artikulli</th><th className="px-6 py-5 text-center">Sasia Totale</th><th className="px-6 py-5 text-right">Vlera Totale</th><th className="px-8 py-5 text-right">Fitimi Neto</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {itemSummary.map((r,i)=>(
                              <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-8 py-5 font-black text-slate-800 uppercase text-xs group-hover:text-indigo-600 transition-colors">{r.name}</td>
                                <td className="px-6 py-5 text-center font-bold text-slate-600">{r.totalQty.toLocaleString()}</td>
                                <td className="px-6 py-5 text-right font-black text-slate-900">{r.totalValue.toLocaleString()} L</td>
                                <td className="px-8 py-5 text-right font-black text-emerald-600">+{r.totalProfit.toLocaleString()} L</td>
                              </tr>
                            ))}
                            {itemSummary.length === 0 && (
                              <tr><td colSpan={4} className="p-20 text-center text-[10px] font-black text-slate-300 uppercase italic">Asnjë blerje në këtë periudhë</td></tr>
                            )}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-8 bg-slate-50 border-b border-slate-100">
                       <h4 className="font-black text-[11px] uppercase text-slate-500 flex items-center gap-3">
                         <History size={18} /> Historia e Faturimit
                       </h4>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {filteredInvoices.map((inv) => (
                        <div key={inv.id} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between" onClick={() => onViewInvoice(inv)}>
                           <div className="flex-1">
                              <div className="flex items-center gap-3">
                                 <p className="text-xs font-black text-indigo-600">#{inv.invoiceNumber}</p>
                                 <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${inv.status === 'E paguar' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{inv.status}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{formatDateDisplay(inv.date.split('T')[0])}</p>
                                <span className="text-slate-200">/</span>
                                <p className="text-sm font-black text-slate-900">{inv.total.toLocaleString()} L</p>
                              </div>
                           </div>
                           <div className="bg-slate-50 p-3 rounded-xl text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              <ChevronRight size={18} />
                           </div>
                        </div>
                      ))}
                      {filteredInvoices.length === 0 && (
                        <div className="p-20 text-center text-[10px] font-black text-slate-300 uppercase italic">Asnjë faturë e gjetur</div>
                      )}
                    </div>
                 </div>
              </div>
            </div>
          ) : activeTab === 'prices' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
               <div className="bg-indigo-900 rounded-[32px] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-700">
                  <div className="absolute right-0 top-0 p-10 opacity-10"><Tag size={150} /></div>
                  <div className="relative z-10 max-w-2xl">
                     <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Konfigurimi i Çmimeve Preferenciale</h3>
                     <p className="text-indigo-200 text-sm font-medium mb-8 leading-relaxed">Këtu mund t'i caktoni çmime preferenciale këtij klienti për artikuj specifikë. Këto çmime do të aplikohen automatikisht në çdo faturë të re që gjeneroni për <span className="text-white font-black underline">{client.name}</span>.</p>
                     
                     <div className="bg-white/10 p-6 rounded-[32px] border border-white/20 space-y-4 shadow-inner">
                        <div className="relative">
                           <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300" size={20} />
                           <input ref={itemSearchRef} placeholder="Kërko artikullin nga katalogu..." className="w-full pl-14 pr-6 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none font-black text-sm uppercase placeholder:text-indigo-300 focus:bg-white focus:text-slate-900 transition-all shadow-xl" value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} />
                           {filteredItems.length > 0 && itemDropdownPos && (
                             <div style={{ position: 'fixed', top: itemDropdownPos.top, left: itemDropdownPos.left, width: itemDropdownPos.width, zIndex: 9999999 }} className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                {filteredItems.map(i => (
                                  <button key={i.id} onClick={() => { setSelectedItemForPref(i); setItemSearchQuery(''); }} className="w-full text-left p-4 hover:bg-slate-50 flex justify-between items-center group transition-colors border-b border-slate-50 last:border-none">
                                     <div className="flex items-center gap-3">
                                        <Box size={16} className="text-slate-300 group-hover:text-indigo-600" />
                                        <span className="text-xs font-black text-slate-800 uppercase group-hover:text-indigo-600">{i.name}</span>
                                     </div>
                                     <span className="text-[10px] font-black text-slate-400">Standard: {i.price.toLocaleString()} L</span>
                                  </button>
                                ))}
                             </div>
                           )}
                        </div>

                        {selectedItemForPref && (
                          <div className="flex items-center gap-4 animate-in zoom-in-95">
                             <div className="flex-1 bg-white/20 px-8 py-4 rounded-2xl border border-white/30 flex justify-between items-center">
                                <span className="text-xs font-black uppercase tracking-tight">{selectedItemForPref.name}</span>
                                <span className="text-[10px] font-bold opacity-60">Std: {selectedItemForPref.price.toLocaleString()} L</span>
                             </div>
                             <div className="w-36 relative">
                                <input type="number" placeholder="Lek" className="w-full p-4 bg-white border-none rounded-2xl text-slate-900 font-black text-center text-lg outline-none shadow-xl" value={prefPrice} onChange={e => setPrefPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                             </div>
                             <button onClick={addOrUpdatePrefPrice} className="bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center"><Plus size={24} strokeWidth={3} /></button>
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-20">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                     <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-3"><Star size={18}/> Lista e Çmimeve të Caktuara</h4>
                     <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full uppercase">{clientPreferentialPrices.length} Artikuj</span>
                  </div>
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <tr><th className="px-10 py-6">Artikulli</th><th className="px-6 py-6 text-center">Çmimi Standard</th><th className="px-6 py-6 text-center">Çmimi Preferencial</th><th className="px-10 py-6 text-right">Veprime</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {clientPreferentialPrices.map(({ item, price }) => (
                          <tr key={item.id} className="hover:bg-slate-50 group transition-colors">
                             <td className="px-10 py-6 font-black text-slate-800 uppercase text-sm">{item.name}</td>
                             <td className="px-6 py-6 text-center font-bold text-slate-400">{item.price.toLocaleString()} L</td>
                             <td className="px-6 py-6 text-center">
                                <span className="inline-block bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl font-black text-base border border-emerald-100 shadow-sm">
                                   {price.toLocaleString()} L
                                </span>
                             </td>
                             <td className="px-10 py-6 text-right">
                                <button onClick={() => removePrefPrice(item.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button>
                             </td>
                          </tr>
                        ))}
                        {clientPreferentialPrices.length === 0 && (
                          <tr><td colSpan={4} className="px-10 py-32 text-center text-slate-300 font-black uppercase tracking-widest italic text-xs">Nuk keni caktuar asnjë çmim preferencial ende për këtë klient.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          ) : activeTab === 'profile' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 max-w-2xl mx-auto">
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-xl text-white"><UserCircle2 size={18} /></div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Të Dhënat e Klientit</h3>
                </div>

                <div className="p-8 space-y-5">
                  {/* Photo */}
                  <div className="flex items-center gap-6 pb-4 border-b border-slate-100">
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 text-slate-400 flex items-center justify-center hover:ring-2 hover:ring-indigo-500 transition-all group shrink-0"
                    >
                      {client.photo
                        ? <img src={client.photo} alt={client.name} className="w-full h-full object-cover" />
                        : <UserCircle2 size={36} />
                      }
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus size={20} className="text-white" strokeWidth={3} />
                      </div>
                    </button>
                    <div>
                      <p className="text-xs font-black text-slate-700 uppercase">{client.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Kliko foton për të ndërruar</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emri i Plotë</label>
                      <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black uppercase focus:border-indigo-500 transition-all" value={profileForm.name} onChange={e => setProfileForm(f => ({...f, name: e.target.value}))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Phone size={10}/> Telefoni</label>
                        <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black focus:border-indigo-500 transition-all" value={profileForm.phone} onChange={e => setProfileForm(f => ({...f, phone: e.target.value}))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={10}/> Qyteti</label>
                        <input className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black uppercase focus:border-indigo-500 transition-all" value={profileForm.city} onChange={e => setProfileForm(f => ({...f, city: e.target.value}))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Mail size={10}/> Email</label>
                      <input type="email" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black focus:border-indigo-500 transition-all" value={profileForm.email} onChange={e => setProfileForm(f => ({...f, email: e.target.value}))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Home size={10}/> Adresa</label>
                      <textarea rows={2} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black uppercase focus:border-indigo-500 transition-all resize-none" value={profileForm.address} onChange={e => setProfileForm(f => ({...f, address: e.target.value}))} />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onUpdateClient({ ...client, ...profileForm });
                      setProfileSaved(true);
                      setTimeout(() => setProfileSaved(false), 2000);
                    }}
                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${profileSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20'}`}
                  >
                    {profileSaved ? <><CheckCircle2 size={16}/> U Ruajt!</> : 'Ruaj Ndryshimet'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;
