
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Item, StockEntry, Invoice, Client } from '../types';
import { X, Package, ArrowUpCircle, ArrowDownCircle, TrendingUp, DollarSign, Clock, Filter, Landmark, BarChart3, PieChart, Calculator, ArrowUpRight, Search, Trash2, Tag, CheckCircle2, History, Box, Plus, LayoutGrid, ArrowDownWideNarrow, MapPin, Calendar, ArrowLeft, ShoppingCart, FileText } from 'lucide-react';

interface Props {
  item: Item;
  stockEntries: StockEntry[];
  invoices: Invoice[];
  clients: Client[];
  onUpdateItem: (updatedItem: Item) => void;
  onClose: () => void;
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y}`;
};

const ItemProfile: React.FC<Props> = ({ item, stockEntries, invoices, clients, onUpdateItem, onClose }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'day' | 'month' | 'year'>('year');
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [sortBy, setSortBy] = useState<'qty' | 'value' | 'profit' | 'salesCount'>('qty');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    invoices.forEach(i => years.add(i.date.slice(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const getConvVal = (val: number, curr?: string) => curr === 'EUR' ? val * 100 : val;

  const summary = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const checkPeriod = (date: string) => {
      const d = date.slice(0, 10);
      if (filterMode === 'all') return true;
      if (filterMode === 'today') return d === todayStr;
      if (filterMode === 'day') return d === selectedDay;
      if (filterMode === 'month') return date.slice(0, 7) === selectedMonth;
      return date.slice(0, 4) === selectedYear;
    };

    const outgoingByClient: Record<string, any> = {};
    let totalSalesCount = 0;
    invoices.filter(i => checkPeriod(i.date) && i.status !== 'Anuluar').forEach(inv => {
      const foundItems = inv.items.filter(it => it.itemId === item.id || it.name === item.name);
      if (foundItems.length > 0) {
        totalSalesCount++;
        if (!outgoingByClient[inv.clientId]) {
          const client = clients.find(c => c.id === inv.clientId);
          outgoingByClient[inv.clientId] = { clientName: inv.clientName, city: client?.city || 'PA QYTET', qty: 0, value: 0, profit: 0, salesCount: 0 };
        }
        outgoingByClient[inv.clientId].salesCount += 1;
        foundItems.forEach(found => {
          const sellPriceLek = getConvVal(found.price, inv.currency);
          const purchasePrice = Number(item.purchasePrice || 0);
          outgoingByClient[inv.clientId].qty += Number(found.quantity);
          outgoingByClient[inv.clientId].value += getConvVal(found.total, inv.currency);
          outgoingByClient[inv.clientId].profit += (sellPriceLek - purchasePrice) * found.quantity;
        });
      }
    });

    let outgoingList = Object.values(outgoingByClient);
    outgoingList.sort((a:any, b:any) => {
      if (sortBy === 'qty') return b.qty - a.qty;
      if (sortBy === 'profit') return b.profit - a.profit;
      if (sortBy === 'salesCount') return b.salesCount - a.salesCount;
      return b.value - a.value;
    });

    return {
      outgoing: outgoingList,
      totalOut: outgoingList.reduce((s, x:any) => s + x.qty, 0),
      totalOutValue: outgoingList.reduce((s, x:any) => s + x.value, 0),
      totalProfit: outgoingList.reduce((s, x:any) => s + x.profit, 0),
      totalSalesCount
    };
  }, [item, invoices, clients, filterMode, selectedDay, selectedMonth, selectedYear, sortBy]);

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
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[300] flex items-center justify-center p-4">
      <div className="bg-slate-50 w-full max-w-7xl h-[95vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        <div className="bg-white px-10 py-8 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center shrink-0 gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={onClose}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
            >
              <ArrowLeft size={16} /> Mbrapa
            </button>
            <div className="bg-slate-100 p-4 rounded-2xl text-slate-400"><Box size={24} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{item.name}</h2>
              <p className="text-[10px] font-black text-slate-400 mt-1 uppercase flex items-center gap-3"><Tag size={12}/> {item.unit} <DollarSign size={12}/> STANDARD: {item.price.toLocaleString()} L</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto scrollbar-hide">
            {['all', 'today', 'day', 'month', 'year'].map(m => (
              <button 
                key={m} 
                onClick={() => setFilterMode(m as any)} 
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all ${filterMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {m === 'all' ? 'Gjithë' : m === 'today' ? 'Sot' : m === 'day' ? 'Data' : m === 'month' ? 'Muaji' : 'Viti'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
             {filterMode !== 'all' && filterMode !== 'today' && (
                <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-600" />
                  {filterMode === 'day' && <input type="date" className="bg-transparent outline-none font-black text-xs uppercase" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} />}
                  {filterMode === 'month' && <input type="month" className="bg-transparent outline-none font-black text-xs uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />}
                  {filterMode === 'year' && (
                    <select className="bg-transparent outline-none font-black text-xs uppercase" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
             )}
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900"><X size={32} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white"><BarChart3 size={18} /></div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Analiza e Performancës: {getPeriodLabel()}</h3>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><ShoppingCart size={80}/></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vëllimi i Shitjeve (Periudha)</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{summary.totalOut} <span className="text-sm font-bold opacity-30">{item.unit.toUpperCase()}</span></p>
               </div>
               <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><FileText size={80}/></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Numri i Shitjeve (Transaksione)</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{summary.totalSalesCount} <span className="text-sm font-bold opacity-30">FATURA</span></p>
               </div>
               <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl group relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80}/></div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Qarkullimi Monetar (Lek)</p>
                  <p className="text-4xl font-black">{summary.totalOutValue.toLocaleString()}</p>
               </div>
               <div className="bg-emerald-50/50 p-8 rounded-[40px] border border-emerald-100 shadow-sm flex flex-col justify-center group relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={80}/></div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Fitimi Neto Gjeneruar</p>
                  <p className="text-4xl font-black text-emerald-600 tracking-tighter">{summary.totalProfit.toLocaleString()} <span className="text-sm font-bold opacity-30">L</span></p>
               </div>
             </div>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm flex flex-col mb-20">
             <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <span className="font-black text-[11px] uppercase text-slate-500 flex items-center gap-3">
                   <History size={18} /> Renditja e Klientëve për këtë Artikull
                </span>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                   <button onClick={()=>setSortBy('qty')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${sortBy==='qty'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Sasia</button>
                   <button onClick={()=>setSortBy('salesCount')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${sortBy==='salesCount'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Fatura</button>
                   <button onClick={()=>setSortBy('profit')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${sortBy==='profit'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Fitimi</button>
                   <button onClick={()=>setSortBy('value')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${sortBy==='value'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Vlera</button>
                </div>
             </div>
             <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                   <thead className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 sticky top-0 bg-slate-50/50">
                      <tr>
                        <th className="px-10 py-6">Klienti</th>
                        <th className="px-6 py-6 text-center">Sasia e Shitur</th>
                        <th className="px-6 py-6 text-center">Nr. Faturave</th>
                        <th className="px-6 py-6 text-right">Xhiro (Lek)</th>
                        <th className="px-10 py-6 text-right">Fitimi Neto</th>
                      </tr>
                   </thead>
                   <tbody>
                      {summary.outgoing.map((r:any,i:number)=>(
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                           <td className="px-10 py-6">
                              <div>
                                 <p className="font-black text-blue-600 uppercase text-xs group-hover:text-indigo-600 transition-colors">{r.clientName}</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-0.5"><MapPin size={10} /> {r.city}</p>
                              </div>
                           </td>
                           <td className="px-6 py-6 text-center font-bold text-slate-700">{r.qty.toLocaleString()} {item.unit}</td>
                           <td className="px-6 py-6 text-center">
                              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black">{r.salesCount} FAT</span>
                           </td>
                           <td className="px-6 py-6 text-right font-black text-slate-900">{r.value.toLocaleString()} L</td>
                           <td className="px-10 py-6 text-right font-black text-emerald-600">+{r.profit.toLocaleString()} L</td>
                        </tr>
                      ))}
                      {summary.outgoing.length === 0 && (
                        <tr><td colSpan={5} className="p-32 text-center text-[10px] font-black text-slate-300 uppercase italic">Nuk ka të dhëna për këtë artikull në këtë periudhë</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemProfile;
