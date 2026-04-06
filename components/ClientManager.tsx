
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, Item, PreferentialPrice, Invoice } from '../types';
import { Plus, Search, Trash2, Edit2, X, Save, Box, Tag, PackagePlus, UserCircle2, Star, MapPin, SortAsc, Filter, PackageSearch, Check, Wallet, AlertCircle, Landmark, BarChart3 } from 'lucide-react';

interface Props {
  clients: Client[];
  items: Item[];
  invoices: Invoice[];
  onAdd: (c: Client) => void;
  onUpdate: (c: Client) => void;
  onDelete: (id: string) => void;
  onUpdateItems: (items: Item[]) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onOpenProfile: (client: Client) => void;
}

type SortOption = 'alphabetical' | 'most_billed' | 'highest_debt';

const ClientManager: React.FC<Props> = ({ clients, items, invoices, onAdd, onUpdate, onDelete, onUpdateItems, onPreviewInvoice, onOpenProfile }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [cityFilter, setCityFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState<Omit<Client, 'id'>>({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    points: 0
  });

  const [stagedItemPrices, setStagedItemPrices] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (editingId) {
      const initialPrices: Record<string, number> = {};
      items.forEach(item => {
        const pref = item.preferentialPrices?.find(p => p.clientId === editingId);
        if (pref) {
          initialPrices[item.id] = pref.price;
        }
      });
      setStagedItemPrices(initialPrices);
    } else {
      setStagedItemPrices({});
    }
  }, [editingId, items]);

  const uniqueCities = useMemo(() => {
    const cities = clients.map(c => c.city?.trim()).filter((city): city is string => !!city && city !== '');
    return Array.from(new Set(cities)).sort();
  }, [clients]);

  // Llogaritja e detyrimit për çdo klient - Rolling Balance
  const clientFinancials = useMemo(() => {
    const financials: Record<string, { spent: number, paid: number, debt: number }> = {};
    
    clients.forEach(c => {
      const clientInvoices = invoices.filter(inv => inv.clientId === c.id && inv.status !== 'Anuluar')
                                     .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const spent = clientInvoices.reduce((s, i) => s + (i.currency === 'EUR' ? i.total * 100 : i.total), 0);
      const paid = clientInvoices.reduce((s, i) => s + (i.currency === 'EUR' ? (i.amountPaid || 0) * 100 : (i.amountPaid || 0)), 0);
      
      let debt = 0;
      if (clientInvoices.length > 0) {
        const latest = clientInvoices[0];
        const rawDebt = (latest.subtotal + (latest.previousBalance || 0)) - (latest.amountPaid || 0);
        debt = latest.currency === 'EUR' ? rawDebt * 100 : rawDebt;
      }
      
      financials[c.id] = { spent, paid, debt };
    });
    
    return financials;
  }, [clients, invoices]);

  const totalGlobalDebt = useMemo(() => {
    const financialsArray = Object.values(clientFinancials) as { spent: number; paid: number; debt: number }[];
    return financialsArray.reduce((sum, f) => sum + f.debt, 0);
  }, [clientFinancials]);

  const resetForm = () => {
    setFormData({ name: '', city: '', address: '', phone: '', email: '', points: 0 });
    setStagedItemPrices({});
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clientId = editingId || Date.now().toString();
    if (editingId) onUpdate({ ...formData, id: editingId });
    else onAdd({ ...formData, id: clientId });

    const newItems = items.map(item => {
      const hasStaged = stagedItemPrices.hasOwnProperty(item.id);
      const existingPrefs = item.preferentialPrices || [];
      const alreadyHad = existingPrefs.some(p => p.clientId === clientId);
      if (hasStaged) {
        const newPrice = stagedItemPrices[item.id];
        let newPrefs = alreadyHad ? existingPrefs.map(p => p.clientId === clientId ? { ...p, price: newPrice } : p) : [...existingPrefs, { clientId, price: newPrice }];
        return { ...item, preferentialPrices: newPrefs };
      } else if (alreadyHad) return { ...item, preferentialPrices: existingPrefs.filter(p => p.clientId !== clientId) };
      return item;
    });
    onUpdateItems(newItems);
    resetForm();
  };

  const handleEdit = (client: Client) => {
    setFormData({ name: client.name, city: client.city || '', address: client.address, phone: client.phone, email: client.email, points: client.points || 0 });
    setEditingId(client.id);
    setIsAdding(true);
  };

  const sortedAndFilteredClients = useMemo(() => {
    let result = clients.filter(c => {
      const q = search.toLowerCase().trim();
      const matchesSearch = c.name.toLowerCase().includes(q) || (c.city && c.city.toLowerCase().includes(q));
      const matchesCity = cityFilter === 'all' || c.city === cityFilter;
      return matchesSearch && matchesCity;
    });

    if (sortBy === 'alphabetical') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'most_billed') {
      result.sort((a, b) => clientFinancials[b.id].spent - clientFinancials[a.id].spent);
    } else if (sortBy === 'highest_debt') {
      result.sort((a, b) => clientFinancials[b.id].debt - clientFinancials[a.id].debt);
    }
    
    return result;
  }, [clients, search, sortBy, cityFilter, clientFinancials]);

  return (
    <div className="space-y-6">
      {/* Paneli i Totaleve */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-6 rounded-[24px] text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10"><Wallet size={80} /></div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Detyrimi Total i Klientëve</p>
          <p className="text-3xl font-black tracking-tighter">{totalGlobalDebt.toLocaleString()} <span className="text-sm opacity-40">LEK</span></p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Totali i Klientëve</p>
          <p className="text-3xl font-black text-slate-800 tracking-tighter">{clients.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Qytete të Mbuluara</p>
          <p className="text-3xl font-black text-slate-800 tracking-tighter">{uniqueCities.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Kërko klientin me emër ose qytet..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold uppercase" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-[400px]">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[10px] font-black uppercase appearance-none">
                <option value="all">Të Gjitha Qytetet</option>
                {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="relative">
              <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[10px] font-black uppercase appearance-none">
                <option value="alphabetical">Rendit: A-Z</option>
                <option value="most_billed">Më i faturuari</option>
                <option value="highest_debt">Detyrim më i lartë</option>
              </select>
            </div>
          </div>
        </div>
        <button onClick={() => setIsAdding(true)} className="w-full bg-[#D81B60] text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-[#AD1457] transition-all shadow-lg shadow-[#D81B60]/20 active:scale-95">
          <Plus size={18} strokeWidth={3}/> Shto Klient të Ri
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">Informacioni i Klientit</th>
                <th className="px-6 py-5">Pikët Loyalty</th>
                <th className="px-6 py-5">Totali Blerjeve</th>
                <th className="px-6 py-5">Detyrimi</th>
                <th className="px-8 py-5 text-right">Veprime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {sortedAndFilteredClients.map(client => {
                const fin = clientFinancials[client.id];
                return (
                  <tr key={client.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-8 py-5">
                      <button onClick={() => onOpenProfile(client)} className="flex items-center gap-4 text-left hover:opacity-80 transition-opacity">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center justify-center shrink-0">
                          {client.photo
                            ? <img src={client.photo} alt={client.name} className="w-full h-full object-cover" />
                            : <UserCircle2 size={24} />
                          }
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-sm uppercase tracking-tight hover:text-indigo-600 transition-colors">{client.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5 mt-0.5">
                            <MapPin size={10} /> {client.city || 'Pa Qytet'}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-2 font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full w-fit border border-amber-100">
                          <Star size={12} fill="#d97706" /> {client.points || 0}
                       </div>
                    </td>
                    <td className="px-6 py-5 font-black text-slate-900">{fin.spent.toLocaleString()} L</td>
                    <td className="px-6 py-5">
                      <div className={`flex items-center gap-2 font-black ${fin.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {fin.debt > 0 && <AlertCircle size={14} />}
                        {fin.debt.toLocaleString()} L
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => onOpenProfile(client)} 
                          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10"
                        >
                          <BarChart3 size={14} /> Profil Analitik
                        </button>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleEdit(client)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><Edit2 size={16}/></button>
                          <button onClick={() => onDelete(client.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedAndFilteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                       <div className="bg-slate-50 p-4 rounded-full text-slate-200">
                          <UserCircle2 size={40} />
                       </div>
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nuk u gjet asnjë klient</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[260] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">{editingId ? 'Përditëso' : 'Regjistro'} Klient</h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={28}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emri i Plotë</label>
                  <input required placeholder="Psh: ARDIAN FILANI" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black uppercase focus:border-indigo-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qyteti</label>
                  <input placeholder="Psh: TIRANË" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black uppercase focus:border-indigo-500 transition-all" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefoni</label>
                  <input placeholder="Psh: +355 6X XX XX XXX" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black focus:border-indigo-500 transition-all" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email (Opsional)</label>
                  <input type="email" placeholder="email@shembull.com" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black focus:border-indigo-500 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adresa e Plotë</label>
                <textarea rows={2} placeholder="Psh: RRUGA 'DURRËSIT', NR. 45" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black uppercase focus:border-indigo-500 transition-all resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={resetForm} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all">Anulo</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">Ruaj të Dhënat</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientManager;
