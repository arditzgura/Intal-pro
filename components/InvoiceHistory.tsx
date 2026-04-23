
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Client } from '../types';
import { Search, Trash2, Eye, Edit3, FileSpreadsheet, Filter, MapPin, CheckCircle2, Calculator, Wallet, Coins, TrendingDown } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { exportInvoicesToExcel } from '../utils/exportUtils';
import { normalize } from '../utils/storage';

interface Props {
  invoices: Invoice[];
  clients: Client[];
  onDelete: (id: string) => void;
  onPreview: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onUpdateStatus?: (id: string, status: Invoice['status']) => void;
  onSelectClient: (clientId: string) => void;
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const InvoiceHistory: React.FC<Props> = ({ invoices, clients, onDelete, onPreview, onEdit, onUpdateStatus, onSelectClient }) => {
  const [ready, setReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setVisibleCount(30);
    let id2: number;
    const id = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setReady(true)); });
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(id2); };
  }, [invoices.length]);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'day' | 'month' | 'year'>('all');
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('en-CA'));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const todayStr = new Date().toLocaleDateString('en-CA');
  const isDailyMode = filterMode === 'today' || filterMode === 'day';
  const activeDayStr = filterMode === 'today' ? todayStr : selectedDay;

  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    invoices.forEach(inv => {
      const city = inv.clientCity || clientMap[inv.clientId]?.city;
      if (city?.trim()) cities.add(city.trim());
    });
    return Array.from(cities).sort();
  }, [invoices, clientMap]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    invoices.forEach(inv => { if (inv.date) years.add(inv.date.slice(0, 4)); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  // Çelës unik për klient: ID reale ose emër+qytet për ato manuale
  const getClientKey = (inv: Invoice): string =>
    inv.clientId && inv.clientId !== 'manual'
      ? inv.clientId
      : `manual|${normalize(inv.clientName.trim())}|${normalize((inv.clientCity || '').trim())}`;

  // Gjendja finale e çdo klienti nga fatura e tyre e fundit
  const clientDebtMap = useMemo(() => {
    const map: Record<string, {
      balance: number; currency: 'Lek' | 'EUR';
      latestId: string; latestPaid: boolean; latestPaymentDate: string;
    }> = {};
    const byClient: Record<string, Invoice[]> = {};
    invoices.forEach(inv => {
      if (inv.status === 'Anuluar') return;
      const key = getClientKey(inv);
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(inv);
    });
    Object.entries(byClient).forEach(([key, invs]) => {
      const latest = invs.reduce((a, b) => a.date > b.date ? a : b);
      map[key] = {
        balance: (latest.subtotal + (latest.previousBalance || 0)) - (latest.amountPaid || 0),
        currency: latest.currency,
        latestId: latest.id,
        latestPaid: latest.status === 'E paguar',
        latestPaymentDate: (latest.paymentDate || latest.date).slice(0, 10),
      };
    });
    return map;
  }, [invoices]);

  // Faturë e absorbuar = Pa paguar dhe nuk është fatura e fundit
  // 'pasuar' = debija u bart, fatura e fundit ende pa paguar
  // 'paguar' = debija u shlye nëpërmjet faturës së fundit
  const getAbsorbedStatus = (inv: Invoice): 'none' | 'pasuar' | 'paguar' => {
    if (inv.status !== 'Pa paguar') return 'none';
    const cd = clientDebtMap[getClientKey(inv)];
    if (!cd || inv.id === cd.latestId) return 'none';
    return cd.latestPaid ? 'paguar' : 'pasuar';
  };

  // Funksion ndihmës për filtrin kohor ditor (i njëjti për filteredInvoices dhe totals)
  const matchesDailyFilter = (inv: Invoice, activeDay: string): boolean => {
    const invDate = inv.date.slice(0, 10);
    const payDate = inv.paymentDate || null;
    const cd = clientDebtMap[getClientKey(inv)];
    const isLatest = cd?.latestId === inv.id;
    const isAbsorbedInv = inv.status === 'Pa paguar' && cd && inv.id !== cd.latestId;
    return (
      invDate === activeDay
      || (payDate === activeDay)
      || (isLatest && cd.latestPaid && cd.latestPaymentDate === activeDay && invDate !== activeDay)
      || (isAbsorbedInv && cd.latestPaid && cd.latestPaymentDate === activeDay)
    );
  };

  const filteredInvoices = useMemo(() => {
    const searchNorm = normalize(search);
    return invoices.filter(inv => {
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const client = clientMap[inv.clientId];
      // Prioritet: qyteti i ruajtur në faturë, pastaj qyteti aktual i klientit
      const invCity = inv.clientCity || client?.city || '';
      const matchesCity = cityFilter === 'all' || invCity.trim() === cityFilter;
      const matchesSearch = !searchNorm ||
        normalize(inv.invoiceNumber).includes(searchNorm) ||
        normalize(inv.clientName).includes(searchNorm) ||
        normalize(invCity).includes(searchNorm) ||
        inv.items.some(item => normalize(item.name).includes(searchNorm));

      let matchesTime = true;
      if (filterMode === 'today' || filterMode === 'day') {
        matchesTime = matchesDailyFilter(inv, activeDayStr);
      } else if (filterMode === 'month') {
        const payMonth = inv.paymentDate ? inv.paymentDate.slice(0, 7) : null;
        matchesTime = inv.date.slice(0, 7) === selectedMonth || payMonth === selectedMonth;
      } else if (filterMode === 'year') {
        const payYear = inv.paymentDate ? inv.paymentDate.slice(0, 4) : null;
        matchesTime = inv.date.slice(0, 4) === selectedYear || payYear === selectedYear;
      }

      return matchesStatus && matchesSearch && matchesTime && matchesCity;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, clientMap, clientDebtMap, search, statusFilter, cityFilter, filterMode, activeDayStr, selectedMonth, selectedYear]);

  // Totals: Shitjet = subtotal i faturave të periudhës, Arkëtimet = amountPaid i faturave të periudhës
  const totals = useMemo(() => {
    const getConvVal = (val: number, curr?: string) => curr === 'EUR' ? val * 100 : val;
    const cityOk = (inv: Invoice) => {
      const city = inv.clientCity || clientMap[inv.clientId]?.city || '';
      return cityFilter === 'all' || city.trim() === cityFilter;
    };

    let totalSales = 0;
    let totalCollected = 0;

    invoices.forEach(inv => {
      if (inv.status === 'Anuluar') return;
      if (!cityOk(inv)) return;

      // Shitjet: vetëm faturat e KRIJUARA në periudhë (jo ato nga datat e tjera)
      const invDate = inv.date.slice(0, 10);
      const shitjetMatches =
        filterMode === 'all' ? true :
        filterMode === 'month' ? inv.date.slice(0, 7) === selectedMonth :
        filterMode === 'year' ? inv.date.slice(0, 4) === selectedYear :
        invDate === activeDayStr;

      if (shitjetMatches) totalSales += getConvVal(inv.subtotal, inv.currency);

      // Arketimet: data e pagesës ka prioritet mbi datën e faturës
      const effectivePayDate = inv.paymentDate || inv.date.slice(0, 10);
      const arkëtimiMatches =
        filterMode === 'all' ? true :
        filterMode === 'month' ? (effectivePayDate.slice(0, 7) === selectedMonth) :
        filterMode === 'year' ? (effectivePayDate.slice(0, 4) === selectedYear) :
        matchesDailyFilter(inv, activeDayStr);

      if (arkëtimiMatches) totalCollected += getConvVal(inv.amountPaid || 0, inv.currency);
    });

    return { sales: totalSales, collected: totalCollected };
  }, [invoices, clientMap, clientDebtMap, cityFilter, filterMode, activeDayStr, selectedMonth, selectedYear]);

  const getPeriodLabel = () => {
    if (filterMode === 'all') return 'Gjithë Kohës';
    if (filterMode === 'today') return `Sot, ${todayStr.split('-').reverse().join('/')}`;
    const mn: any = {'01':'Janar','02':'Shkurt','03':'Mars','04':'Prill','05':'Maj','06':'Qershor','07':'Korrik','08':'Gusht','09':'Shtator','10':'Tetor','11':'Nëntor','12':'Dhjetor'};
    if (filterMode === 'day') return `Data: ${selectedDay.split('-').reverse().join('/')}`;
    if (filterMode === 'year') return `Viti ${selectedYear}`;
    const [y, m] = selectedMonth.split('-');
    return `${mn[m]} ${y}`;
  };

  return (
    <>
    <div className="space-y-6">
      {/* Filtrat */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#D81B60]" />
            <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest">Kontrolli i Historikut</h3>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <MapPin size={14} className="text-[#D81B60] shrink-0" />
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="w-full lg:w-48 px-3 py-2 bg-slate-100 border-0 rounded-xl text-[10px] font-black uppercase appearance-none cursor-pointer outline-none text-slate-700">
              <option value="all">Të Gjitha Qytetet</option>
              {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex bg-slate-50 p-1 rounded-xl w-full xl:w-auto overflow-x-auto scrollbar-hide">
            {['all','today','day','month','year'].map(mode => (
              <button key={mode} onClick={() => setFilterMode(mode as any)}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${filterMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {mode === 'all' ? 'Gjithë Kohës' : mode === 'today' ? 'Ditore' : mode === 'day' ? 'Sipas Ditës' : mode === 'month' ? 'Muaji' : 'Viti'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 w-full xl:w-auto">
            {filterMode !== 'all' && filterMode !== 'today' && (
              <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-2 rounded-xl border border-slate-100 w-full xl:w-auto justify-center">
                {filterMode === 'day' && <input type="date" className="bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} />}
                {filterMode === 'month' && <input type="month" className="bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />}
                {filterMode === 'year' && <select className="bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer min-w-[60px]" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>}
              </div>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Periudha</p>
              <p className="text-[10px] font-black text-indigo-600 uppercase whitespace-nowrap">{getPeriodLabel()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input placeholder="Kërko nr. fature, klient ose artikull..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm outline-none font-medium"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase appearance-none cursor-pointer outline-none">
            <option value="all">Të Gjithë Statuset</option>
            <option value="E paguar">E Paguar</option>
            <option value="Pa paguar">Pa Paguar</option>
            <option value="Pasuar">Pasuar</option>
          </select>
          <button onClick={() => exportInvoicesToExcel(filteredInvoices)}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10">
            <FileSpreadsheet size={16} /> Eksporto
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap justify-between items-center gap-6 border-b-4 border-indigo-700">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl"><Calculator size={20} className="text-indigo-200" /></div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300">Aktiviteti i Periudhës së Filtruar</p>
            <p className="text-xs font-bold text-indigo-100">{filteredInvoices.length} faturime{cityFilter !== 'all' ? ` · ${cityFilter}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-10">
          <div className="text-right">
            <p className="text-[8px] font-black uppercase tracking-widest text-indigo-300 mb-1">Shitjet e Periudhës</p>
            <p className="text-lg font-black tracking-tight">{totals.sales.toLocaleString()} L</p>
          </div>
          <div className="text-right pr-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-300 mb-1">Arketimet e Periudhës</p>
            <p className="text-lg font-black tracking-tight text-emerald-400">{totals.collected.toLocaleString()} L</p>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[820px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[9px] uppercase font-bold tracking-widest">
              <tr>
                <th className="px-5 py-4">Nr.</th>
                <th className="px-5 py-4">Data</th>
                <th className="px-5 py-4">Klienti & Qyteti</th>
                <th className="px-5 py-4">Vlera Faturës</th>
                <th className="px-5 py-4">Arkëtuar</th>
                <th className="px-5 py-4">Detyrimi</th>
                <th className="px-5 py-4">Statusi</th>
                <th className="px-5 py-4 text-right">Veprime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ready && filteredInvoices.slice(0, visibleCount).map(inv => {
                const client = clientMap[inv.clientId];
                const cd = clientDebtMap[getClientKey(inv)];
                const absorbedStatus = getAbsorbedStatus(inv);
                const isAbsorbedAny = absorbedStatus !== 'none';

                // Fatura e fundit e paguar në datë tjetër, shfaqet si arkëtim i ditës
                const isArkëtuar = isDailyMode
                  && cd?.latestId === inv.id
                  && inv.status === 'E paguar'
                  && inv.date.slice(0, 10) !== activeDayStr
                  && cd?.latestPaymentDate === activeDayStr;

                // Vlerat e kolonave
                const vleraFature = inv.subtotal;
                const arkëtuar = inv.amountPaid || 0;
                const detyrimiPerInvoice = isAbsorbedAny ? 0 : Math.max(0, (inv.subtotal + (inv.previousBalance || 0)) - (inv.amountPaid || 0));
                const globalBalance = cd?.balance ?? 0;

                // Ngjyra rreshti
                const isPasuar = inv.status === 'Pasuar';
                const rowBg = isArkëtuar  ? 'bg-emerald-50/40' :
                              isPasuar    ? 'opacity-60' : '';

                // Status badge — drejtpërdrejt nga statusi i ruajtur
                const badgeClass =
                  isPasuar       ? 'bg-indigo-100 text-indigo-600' :
                  isArkëtuar     ? 'bg-yellow-100 text-yellow-700' :
                  globalBalance > 0 ? 'bg-rose-100 text-rose-700' :
                  globalBalance < 0 ? 'bg-amber-100 text-amber-700' :
                                      'bg-green-100 text-green-700';

                const badgeLabel =
                  isPasuar       ? 'Pasuar' :
                  isArkëtuar     ? 'Arkëtuar' :
                  globalBalance > 0 ? 'Pa paguar' :
                  globalBalance < 0 ? 'Me Tepricë' :
                                      'E paguar';

                const curr = cd?.currency ?? inv.currency;
                const fmt = (v: number) => curr === 'EUR' ? (v * 100).toLocaleString() : v.toLocaleString();

                return (
                  <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${rowBg}`}>
                    <td className="px-5 py-4 font-black text-slate-900">#{inv.invoiceNumber}</td>

                    <td className="px-5 py-4 text-xs font-bold text-slate-500">
                      {formatDateDisplay(inv.date.slice(0, 10))}
                      {isArkëtuar && (
                        <div className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">
                          ↳ Paguar {formatDateDisplay(activeDayStr)}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 truncate max-w-[160px]">
                      <button onClick={e => { e.stopPropagation(); onSelectClient(inv.clientId); }}
                        className="text-left hover:underline group/name block outline-none">
                        <div className="font-black text-blue-600 uppercase leading-none group-hover/name:text-blue-800 transition-colors">{inv.clientName}</div>
                      </button>
                      <div className="text-[9px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
                        <MapPin size={10} /> {inv.clientCity || client?.city || '---'}
                      </div>
                    </td>

                    {/* Vlera Faturës — subtotal i këtij faturimi */}
                    <td className="px-5 py-4">
                      <span className="font-black text-slate-800">{fmt(vleraFature)} L</span>
                      {curr === 'EUR' && <div className="text-[9px] font-bold text-slate-400 mt-0.5">{vleraFature.toLocaleString()} €</div>}
                    </td>

                    {/* Arkëtuar — shuma reale e marrë */}
                    <td className="px-5 py-4">
                      {arkëtuar > 0 ? (
                        <>
                          <span className="font-black text-emerald-700">{fmt(arkëtuar)} L</span>
                          {curr === 'EUR' && <div className="text-[9px] font-bold text-slate-400 mt-0.5">{arkëtuar.toLocaleString()} €</div>}
                        </>
                      ) : (
                        <span className="font-bold text-slate-300">—</span>
                      )}
                    </td>

                    {/* Detyrimi — mbetja e pa paguar */}
                    <td className="px-5 py-4">
                      {detyrimiPerInvoice > 0 ? (
                        <div className="flex items-center gap-1.5 font-black text-rose-600">
                          <TrendingDown size={12} />
                          {fmt(detyrimiPerInvoice)} L
                        </div>
                      ) : detyrimiPerInvoice < 0 ? (
                        <div className="flex items-center gap-1.5 font-black text-amber-600">
                          <Coins size={12} />
                          {fmt(Math.abs(detyrimiPerInvoice))} L
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-black text-emerald-600">
                          <Wallet size={12} /> 0 L
                        </div>
                      )}
                    </td>

                    {/* Statusi */}
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </td>

                    {/* Veprime */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {inv.status === 'Pa paguar' && onUpdateStatus && (
                          <button onClick={() => onUpdateStatus(inv.id, 'E paguar')}
                            className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Marko si të paguar"><CheckCircle2 size={16} /></button>
                        )}
                        <button onClick={() => onPreview(inv)} className="p-2 text-slate-400 hover:text-indigo-600 transition-all" title="Shiko"><Eye size={16} /></button>
                        <button onClick={() => onEdit(inv)} className="p-2 text-slate-400 hover:text-amber-600 transition-all" title="Ndrysho"><Edit3 size={16} /></button>
                        <button onClick={() => setConfirmId(inv.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-all" title="Fshi"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Shfaq më shumë */}
        {ready && filteredInvoices.length > visibleCount && (
          <div className="flex justify-center p-4 border-t border-slate-100">
            <button
              onClick={() => setVisibleCount(v => v + 50)}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 px-6 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-all">
              Shfaq më shumë ({filteredInvoices.length - visibleCount} mbetur)
            </button>
          </div>
        )}
      </div>
    </div>

      {confirmId && (
        <ConfirmDialog
          title="Fshi Faturën"
          message={`Fatura #${invoices.find(i=>i.id===confirmId)?.invoiceNumber} do të fshihet përgjithmonë. Jeni i sigurt?`}
          onConfirm={() => onDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </>
  );
};

export default InvoiceHistory;
