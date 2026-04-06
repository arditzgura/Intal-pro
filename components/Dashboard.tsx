
import React, { useMemo, useState } from 'react';
import { Invoice, Client, Item, StockEntry } from '../types';
import { TrendingUp, Users, Package, FileText, CheckCircle, AlertCircle, Calculator, DollarSign, ArrowDownCircle, Filter, Calendar, Clock, ChevronDown, Wallet, CalendarDays, History, Landmark, PieChart } from 'lucide-react';

interface Props {
  invoices: Invoice[];
  clients: Client[];
  items: Item[];
  stockEntries: StockEntry[];
}

const Dashboard: React.FC<Props> = ({ invoices, clients, items, stockEntries }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'day' | 'month' | 'year'>('month');
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const todayStr = new Date().toLocaleDateString('en-CA');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    invoices.forEach(inv => {
      if (inv.date) years.add(inv.date.slice(0, 4));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const getConvVal = (val: number, curr?: string) => curr === 'EUR' ? val * 100 : val;

  // 1. Llogaritja e Statistikave Akumulative (Gjithë Kohës)
  const globalStats = useMemo(() => {
    const validInvoices = invoices.filter(inv => inv.status !== 'Anuluar');
    
    const totalSales = validInvoices.reduce((sum, inv) => sum + getConvVal(inv.total, inv.currency), 0);
    const totalCollected = validInvoices.reduce((sum, inv) => {
      if (inv.status === 'E paguar') {
        return sum + getConvVal(inv.amountPaid || 0, inv.currency);
      }
      return sum;
    }, 0);
    
    const totalCOGS = validInvoices.reduce((acc, inv) => {
      const invoiceCost = inv.items.reduce((itemAcc, invItem) => {
        const globalItem = items.find(i => i.id === invItem.itemId || i.name === invItem.name);
        return itemAcc + ((globalItem?.purchasePrice || 0) * invItem.quantity);
      }, 0);
      return acc + invoiceCost;
    }, 0);

    return {
      sales: totalSales,
      collected: totalCollected,
      unpaid: totalSales - totalCollected,
      profit: totalSales - totalCOGS,
      count: validInvoices.length
    };
  }, [invoices, items]);

  // 2. Llogaritja e Statistikave të Periudhës (Filtruar)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'Anuluar') return false;
      const invDate = inv.date.slice(0, 10);
      const pDate = (inv.paymentDate || inv.date).slice(0, 10);
      
      const matches = (d: string) => {
        if (filterMode === 'all') return true;
        if (filterMode === 'today') return d === todayStr;
        if (filterMode === 'day') return d === selectedDay;
        if (filterMode === 'month') return d.slice(0, 7) === selectedMonth;
        if (filterMode === 'year') return d.slice(0, 4) === selectedYear;
        return true;
      };

      // Përfshijmë faturën nëse është krijuar në këtë periudhë OSE nëse është paguar në këtë periudhë
      return matches(invDate) || (inv.status === 'E paguar' && matches(pDate));
    });
  }, [invoices, filterMode, selectedDay, selectedMonth, selectedYear, todayStr]);

  const periodStats = useMemo(() => {
    const matches = (d: string) => {
      if (filterMode === 'all') return true;
      if (filterMode === 'today') return d === todayStr;
      if (filterMode === 'day') return d === selectedDay;
      if (filterMode === 'month') return d.slice(0, 7) === selectedMonth;
      if (filterMode === 'year') return d.slice(0, 4) === selectedYear;
      return true;
    };

    // Xhiro: Vetëm faturat e KRIJUARA në këtë periudhë
    const totalSales = invoices.reduce((sum, inv) => {
      if (inv.status === 'Anuluar') return sum;
      if (matches(inv.date.slice(0, 10))) {
        return sum + getConvVal(inv.total, inv.currency);
      }
      return sum;
    }, 0);

    // Arketimet: Vetëm pagesat e BËRA në këtë periudhë (paymentDate)
    const totalCollected = invoices.reduce((sum, inv) => {
      if (inv.status !== 'E paguar' || inv.status === 'Anuluar') return sum;
      const pDate = (inv.paymentDate || inv.date).slice(0, 10);
      if (matches(pDate)) {
        return sum + getConvVal(inv.amountPaid || 0, inv.currency);
      }
      return sum;
    }, 0);

    // COGS: Vetëm për faturat e KRIJUARA në këtë periudhë
    const totalCOGS = invoices.reduce((acc, inv) => {
      if (inv.status === 'Anuluar' || !matches(inv.date.slice(0, 10))) return acc;
      const invoiceCost = inv.items.reduce((itemAcc, invItem) => {
        const globalItem = items.find(i => i.id === invItem.itemId || i.name === invItem.name);
        return itemAcc + ((globalItem?.purchasePrice || 0) * invItem.quantity);
      }, 0);
      return acc + invoiceCost;
    }, 0);

    return {
      sales: totalSales,
      profit: totalSales - totalCOGS,
      collected: totalCollected,
      margin: totalSales > 0 ? ((totalSales - totalCOGS) / totalSales) * 100 : 0
    };
  }, [invoices, items, filterMode, selectedDay, selectedMonth, selectedYear, todayStr]);

  const getPeriodLabel = () => {
    if (filterMode === 'all') return 'Gjithë Kohës';
    if (filterMode === 'today') return `Sot, ${todayStr.split('-').reverse().join('/')}`;
    if (filterMode === 'day') return `Data: ${selectedDay.split('-').reverse().join('/')}`;
    if (filterMode === 'year') return `Viti ${selectedYear}`;
    const [y, m] = selectedMonth.split('-');
    const names: any = {'01':'Janar','02':'Shkurt','03':'Mars','04':'Prill','05':'Maj','06':'Qershor','07':'Korrik','08':'Gusht','09':'Shtator','10':'Tetor','11':'Nëntor','12':'Dhjetor'};
    return `${names[m]} ${y}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* SEKSIONI 1: PANELI AKUMULATIV (HISTORIK) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-[32px] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D81B60]">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><History size={200} /></div>
        
        <div className="relative z-10 flex flex-col gap-8">
           <div className="flex items-center gap-4">
              <div className="bg-[#D81B60] p-3 rounded-2xl shadow-lg shadow-[#D81B60]/20"><Landmark size={28} /></div>
              <div>
                 <h3 className="text-xl font-black uppercase tracking-tight">Pasqyra e Akumuluar</h3>
                 <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]">Që nga fillimi i përdorimit të aplikacionit</p>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xhiro Totale (Lek)</p>
                 <p className="text-3xl font-black tracking-tighter">{globalStats.sales.toLocaleString()}</p>
                 <div className="mt-4 flex items-center gap-2 text-emerald-400 text-[9px] font-black uppercase">
                    <TrendingUp size={12} /> {globalStats.count} Fatura totale
                 </div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all">
                 <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Fitimi Akumuluar (Lek)</p>
                 <p className="text-3xl font-black text-emerald-400 tracking-tighter">{globalStats.profit.toLocaleString()}</p>
                 <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase italic">Pas zbritjes së kostos së blerjes</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all">
                 <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Arketuar Gjithsej (Lek)</p>
                 <p className="text-3xl font-black text-amber-400 tracking-tighter">{globalStats.collected.toLocaleString()}</p>
                 <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase italic">Vlera monetare e futur në arkë</p>
              </div>
              <div className="bg-[#D81B60]/20 backdrop-blur-sm p-6 rounded-3xl border border-[#D81B60]/30 hover:border-[#D81B60]/50 transition-all">
                 <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Detyrime të Mbetura</p>
                 <p className="text-3xl font-black text-rose-400 tracking-tighter">{globalStats.unpaid.toLocaleString()}</p>
                 <p className="mt-4 text-[9px] text-rose-300 font-black uppercase">Borxhi aktual jashtë</p>
              </div>
           </div>
        </div>
      </div>

      {/* SEKSIONI 2: FILTRIMI OPERATIV (PERIUDHA) */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-900 text-white p-2.5 rounded-xl mr-2"><Filter size={18} /></div>
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-hide max-w-full">
              {['all', 'today', 'day', 'month', 'year'].map(m => (
                <button 
                  key={m} 
                  onClick={() => setFilterMode(m as any)} 
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${filterMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {m === 'all' ? 'Gjithë Kohës' : m === 'today' ? 'Ditore' : m === 'day' ? 'Sipas Ditës' : m === 'month' ? 'Muaji' : 'Viti'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto">
            {filterMode !== 'all' && filterMode !== 'today' && (
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-full lg:w-auto justify-center">
                {filterMode === 'day' && <input type="date" className="bg-transparent outline-none font-black text-xs uppercase cursor-pointer" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}/>}
                {filterMode === 'month' && <input type="month" className="bg-transparent outline-none font-black text-xs uppercase cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}/>}
                {filterMode === 'year' && <select className="bg-transparent outline-none font-black text-xs uppercase cursor-pointer" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>}
              </div>
            )}
            <div className="hidden sm:block text-right shrink-0">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Periudha Operative</p>
               <p className="text-xs font-black text-indigo-600 uppercase">{getPeriodLabel()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><TrendingUp size={20} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xhiro Periudhës</p>
              </div>
              <p className="text-2xl font-black text-slate-900">{periodStats.sales.toLocaleString()} L</p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                 <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600"><DollarSign size={20} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fitimi Periudhës</p>
              </div>
              <p className="text-2xl font-black text-emerald-600">{periodStats.profit.toLocaleString()} L</p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                 <div className="bg-amber-50 p-2 rounded-xl text-amber-600"><Wallet size={20} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arketuar Periudhës</p>
              </div>
              <p className="text-2xl font-black text-amber-600">{periodStats.collected.toLocaleString()} L</p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                 <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><PieChart size={20} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marzhi Mesatar</p>
              </div>
              <p className="text-2xl font-black text-slate-900">{periodStats.margin.toFixed(1)}%</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Faturat e Fundit të Periudhës</h3>
            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{filteredInvoices.length} Dokumente</span>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4 text-left">Nr.</th>
                  <th className="px-6 py-4 text-left">Klienti</th>
                  <th className="px-6 py-4 text-left">Totali</th>
                  <th className="px-6 py-4 text-left">Statusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredInvoices.slice(0, 8).map((inv) => {
                  const isPaidInPeriod = inv.status === 'E paguar' && (
                    (filterMode === 'today' && inv.paymentDate === todayStr) ||
                    (filterMode === 'day' && inv.paymentDate === selectedDay) ||
                    (filterMode === 'month' && inv.paymentDate?.slice(0, 7) === selectedMonth) ||
                    (filterMode === 'year' && inv.paymentDate?.slice(0, 4) === selectedYear)
                  );
                  const isCreatedInPeriod = (
                    (filterMode === 'today' && inv.date.slice(0, 10) === todayStr) ||
                    (filterMode === 'day' && inv.date.slice(0, 10) === selectedDay) ||
                    (filterMode === 'month' && inv.date.slice(0, 7) === selectedMonth) ||
                    (filterMode === 'year' && inv.date.slice(0, 4) === selectedYear) ||
                    filterMode === 'all'
                  );

                  return (
                    <tr key={inv.id} className="text-xs hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-700">
                        {inv.invoiceNumber}
                        {isPaidInPeriod && !isCreatedInPeriod && (
                          <span className="ml-2 text-[7px] bg-amber-100 text-amber-700 px-1 rounded">PAGUAR SOT</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-600 uppercase truncate max-w-[150px]">{inv.clientName}</td>
                      <td className="px-6 py-4 font-black text-slate-900">{inv.total.toLocaleString()} {inv.currency === 'EUR' ? '€' : 'L'}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${inv.status === 'E paguar' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>{inv.status}</span></td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr><td colSpan={4} className="p-20 text-center text-[10px] font-black text-slate-300 uppercase italic">Asnjë aktivitet për këtë periudhë</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
           <div className="space-y-6">
              <div className="flex items-center gap-3">
                 <div className="bg-indigo-600 p-2 rounded-xl text-white"><Calculator size={20} /></div>
                 <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Analiza e Shpejtë</h3>
              </div>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pjesa e Arketuar (Periodike)</p>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${periodStats.sales > 0 ? (periodStats.collected/periodStats.sales)*100 : 0}%` }}></div>
                    </div>
                    <p className="text-right text-[10px] font-black text-indigo-600 mt-2">{periodStats.sales > 0 ? ((periodStats.collected/periodStats.sales)*100).toFixed(1) : 0}%</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Raporti i Fitimit (Global)</p>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${globalStats.sales > 0 ? (globalStats.profit/globalStats.sales)*100 : 0}%` }}></div>
                    </div>
                    <p className="text-right text-[10px] font-black text-emerald-600 mt-2">{globalStats.sales > 0 ? ((globalStats.profit/globalStats.sales)*100).toFixed(1) : 0}% Fitim Neto</p>
                 </div>
              </div>
           </div>
           
           <div className="mt-8 pt-6 border-t border-slate-100 text-[10px] text-slate-400 font-bold italic leading-relaxed">
              * Të gjitha vlerat janë të konvertuara në monedhën LEK (1 Euro = 100 Lek) për efekt të analizës financiare akumuluese.
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
