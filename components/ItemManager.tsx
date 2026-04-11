
import React, { useState, useMemo } from 'react';
import { Item, Client, Invoice, StockEntry } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { Plus, Search, Trash2, Edit2, X, Box, PackageSearch, ShoppingCart, Layers, UserCircle2, Filter, Calendar, Clock, ChevronDown, Calculator, ArrowDownWideNarrow, ArrowUpWideNarrow, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  items: Item[];
  clients: Client[];
  invoices: Invoice[];
  stockEntries: StockEntry[];
  onAdd: (i: Item) => void;
  onUpdate: (i: Item) => void;
  onDelete: (id: string) => void;
  onOpenProfile: (i: Item) => void;
}

type SortOption = 
  | 'name_asc' 
  | 'name_desc' 
  | 'price_asc' 
  | 'price_desc' 
  | 'sales_desc' 
  | 'stock_desc' 
  | 'stock_asc';

const ItemManager: React.FC<Props> = ({ items, clients, invoices, stockEntries, onAdd, onUpdate, onDelete, onOpenProfile }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  
  // Filtrat e kohës
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'day' | 'month' | 'year'>('all');
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const todayStr = new Date().toLocaleDateString('en-CA');

  const [formData, setFormData] = useState<Omit<Item, 'id'>>({
    name: '',
    unit: 'copë',
    price: 0,
    purchasePrice: 0,
    preferentialPrices: []
  });

  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClientForPref, setSelectedClientForPref] = useState<Client | null>(null);
  const [prefPrice, setPrefPrice] = useState<number | ''>('');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    invoices.forEach(inv => {
      if (inv.date) years.add(inv.date.slice(0, 4));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const monthNames: Record<string, string> = {
    '01': 'Janar', '02': 'Shkurt', '03': 'Mars', '04': 'Prill', '05': 'Maj', '06': 'Qershor',
    '07': 'Korrik', '08': 'Gusht', '09': 'Shtator', '10': 'Tetor', '11': 'Nëntor', '12': 'Dhjetor'
  };

  const getPeriodLabel = () => {
    if (filterMode === 'all') return 'Gjithë Kohës';
    if (filterMode === 'today') return `Sot, ${todayStr.split('-').reverse().join('/')}`;
    if (filterMode === 'day') return `Data: ${selectedDay.split('-').reverse().join('/')}`;
    if (filterMode === 'year') return `Viti ${selectedYear}`;
    const [y, m] = selectedMonth.split('-');
    return `${monthNames[m]} ${y}`;
  };

  const resetForm = () => {
    setFormData({ name: '', unit: 'copë', price: 0, purchasePrice: 0, preferentialPrices: [] });
    setClientSearchQuery('');
    setSelectedClientForPref(null);
    setPrefPrice('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) onUpdate({ ...formData, id: editingId });
    else onAdd({ ...formData, id: Date.now().toString() });
    resetForm();
  };

  const handleEdit = (item: Item) => {
    setFormData({ 
      name: item.name, 
      unit: item.unit, 
      price: item.price, 
      purchasePrice: item.purchasePrice || 0,
      preferentialPrices: item.preferentialPrices || [] 
    });
    setEditingId(item.id);
    setIsAdding(true);
  };

  const addPrefPrice = () => {
    if (!selectedClientForPref || prefPrice === '') return;
    const newPrefs = [
      ...(formData.preferentialPrices?.filter(p => p.clientId !== selectedClientForPref.id) || []),
      { clientId: selectedClientForPref.id, price: Number(prefPrice) }
    ];
    setFormData({ ...formData, preferentialPrices: newPrefs });
    setSelectedClientForPref(null);
    setPrefPrice('');
    setClientSearchQuery('');
  };

  const removePrefPrice = (clientId: string) => {
    setFormData({ 
      ...formData, 
      preferentialPrices: formData.preferentialPrices?.filter(p => p.clientId !== clientId) 
    });
  };

  // Bashko artikujt me emrin e njëjtë (case-insensitive)
  const mergedItems = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach(item => {
      const key = item.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, item);
      }
      // mbaj çmimin më të lartë dhe preferentialPrices nga të dyja
    });
    return Array.from(map.values());
  }, [items]);

  const itemStats = useMemo(() => {
    const salesStats: Record<string, number> = {};
    const stockBalances: Record<string, number> = {};
    let globalTotalUnitsSold = 0;

    const filteredInvoices = invoices.filter(inv => {
      if (inv.status === 'Anuluar') return false;
      const invDate = inv.date.slice(0, 10);
      if (filterMode === 'all') return true;
      if (filterMode === 'today') return invDate === todayStr;
      if (filterMode === 'day') return invDate === selectedDay;
      if (filterMode === 'month') return inv.date.slice(0, 7) === selectedMonth;
      if (filterMode === 'year') return inv.date.slice(0, 4) === selectedYear;
      return true;
    });

    // Llogarit statistikat për çdo artikull unik (bashkon duplikatet me emrin e njëjtë)
    mergedItems.forEach(item => {
      const nameLower = item.name.trim().toLowerCase();
      // Gjej të gjithë IDs me të njëjtin emër
      const sameNameIds = new Set(items.filter(i => i.name.trim().toLowerCase() === nameLower).map(i => i.id));

      const totalIn = stockEntries.reduce((acc, entry) => {
        const found = entry.items.find(it => sameNameIds.has(it.itemId) || it.name.trim().toLowerCase() === nameLower);
        return acc + (found ? Number(found.quantity) : 0);
      }, 0);

      const totalOut = invoices.reduce((acc, inv) => {
        if (inv.status === 'Anuluar') return acc;
        // shmang numërim të dyfishtë - merr vetëm njëherë për rreshtin
        let qty = 0;
        inv.items.forEach(it => {
          if (sameNameIds.has(it.itemId) || it.name.trim().toLowerCase() === nameLower) qty += Number(it.quantity);
        });
        return acc + qty;
      }, 0);

      stockBalances[item.id] = totalIn - totalOut;

      const qtySold = filteredInvoices.reduce((acc, inv) => {
        let qty = 0;
        inv.items.forEach(it => {
          if (sameNameIds.has(it.itemId) || it.name.trim().toLowerCase() === nameLower) qty += Number(it.quantity);
        });
        return acc + qty;
      }, 0);
      salesStats[item.id] = qtySold;
      globalTotalUnitsSold += qtySold;
    });

    return { salesStats, stockBalances, globalTotalUnitsSold };
  }, [mergedItems, items, invoices, stockEntries, filterMode, selectedDay, selectedMonth, selectedYear, todayStr]);

  const matchesFuzzy = (name: string, query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const parts = q.split(/\s+/).filter(p => p.length > 0);
    const target = name.toLowerCase();
    return parts.every(p => target.includes(p));
  };

  const sortedAndFilteredItems = useMemo(() => {
    let result = mergedItems.filter(i => matchesFuzzy(i.name, search));
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'sales_desc': return itemStats.salesStats[b.id] - itemStats.salesStats[a.id];
        case 'stock_desc': return itemStats.stockBalances[b.id] - itemStats.stockBalances[a.id];
        case 'stock_asc': return itemStats.stockBalances[a.id] - itemStats.stockBalances[b.id];
        default: return 0;
      }
    });

    return result;
  }, [items, search, sortBy, itemStats]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return [];
    return clients.filter(c => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())).slice(0, 5);
  }, [clients, clientSearchQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden border-b-8 border-[#D81B60]">
           <div className="absolute right-0 top-0 p-8 opacity-10"><ShoppingCart size={80} /></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Njësi të shitura ({filterMode === 'all' ? 'Gjithë Kohës' : 'Periudha'})</p>
              <div className="flex items-baseline gap-3">
                 <p className="text-5xl font-black tracking-tighter">{itemStats.globalTotalUnitsSold.toLocaleString()}</p>
                 <p className="text-xs font-black text-indigo-300 uppercase tracking-widest">Njësi</p>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm relative overflow-hidden border-b-8 border-slate-200">
           <div className="absolute right-0 top-0 p-8 opacity-5 text-slate-900"><Layers size={80} /></div>
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Numri i artikujve (Zëra)</p>
              <div className="flex items-baseline gap-3">
                 <p className="text-5xl font-black text-slate-900 tracking-tighter">{items.length}</p>
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Artikuj unikë</p>
              </div>
           </div>
        </div>
      </div>

      {/* Paneli i Filtrimit dhe Renditjes */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
           <div className="flex bg-slate-50 p-1 rounded-xl w-full xl:w-auto overflow-x-auto scrollbar-hide">
              {['all', 'today', 'day', 'month', 'year'].map((mode) => (
                <button 
                  key={mode}
                  onClick={() => setFilterMode(mode as any)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${filterMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {mode === 'all' ? 'Gjithë Kohës' : mode === 'today' ? 'Ditore' : mode === 'day' ? 'Sipas Ditës' : mode === 'month' ? 'Muaji' : 'Viti'}
                </button>
              ))}
           </div>

           <div className="flex items-center gap-4 w-full xl:w-auto">
              {filterMode !== 'all' && filterMode !== 'today' && (
                <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-2 rounded-xl border border-slate-100 w-full xl:w-auto justify-center">
                  {filterMode === 'day' && (
                    <input type="date" className="bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} />
                  )}
                  {filterMode === 'month' && (
                    <input type="month" className="bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                  )}
                  {filterMode === 'year' && (
                    <select className="bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer min-w-[60px]" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
              )}
              <div className="hidden sm:block text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Periudha e Shitjeve</p>
                <p className="text-[10px] font-black text-indigo-600 uppercase whitespace-nowrap">{getPeriodLabel()}</p>
              </div>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center pt-4 border-t border-slate-50">
          <div className="flex flex-1 flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1">
              <PackageSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input type="text" placeholder="Kërko artikullin..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none transition-all text-sm font-bold uppercase" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <div className="relative min-w-[200px]">
              <ArrowDownWideNarrow className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortOption)} 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-[10px] font-black uppercase appearance-none cursor-pointer"
              >
                <option value="name_asc">Emri (A-Z)</option>
                <option value="name_desc">Emri (Z-A)</option>
                <option value="price_asc">Çmimi (Ulët &rarr; Lart)</option>
                <option value="price_desc">Çmimi (Lart &rarr; Ulët)</option>
                <option value="sales_desc">Shitjet (Më të lartat)</option>
                <option value="stock_desc">Gjendja (Më e larta)</option>
                <option value="stock_asc">Gjendja (Më e ulëta)</option>
              </select>
            </div>
          </div>
          <button onClick={() => setIsAdding(true)} className="w-full md:w-auto bg-[#D81B60] text-white px-8 py-3.5 rounded-2xl font-black transition-all shadow-xl text-xs uppercase tracking-widest active:scale-95">Shto Artikull</button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-6">Artikulli</th>
                <th className="px-6 py-6 text-center">Çmimi Standard</th>
                <th className="px-6 py-6 text-center">Gjendja (Stock)</th>
                <th className="px-6 py-6 text-center">Shitjet ({filterMode === 'all' ? 'Total' : 'Periudha'})</th>
                <th className="px-8 py-6 text-right">Veprime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAndFilteredItems.map(item => {
                const totalSold = itemStats.salesStats[item.id];
                const currentStock = itemStats.stockBalances[item.id];
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-5">
                        <button 
                          onClick={() => onOpenProfile(item)} 
                          className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm group/btn"
                          title="Hap Profilin Analitik"
                        >
                          <Box size={24}/>
                        </button>
                        <div>
                           <p className="font-black text-slate-900 uppercase tracking-tighter text-sm leading-none mb-1">{item.name}</p>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center font-black text-slate-900 text-sm">
                      {item.price.toLocaleString()} L
                    </td>
                    <td className="px-6 py-5 text-center">
                       <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-black ${currentStock <= 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                          {currentStock <= 0 && <AlertTriangle size={14} />}
                          {currentStock.toLocaleString()} {item.unit}
                       </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <span className={`text-xl font-black tracking-tighter ${totalSold > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {totalSold.toLocaleString()}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => handleEdit(item)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><Edit2 size={20}/></button>
                        <button onClick={() => setConfirmId(item.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedAndFilteredItems.length === 0 && (
                <tr>
                   <td colSpan={5} className="py-24 text-center">
                      <p className="text-[11px] font-black text-slate-300 uppercase italic tracking-[0.2em]">Nuk u gjet asnjë artikull në këtë listë</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[250] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 h-[90vh] flex flex-col">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingId ? 'Ndrysho' : 'Shto'} Artikullin</h3>
                 <button onClick={resetForm} className="text-slate-300 hover:text-slate-900 transition-all"><X size={32}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 <form id="item-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                       <h4 className="text-[11px] font-black uppercase text-indigo-600 tracking-widest border-b pb-2">Të dhënat e Artikullit</h4>
                       <div className="space-y-4">
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Emri i Artikullit</label>
                             <input required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-black text-sm uppercase transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Njësia</label>
                                <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                                   <option value="copë">Copë</option><option value="kg">Kg</option><option value="litër">Litër</option><option value="pako">Pako</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kosto Blerje</label>
                                <input type="number" step="0.01" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm text-indigo-600 outline-none" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})} />
                             </div>
                          </div>
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Çmimi i Shitjes (Lek)</label>
                             <input required type="number" step="0.01" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl text-emerald-600 outline-none" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-8">
                       <h4 className="text-[11px] font-black uppercase text-indigo-600 tracking-widest border-b pb-2">Çmime Preferenciale për Klientë</h4>
                       <div className="space-y-4">
                          <div className="bg-indigo-50/50 p-6 rounded-[28px] border border-indigo-100 space-y-4">
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input placeholder="Kërko klientin..." className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-500" value={clientSearchQuery} onChange={e => setClientSearchQuery(e.target.value)} />
                                {filteredClients.length > 0 && (
                                   <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-xl mt-1 z-10 py-1">
                                      {filteredClients.map(c => (
                                         <button key={c.id} type="button" onClick={() => { setSelectedClientForPref(c); setClientSearchQuery(''); }} className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase hover:bg-slate-50">{c.name}</button>
                                      ))}
                                   </div>
                                )}
                             </div>
                             {selectedClientForPref && (
                                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                   <div className="flex-1 bg-white px-4 py-3 rounded-xl border border-indigo-200 flex items-center gap-2">
                                      <UserCircle2 size={16} className="text-indigo-400" />
                                      <span className="text-[10px] font-black uppercase text-indigo-600 truncate">{selectedClientForPref.name}</span>
                                   </div>
                                   <input type="number" placeholder="Lek" className="w-24 px-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none font-black text-[10px] text-indigo-600" value={prefPrice} onChange={e => setPrefPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                                   <button type="button" onClick={addPrefPrice} className="bg-indigo-600 text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-all"><Plus size={18}/></button>
                                </div>
                             )}
                          </div>

                          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                             {formData.preferentialPrices?.map(p => {
                                const client = clients.find(c => c.id === p.clientId);
                                return (
                                  <div key={p.clientId} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                                     <div className="flex-1 mr-4">
                                        <p className="text-[9px] font-black text-slate-800 uppercase leading-none truncate">{client?.name || 'Klient i fshirë'}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Special: {p.price.toLocaleString()} L</p>
                                     </div>
                                     <button type="button" onClick={() => removePrefPrice(p.clientId)} className="p-2 text-rose-300 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                                  </div>
                                );
                             })}
                          </div>
                       </div>
                    </div>
                 </form>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-4">
                 <button type="button" onClick={resetForm} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all">Anulo</button>
                 <button type="submit" form="item-form" className="flex-2 bg-slate-900 text-white py-4 px-10 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all active:scale-95">Ruaj Artikullin</button>
              </div>
           </div>
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title="Fshi Artikullin"
          message={`Artikulli "${items.find(i => i.id === confirmId)?.name}" do të fshihet përgjithmonë. Jeni i sigurt?`}
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
};

export default ItemManager;
