
import React, { useState, useMemo } from 'react';
import { StockEntry, Item } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { Search, Calendar, Package, Plus, History, Trash2, Edit3, Eye, FileSpreadsheet, Filter, X, BarChart3, Warehouse, Calculator, List, PieChart, ChevronRight, TrendingUp, ArrowUpRight, ArrowDownWideNarrow, Landmark, Clock, Download } from 'lucide-react';
import { exportStockEntryToExcel, exportAllStockEntriesToExcel } from '../utils/exportUtils';

interface Props {
  entries: StockEntry[];
  items: Item[];
  onAddNew: () => void;
  onEdit: (entry: StockEntry) => void;
  onDelete: (id: string) => void;
  onPreview: (entry: StockEntry) => void;
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const StockEntryManager: React.FC<Props> = ({ entries, items, onAddNew, onEdit, onDelete, onPreview }) => {
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString()); // YYYY
  const [activeTab, setActiveTab] = useState<'entries' | 'analysis'>('entries');
  const [itemSortBy, setItemSortBy] = useState<'qty' | 'profit'>('qty');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    entries.forEach(e => years.add(e.date.slice(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const entryDate = e.date;
      const matchesPeriod = filterMode === 'month' 
        ? entryDate.slice(0, 7) === selectedMonth 
        : entryDate.slice(0, 4) === selectedYear;
      
      const matchesSearch = e.entryNumber.includes(search) || e.origin.toLowerCase().includes(search.toLowerCase());
      
      return matchesPeriod && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, search, filterMode, selectedMonth, selectedYear]);

  const itemAnalysis = useMemo(() => {
    const stats: Record<string, { qty: number, purchaseVal: number, sellingVal: number }> = {};
    let totalUnits = 0;

    filtered.forEach(entry => {
      entry.items.forEach(entryItem => {
        if (!stats[entryItem.name]) {
          stats[entryItem.name] = { qty: 0, purchaseVal: 0, sellingVal: 0 };
        }
        stats[entryItem.name].qty += entryItem.quantity;
        stats[entryItem.name].purchaseVal += (entryItem.total || 0);
        stats[entryItem.name].sellingVal += (entryItem.quantity * entryItem.sellingPrice);
        totalUnits += entryItem.quantity;
      });
    });

    return {
      data: Object.entries(stats)
        .map(([name, data]) => ({ 
          name, 
          qty: data.qty, 
          purchase: data.purchaseVal, 
          profit: data.sellingVal - data.purchaseVal 
        }))
        .sort((a, b) => {
          if (itemSortBy === 'qty') return b.qty - a.qty;
          return b.profit - a.profit;
        }),
      totalUnits
    };
  }, [filtered, itemSortBy]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, entry) => {
      acc.purchase += (entry.totalPurchaseValue || 0);
      acc.selling += (entry.totalSellingValue || 0);
      return acc;
    }, { purchase: 0, selling: 0 });
  }, [filtered]);

  const monthNames: Record<string, string> = {
    '01': 'Janar', '02': 'Shkurt', '03': 'Mars', '04': 'Prill', '05': 'Maj', '06': 'Qershor',
    '07': 'Korrik', '08': 'Gusht', '09': 'Shtator', '10': 'Tetor', '11': 'Nëntor', '12': 'Dhjetor'
  };

  const currentPeriodLabel = useMemo(() => {
    if (filterMode === 'year') return `Viti ${selectedYear}`;
    const [year, month] = selectedMonth.split('-');
    return `${monthNames[month]} ${year}`;
  }, [filterMode, selectedMonth, selectedYear]);

  return (
    <div className="space-y-8 pb-40 animate-in fade-in duration-500">
      <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden border-b-8 border-indigo-600">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Warehouse size={150} /></div>
        
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/20"><BarChart3 size={28} /></div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Hyrjet në Inventar</h3>
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">{currentPeriodLabel}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => exportAllStockEntriesToExcel(filtered)} 
                title={`Eksporto të gjitha fletëhyrjet për ${currentPeriodLabel}`}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-emerald-700 transition-all text-[10px]"
              >
                <Download size={18} /> Excel (Filtrimi)
              </button>
              <button onClick={onAddNew} className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all text-xs">
                <Plus size={20} strokeWidth={3} /> Hyrje e Re
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Kosto Blerje</p>
               <p className="text-3xl font-black tracking-tighter">{totals.purchase.toLocaleString()} <span className="text-sm opacity-30">L</span></p>
            </div>
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
               <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Vlera në Shitje</p>
               <p className="text-3xl font-black text-emerald-400 tracking-tighter">{totals.selling.toLocaleString()} <span className="text-sm opacity-30">L</span></p>
            </div>
            <div className="bg-indigo-600/20 p-6 rounded-3xl border border-indigo-500/20">
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Fitim i Parashikuar</p>
               <p className="text-3xl font-black text-indigo-400 tracking-tighter">{(totals.selling - totals.purchase).toLocaleString()} <span className="text-sm opacity-30">L</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2.5 rounded-[24px] border border-slate-200 shadow-sm w-full lg:w-auto">
          <div className="relative flex-1 lg:w-48 border-r border-slate-100 pr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              placeholder="Kërko..."
              className="w-full pl-9 pr-2 py-2 bg-transparent outline-none font-bold text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setFilterMode('month')}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
             >
               Muaj
             </button>
             <button 
               onClick={() => setFilterMode('year')}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterMode === 'year' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
             >
               Vit
             </button>
          </div>

          <div className="flex items-center gap-2 px-3 border-l border-slate-100">
             <Clock size={16} className="text-indigo-600 shrink-0" />
             {filterMode === 'month' ? (
               <input 
                 type="month"
                 className="bg-transparent outline-none font-black text-xs uppercase cursor-pointer"
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(e.target.value)}
               />
             ) : (
               <select 
                 className="bg-transparent outline-none font-black text-xs uppercase cursor-pointer min-w-[80px]"
                 value={selectedYear}
                 onChange={(e) => setSelectedYear(e.target.value)}
               >
                 {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
             )}
          </div>
        </div>

        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 w-full lg:w-auto">
          <button 
            onClick={() => setActiveTab('entries')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'entries' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List size={16} /> Fatura
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'analysis' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PieChart size={16} /> Artikujt
          </button>
        </div>
      </div>

      {activeTab === 'entries' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-6 py-2">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lista e fletëhyrjeve për {currentPeriodLabel}</h4>
             <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{filtered.length} Totale</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {filtered.map(entry => {
              const entryProfit = entry.totalSellingValue - entry.totalPurchaseValue;
              return (
                <div key={entry.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col xl:flex-row justify-between items-center hover:border-indigo-300 transition-all group animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-6 w-full xl:w-auto">
                     <div className="bg-slate-50 p-4 rounded-2xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                        <Package size={24} />
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">#{entry.entryNumber}</span>
                           <span className="text-slate-200">/</span>
                           <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                             {formatDateDisplay(entry.date)}
                           </span>
                        </div>
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter mt-1">{entry.origin}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{entry.items.length} Artikuj të ndryshëm</p>
                     </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-8 mt-6 xl:mt-0 w-full xl:w-auto">
                     <div className="flex gap-10 w-full justify-between sm:justify-start">
                        <div className="text-right min-w-[80px]">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Blerje</p>
                           <p className="text-base font-black text-slate-900">{entry.totalPurchaseValue.toLocaleString()} L</p>
                        </div>
                        <div className="text-right min-w-[80px]">
                           <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Shitje</p>
                           <p className="text-base font-black text-emerald-600">{(entry.totalSellingValue || 0).toLocaleString()} L</p>
                        </div>
                        <div className="text-right min-w-[100px] bg-indigo-50/50 px-3 py-1 rounded-xl border border-indigo-100">
                           <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">Fitimi</p>
                           <p className="text-base font-black text-indigo-700">+{entryProfit.toLocaleString()} L</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 border-l border-slate-100 pl-6 h-10 w-full justify-end sm:w-auto">
                        <button onClick={() => onPreview(entry)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Shiko"><Eye size={20}/></button>
                        <button onClick={() => exportStockEntryToExcel(entry)} className="p-2.5 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Excel"><FileSpreadsheet size={20}/></button>
                        <button onClick={() => onEdit(entry)} className="p-2.5 text-amber-500 hover:bg-amber-50 rounded-xl transition-all" title="Ndrysho"><Edit3 size={20}/></button>
                        <button onClick={() => setConfirmId(entry.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Fshi"><Trash2 size={20}/></button>
                     </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-32 text-center bg-white rounded-[48px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center space-y-4">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <History size={40} />
                 </div>
                 <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nuk u gjet asnjë fletëhyrje për {currentPeriodLabel}.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-2 gap-4">
             <div className="flex items-center gap-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Analiza financiare sipas artikullit - {currentPeriodLabel}</h4>
                <div className="h-4 w-px bg-slate-200"></div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{itemAnalysis.totalUnits} Njësi Totale</span>
             </div>
             
             <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm self-stretch sm:self-auto">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-3 flex items-center gap-2">
                   <ArrowDownWideNarrow size={14} /> Rendit:
                </span>
                <div className="flex gap-1">
                   <button 
                     onClick={() => setItemSortBy('qty')}
                     className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${itemSortBy === 'qty' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                   >
                     <Package size={12} /> Sasia
                   </button>
                   <button 
                     onClick={() => setItemSortBy('profit')}
                     className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${itemSortBy === 'profit' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                   >
                     <TrendingUp size={12} /> Fitimi
                   </button>
                </div>
             </div>
          </div>

          <div className="space-y-3">
            {itemAnalysis.data.map((item, idx) => {
              const percentage = itemAnalysis.totalUnits > 0 ? (item.qty / itemAnalysis.totalUnits) * 100 : 0;
              return (
                <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all animate-in slide-in-from-right-2 duration-300">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 shrink-0">
                        <Package size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-base font-black text-slate-800 uppercase tracking-tight truncate">{item.name}</h5>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${itemSortBy === 'qty' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                            {item.qty} Njësi
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {percentage.toFixed(1)}% e volumit
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden xl:block w-48 px-4">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-8 xl:gap-12">
                      <div className="text-left xl:text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vlera Blerjes</p>
                        <p className="text-base font-black text-slate-900">{item.purchase.toLocaleString()} L</p>
                      </div>
                      <div className="text-left xl:text-right border-l xl:border-l-0 xl:pl-0 pl-8 border-slate-100">
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 flex items-center xl:justify-end gap-1 ${itemSortBy === 'profit' ? 'text-indigo-600' : 'text-emerald-500'}`}>
                          Fitimi {itemSortBy === 'profit' ? <Landmark size={10} /> : <TrendingUp size={10} />}
                        </p>
                        <p className={`text-base font-black ${itemSortBy === 'profit' ? 'text-indigo-600' : 'text-emerald-600'}`}>{item.profit.toLocaleString()} L</p>
                      </div>
                    </div>

                    <div className="flex justify-end xl:pl-4">
                       <div className="bg-slate-50 p-2 rounded-xl text-slate-300">
                          <ArrowUpRight size={18} />
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {itemAnalysis.data.length === 0 && (
              <div className="py-32 text-center bg-white rounded-[48px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center">
                 <Package size={48} className="text-slate-200 mb-4" />
                 <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Nuk ka lëvizje artikujsh për këtë periudhë.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 animate-in slide-in-from-bottom duration-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-4">
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                <Calculator size={24} />
              </div>
              <div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Përmbledhje {currentPeriodLabel}</span>
                 <span className="text-xs font-bold text-slate-900 italic">
                    {filtered.length} Faturë hyrjeje
                 </span>
              </div>
           </div>
           
           <div className="flex gap-12 sm:gap-20">
              <div className="text-center sm:text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Totali Blerje</p>
                 <p className="text-xl font-black">{totals.purchase.toLocaleString()} L</p>
              </div>
              <div className="text-center sm:text-right">
                 <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Totali Shitje</p>
                 <p className="text-xl font-black text-emerald-600">{totals.selling.toLocaleString()} L</p>
              </div>
              <div className="text-center sm:text-right border-l border-slate-100 pl-12 hidden md:block">
                 <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">Fitim i Parashikuar</p>
                 <p className="text-xl font-black text-indigo-600">{(totals.selling - totals.purchase).toLocaleString()} L</p>
              </div>
           </div>
        </div>
      </div>

      {confirmId && (
        <ConfirmDialog
          title="Fshi Fletëhyrjen"
          message={`Fletëhyrja #${entries.find(e => e.id === confirmId)?.entryNumber} do të fshihet përgjithmonë. Jeni i sigurt?`}
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
};

export default StockEntryManager;
