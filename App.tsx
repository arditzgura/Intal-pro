
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LayoutDashboard, FileText, Users, Package, PlusCircle,
  Menu, Settings, X as CloseIcon, Warehouse, ArrowLeft, LogOut, Loader2, Shield
} from 'lucide-react';
import { Client, Item, Invoice, StockEntry, View, BusinessConfig, InvoiceItem } from './types';
import { clearData, STORAGE_KEYS } from './utils/storage';
import { local } from './utils/localDb';
import { getLocalSession, clearLocalSession, setLocalSession } from './components/AuthScreen';

import Dashboard       from './components/Dashboard';
import ClientManager   from './components/ClientManager';
import ItemManager     from './components/ItemManager';
import InvoiceGenerator from './components/InvoiceGenerator';
import InvoiceHistory  from './components/InvoiceHistory';
import InvoicePreview  from './components/InvoicePreview';
import SettingsPanel   from './components/SettingsPanel';
import StockEntryManager   from './components/StockEntryManager';
import StockEntryGenerator from './components/StockEntryGenerator';
import ClientProfile   from './components/ClientProfile';
import ItemProfile     from './components/ItemProfile';
import StockEntryPreview from './components/StockEntryPreview';
import AuthScreen      from './components/AuthScreen';
import AdminPanel      from './components/AdminPanel';

const DEFAULT_CONFIG: BusinessConfig = {
  name: 'INTAL ALBANIA', nipt: 'L12345678X',
  address: 'Rruga Kryesore, Qyteti, Shqipëri',
  phone: '+355 69 27 76 636', email: 'info@intalal.com',
  website: 'www.intalal.com', slogan: 'Cilësia është prioriteti ynë'
};

const App: React.FC = () => {
  // ─── Auth (lokal) ──────────────────────────────────────────────────────────
  const [session,   setSession]  = useState<{ user: { id: string; username: string } } | null | undefined>(undefined);
  const [dataReady, setDataReady] = useState(false);

  // ─── Data ──────────────────────────────────────────────────────────────────
  const [clients,      setClients]      = useState<Client[]>([]);
  const [items,        setItems]        = useState<Item[]>([]);
  const [invoices,     setInvoices]     = useState<Invoice[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [config,       setConfig]       = useState<BusinessConfig>(DEFAULT_CONFIG);

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [currentView,           setCurrentView]           = useState<View>('dashboard');
  const [viewHistory,           setViewHistory]           = useState<View[]>(['dashboard']);
  const [previewInvoice,        setPreviewInvoice]        = useState<Invoice | null>(null);
  const [previewStockEntry,     setPreviewStockEntry]     = useState<StockEntry | null>(null);
  const [editInvoice,           setEditInvoice]           = useState<Invoice | null>(null);
  const [editStockEntry,        setEditStockEntry]        = useState<StockEntry | null>(null);
  const [selectedProfileClient, setSelectedProfileClient] = useState<Client | null>(null);
  const [selectedProfileItem,   setSelectedProfileItem]   = useState<Item | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const mainRef         = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  // ─── Ngarko të dhënat nga localStorage (me migrim automatik) ────────────────
  const loadAllData = useCallback((userId: string) => {
    let invs  = local.getAll<Invoice>(userId, 'invoices');
    let cls   = local.getAll<Client>(userId, 'clients');
    let itms  = local.getAll<Item>(userId, 'items');
    let stock = local.getAll<StockEntry>(userId, 'stock_entries');
    let cfg   = local.getConfig(userId);

    // Migrim: nëse nuk ka të dhëna, kërko nën ID-të e vjetra (Supabase)
    if (!invs.length) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        const m = key.match(/^intal_(.+)_invoices$/);
        if (m && m[1] !== userId) {
          const oldId = m[1];
          const oldInvs = local.getAll<Invoice>(oldId, 'invoices');
          if (oldInvs.length > 0) {
            // Migro të dhënat nga ID e vjetër tek e reja
            cls   = local.getAll<Client>(oldId, 'clients');
            itms  = local.getAll<Item>(oldId, 'items');
            invs  = oldInvs;
            stock = local.getAll<StockEntry>(oldId, 'stock_entries');
            cfg   = local.getConfig(oldId) ?? cfg;
            local.setAll(userId, 'clients',       cls);
            local.setAll(userId, 'items',         itms);
            local.setAll(userId, 'invoices',      invs);
            local.setAll(userId, 'stock_entries', stock);
            if (cfg) local.setConfig(userId, cfg);
            console.log(`[migrate] ${oldInvs.length} invoices nga ${oldId} → ${userId}`);
            break;
          }
        }
      }
    }

    setClients(cls);
    setItems(itms);
    setInvoices(invs);
    setStockEntries(stock);
    if (cfg) setConfig({ ...DEFAULT_CONFIG, ...cfg });
    setDataReady(true);
  }, []);

  // ─── Auth: ngarko sesionin lokal ──────────────────────────────────────────
  useEffect(() => {
    const sess = getLocalSession();
    if (sess) {
      setSession({ user: { id: sess.user.id, username: sess.user.username } });
      loadAllData(sess.user.id);
    } else {
      setSession(null);
      setDataReady(true);
    }
  }, [loadAllData]);

  // ─── Pikët e klientëve ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || !clients.length) return;
    const userId = session.user.id;
    const updated = clients.map(client => {
      const pts = invoices
        .filter(inv => inv.clientId === client.id && inv.status !== 'Anuluar')
        .reduce((s, inv) => s + (inv.currency === 'EUR'
          ? Math.floor(inv.subtotal || 0)
          : Math.floor((inv.subtotal || 0) / 100)), 0);
      return client.points !== pts ? { ...client, points: pts } : client;
    });
    const changedC = updated.filter((u, i) => u !== clients[i]);
    if (changedC.length > 0) {
      setClients(updated);
      local.setAll(userId, 'clients', updated);
    }
  }, [invoices]); // eslint-disable-line

  // ─── Config auto-save ──────────────────────────────────────────────────────
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || !dataReady) return;
    if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(() => {
      local.setConfig(session.user.id, config);
    }, 800);
  }, [config]); // eslint-disable-line

  // ─── Backup lokal ─────────────────────────────────────────────────────────
  const doBackup = useCallback((isAuto = false) => {
    if (!session) return;
    const uid = session.user.id;
    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      user: session.user.username,
      invoices:      local.getAll(uid, 'invoices'),
      clients:       local.getAll(uid, 'clients'),
      items:         local.getAll(uid, 'items'),
      stock_entries: local.getAll(uid, 'stock_entries'),
      config:        local.getConfig(uid),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toLocaleDateString('en-CA');
    a.href     = url;
    a.download = `intal-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('intal_last_backup', Date.now().toString());
    if (!isAuto) alert(`✅ Backup u ruajt:\nintal-backup-${date}.json\n\nFaturat: ${(data.invoices as any[]).length} | Klientët: ${(data.clients as any[]).length} | Artikujt: ${(data.items as any[]).length}`);
  }, [session]);

  // Auto-backup çdo 24 orë kur hapet app-i
  useEffect(() => {
    if (!session || !dataReady) return;
    const last = parseInt(localStorage.getItem('intal_last_backup') || '0');
    const diff = Date.now() - last;
    if (diff > 24 * 60 * 60 * 1000) { // 24 orë
      setTimeout(() => doBackup(true), 3000); // pas 3 sekondash
    }
  }, [session, dataReady, doBackup]);

  // ─── Scroll restore ───────────────────────────────────────────────────────
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const h = () => { scrollPositions.current[currentView] = main.scrollTop; };
    main.addEventListener('scroll', h);
    return () => main.removeEventListener('scroll', h);
  }, [currentView]);
  useEffect(() => {
    setTimeout(() => { if (mainRef.current) mainRef.current.scrollTop = scrollPositions.current[currentView] || 0; }, 0);
  }, [currentView]);

  // ─── Helpers navigimi ──────────────────────────────────────────────────────
  const handleNavigate = (view: View) => {
    if (view !== currentView) { setViewHistory(p => [...p, view]); setCurrentView(view); }
    setEditInvoice(null); setEditStockEntry(null);
    setSelectedProfileClient(null); setSelectedProfileItem(null);
    setIsMobileMenuOpen(false);
  };

  const handleGoBack = () => {
    if (selectedProfileClient) { setSelectedProfileClient(null); return; }
    if (selectedProfileItem)   { setSelectedProfileItem(null);   return; }
    if (previewInvoice)        { setPreviewInvoice(null);        return; }
    if (previewStockEntry)     { setPreviewStockEntry(null);     return; }
    if (viewHistory.length > 1) {
      const h = [...viewHistory]; h.pop();
      setViewHistory(h); setCurrentView(h[h.length - 1]);
    } else if (currentView !== 'dashboard') {
      setCurrentView('dashboard'); setViewHistory(['dashboard']);
    }
  };

  const handleLogout = () => {
    clearLocalSession();
    setSession(null);
    setClients([]); setItems([]); setInvoices([]); setStockEntries([]);
    setConfig(DEFAULT_CONFIG);
    setDataReady(false);
  };

  // ─── Computed ──────────────────────────────────────────────────────────────
  const nextInvoiceNumber = useMemo(() => {
    if (!invoices.length) return '5507';
    const nums = invoices.map(inv => parseInt(inv.invoiceNumber)).filter(n => !isNaN(n));
    return (nums.length ? Math.max(...nums) + 1 : 5507).toString();
  }, [invoices]);

  const nextStockNumber = useMemo(() => {
    if (!stockEntries.length) return '1001';
    const nums = stockEntries.map(e => parseInt(e.entryNumber)).filter(n => !isNaN(n));
    return (nums.length ? Math.max(...nums) + 1 : 1001).toString();
  }, [stockEntries]);

  // ─── CRUD lokal ───────────────────────────────────────────────────────────
  const uid = session?.user.id ?? '';

  const handleUpdateInvoiceStatus = (id: string, status: Invoice['status']) => {
    const target = invoices.find(inv => inv.id === id);
    if (!target) return;
    const today = new Date().toLocaleDateString('en-CA');
    const updated = invoices.map(inv => {
      if (status === 'E paguar') {
        if (inv.clientId === target.clientId && (inv.id === id || inv.status === 'Pa paguar'))
          return { ...inv, status: 'E paguar' as const, amountPaid: inv.subtotal + (inv.previousBalance || 0), paymentDate: inv.paymentDate || today };
      } else if (status === 'Pa paguar') {
        if (inv.id === id) return { ...inv, status, paymentDate: undefined };
      } else {
        if (inv.id === id) return { ...inv, status };
      }
      return inv;
    });
    setInvoices(updated);
    local.setAll(uid, 'invoices', updated);
  };

  const handleAddStockEntry = (entry: StockEntry, updatePrices: boolean) => {
    const newEntries = editStockEntry
      ? stockEntries.map(e => e.id === entry.id ? entry : e)
      : [entry, ...stockEntries];
    setStockEntries(newEntries);
    local.setAll(uid, 'stock_entries', newEntries);
    setEditStockEntry(null);

    let updatedItems = [...items]; let changed = false;
    entry.items.forEach(si => {
      const idx = updatedItems.findIndex(i => i.id === si.itemId || i.name.toLowerCase() === si.name.toLowerCase());
      if (idx >= 0) {
        updatedItems[idx] = { ...updatedItems[idx], purchasePrice: si.purchasePrice, ...(updatePrices ? { price: si.sellingPrice } : {}) };
        changed = true;
      } else {
        const ni: Item = { id: 'item-' + Date.now() + Math.random().toString(36).substr(2,5), name: si.name, unit: 'copë', price: si.sellingPrice, purchasePrice: si.purchasePrice, preferentialPrices: [] };
        updatedItems.push(ni); changed = true;
      }
    });
    if (changed) { setItems(updatedItems); local.setAll(uid, 'items', updatedItems); }
    handleNavigate('stock-entries');
  };

  const addOrUpdateInvoice = (invoice: Invoice) => {
    let final = { ...invoice };
    let updClients = [...clients], updItems = [...items];
    let cChanged = false, iChanged = false;

    const cLow = invoice.clientName.trim().toLowerCase();
    const existing = updClients.find(c => c.name.toLowerCase() === cLow);
    if (!existing) {
      const nc: Client = { id: Date.now().toString(), name: invoice.clientName.trim(), city: invoice.clientCity || '', address: '', phone: invoice.clientPhone || '', email: '', points: 0 };
      updClients.push(nc); final.clientId = nc.id; cChanged = true;
    } else { final.clientId = existing.id; }

    final.items = invoice.items.map(invItem => {
      const iLow = invItem.name.trim().toLowerCase();
      const ex = updItems.find(i => i.name.toLowerCase() === iLow);
      if (!ex) {
        const ni: Item = { id: 'item-' + Date.now() + Math.random().toString(36).substr(2,5), name: invItem.name.trim(), unit: 'copë', price: invItem.price, preferentialPrices: [] };
        updItems.push(ni); iChanged = true;
        return { ...invItem, itemId: ni.id };
      }
      return { ...invItem, itemId: ex.id };
    });

    if (cChanged) { setClients(updClients); local.setAll(uid, 'clients', updClients); }
    if (iChanged) { setItems(updItems); local.setAll(uid, 'items', updItems); }

    const today = new Date().toLocaleDateString('en-CA');
    if (final.status === 'E paguar' && !final.paymentDate) final.paymentDate = today;

    let newInvoices: Invoice[];
    if (final.status === 'E paguar') {
      const base = editInvoice ? invoices.filter(inv => inv.id !== final.id) : invoices;
      newInvoices = [final, ...base.map(inv =>
        inv.clientId === final.clientId && inv.status === 'Pa paguar'
          ? { ...inv, status: 'E paguar' as const, amountPaid: inv.subtotal + (inv.previousBalance || 0), paymentDate: inv.paymentDate || today }
          : inv
      )];
    } else {
      newInvoices = editInvoice ? invoices.map(inv => inv.id === final.id ? final : inv) : [final, ...invoices];
    }
    setInvoices(newInvoices);
    local.setAll(uid, 'invoices', newInvoices);

    setEditInvoice(null);
    clearData(STORAGE_KEYS.DRAFT);
    handleNavigate('invoices');
    setPreviewInvoice(final);
  };

  const handleNewInvoiceForClient = (client: Client) => {
    const latest = invoices.filter(inv => inv.clientId === client.id && inv.status !== 'Anuluar').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const debt = latest ? (latest.subtotal + (latest.previousBalance||0)) - (latest.amountPaid||0) : 0;
    const tpl: any = { id:'', invoiceNumber: nextInvoiceNumber, date: new Date().toLocaleDateString('en-CA')+'T'+new Date().toTimeString().split(' ')[0], clientId: client.id, clientName: client.name, clientPhone: client.phone||client.address||'', clientCity: client.city||'', items:[], currency:'Lek', subtotal:0, tax:0, previousBalance: debt, amountPaid:0, total:0, status:'Pa paguar' };
    setViewHistory(p => [...p,'new-invoice']); setCurrentView('new-invoice');
    setEditInvoice(tpl); setSelectedProfileClient(null); setIsMobileMenuOpen(false);
  };

  // ─── Rendering ─────────────────────────────────────────────────────────────
  // Loading fillestar (kontrollojmë session)
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-[#D81B60] animate-spin" />
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Duke u lidhur...</p>
        </div>
      </div>
    );
  }

  // Pa sesion → ekrani i login-it
  if (!session) return <AuthScreen onAuth={(user) => {
    setSession({ user: { id: user.id, username: user.username } });
    loadAllData(user.id);
  }} />;

  // Me sesion por të dhënat nuk janë gati
  if (!dataReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-[#D81B60] animate-spin" />
          <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">Duke ngarkuar të dhënat...</p>
        </div>
      </div>
    );
  }

  const username = session.user.username || 'Përdoruesi';
  const isAdmin = username === 'arditzgura';
  const showGlobalBack = currentView !== 'dashboard' || selectedProfileClient || selectedProfileItem || previewInvoice || previewStockEntry;

  const navItems = [
    { id: 'dashboard',    label: 'Paneli',     icon: <LayoutDashboard size={18}/> },
    { id: 'new-invoice',  label: 'Faturë e Re',icon: <PlusCircle size={18}/> },
    { id: 'invoices',     label: 'Historia',   icon: <FileText size={18}/> },
    { id: 'clients',      label: 'Klientët',   icon: <Users size={18}/> },
    { id: 'items',        label: 'Artikujt',   icon: <Package size={18}/> },
    { id: 'stock-entries',label: 'Flethyrje',  icon: <Warehouse size={18}/> },
    { id: 'settings',     label: 'Cilësimet',  icon: <Settings size={18}/> },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: <Shield size={18}/> }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-[#D81B60] p-1.5 rounded-lg shadow-lg"><FileText size={22}/></div>
          <span className="text-xl font-black italic tracking-tighter">INTAL <span className="text-[#D81B60]">PRO</span></span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => handleNavigate(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${currentView === item.id || (item.id==='stock-entries' && currentView==='new-stock-entry') ? 'bg-[#D81B60] text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">I kyçur si</p>
              <p className="text-xs text-white font-black uppercase truncate max-w-[120px]">{username}</p>
            </div>
            <button onClick={handleLogout} title="Dil" className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-all">
              <LogOut size={16}/>
            </button>
          </div>
          <p className="text-[9px] text-slate-600 text-center font-bold uppercase tracking-widest">Versioni 2.0 — Cloud</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-slate-900 lg:bg-white text-white lg:text-slate-900 p-4 border-b border-slate-200 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
            {showGlobalBack && (
              <button onClick={handleGoBack} className="flex items-center gap-2 bg-slate-100 lg:bg-slate-900 text-slate-600 lg:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md">
                <ArrowLeft size={16} strokeWidth={3}/> Kthehu
              </button>
            )}
            <div className="lg:hidden flex items-center gap-2">
              <div className="bg-[#D81B60] p-1 rounded-md"><FileText size={18} className="text-white"/></div>
              <span className="font-black italic text-sm text-white">INTAL PRO</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">I kyçur si</p>
                <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{username}</p>
              </div>
              <button onClick={handleLogout} title="Dil" className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all">
                <LogOut size={18}/>
              </button>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2"><Menu/></button>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-3 md:p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                  {navItems.find(n => n.id === currentView)?.label || (currentView==='new-stock-entry' ? 'Detajet e Fletëhyrjes' : currentView==='admin' ? 'Admin' : '')}
                </h2>
                <p className="text-slate-400 text-xs md:text-sm font-medium">Sistemi i Menaxhimit për {config.name}</p>
              </div>
            </div>

            {currentView==='dashboard'     && <Dashboard invoices={invoices} clients={clients} items={items} stockEntries={stockEntries}/>}
            {currentView==='new-invoice'   && <InvoiceGenerator key={nextInvoiceNumber} clients={clients} items={items} invoices={invoices} initialData={editInvoice} defaultInvoiceNumber={nextInvoiceNumber} onSubmit={addOrUpdateInvoice} onCancel={handleGoBack} onAddItem={i=>{const upd=[...items,i];setItems(upd);local.setAll(uid,'items',upd);}}/>}
            {currentView==='stock-entries' && <StockEntryManager entries={stockEntries} items={items} onAddNew={() => {setEditStockEntry(null);setCurrentView('new-stock-entry');}} onEdit={e=>{setEditStockEntry(e);setCurrentView('new-stock-entry');}} onDelete={id=>{const upd=stockEntries.filter(e=>e.id!==id);setStockEntries(upd);local.setAll(uid,'stock_entries',upd);}} onPreview={setPreviewStockEntry}/>}
            {currentView==='new-stock-entry' && <StockEntryGenerator items={items} invoices={invoices} nextNumber={nextStockNumber} initialData={editStockEntry} onSave={handleAddStockEntry} onCancel={handleGoBack}/>}
            {currentView==='invoices'      && <InvoiceHistory invoices={invoices} clients={clients} onDelete={id=>{const upd=invoices.filter(i=>i.id!==id);setInvoices(upd);local.setAll(uid,'invoices',upd);}} onPreview={setPreviewInvoice} onEdit={inv=>{setPreviewInvoice(null);setEditInvoice(inv);setCurrentView('new-invoice');}} onUpdateStatus={handleUpdateInvoiceStatus} onSelectClient={cid=>{const c=clients.find(cl=>cl.id===cid);if(c)setSelectedProfileClient(c);}}/>}
            {currentView==='clients'       && <ClientManager clients={clients} items={items} invoices={invoices} onAdd={c=>{const upd=[...clients,c];setClients(upd);local.setAll(uid,'clients',upd);}} onUpdate={u=>{const upd=clients.map(c=>c.id===u.id?u:c);setClients(upd);local.setAll(uid,'clients',upd);}} onDelete={id=>{const upd=clients.filter(c=>c.id!==id);setClients(upd);local.setAll(uid,'clients',upd);}} onUpdateItems={ni=>{setItems(ni);local.setAll(uid,'items',ni);}} onPreviewInvoice={setPreviewInvoice} onOpenProfile={setSelectedProfileClient}/>}
            {currentView==='items'         && <ItemManager items={items} clients={clients} invoices={invoices} stockEntries={stockEntries} onAdd={i=>{const upd=[...items,i];setItems(upd);local.setAll(uid,'items',upd);}} onUpdate={u=>{const upd=items.map(i=>i.id===u.id?u:i);setItems(upd);local.setAll(uid,'items',upd);}} onDelete={id=>{const upd=items.filter(i=>i.id!==id);setItems(upd);local.setAll(uid,'items',upd);}} onOpenProfile={setSelectedProfileItem}/>}
            {currentView==='admin'         && isAdmin && <AdminPanel />}
            {currentView==='settings'      && (
              <SettingsPanel config={config} onUpdate={setConfig}
                onExport={() => doBackup(false)}
                onImport={async (file) => {
                  try {
                    const text = await file.text();
                    const bk = JSON.parse(text);
                    if (!bk || typeof bk !== 'object') return false;
                    // Mbështet version 1 (i vjetër) dhe version 2
                    const cl  = Array.isArray(bk.clients)      ? bk.clients      : [];
                    const it  = Array.isArray(bk.items)         ? bk.items         : [];
                    const inv = Array.isArray(bk.invoices)      ? bk.invoices      : [];
                    const se  = Array.isArray(bk.stockEntries)  ? bk.stockEntries  : [];
                    const cf  = bk.config && typeof bk.config === 'object' ? { ...DEFAULT_CONFIG, ...bk.config } : null;
                    // Ruaj vetëm lokalisht
                    if (cl.length)  { local.setAll(uid,'clients',cl);       setClients(cl); }
                    if (it.length)  { local.setAll(uid,'items',it);         setItems(it); }
                    if (inv.length) { local.setAll(uid,'invoices',inv);     setInvoices(inv); }
                    if (se.length)  { local.setAll(uid,'stock_entries',se); setStockEntries(se); }
                    if (cf)         { local.setConfig(uid,cf);              setConfig(cf); }
                    handleNavigate('dashboard');
                    return true;
                  } catch { return false; }
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={()=>setIsMobileMenuOpen(false)}/>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-slate-900 p-6 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <span className="font-black italic text-white uppercase">Menu</span>
              <button onClick={()=>setIsMobileMenuOpen(false)} className="text-white"><CloseIcon/></button>
            </div>
            <div className="flex-1 space-y-2">
              {navItems.map(item => (
                <button key={item.id} onClick={()=>handleNavigate(item.id as View)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${currentView===item.id?'bg-[#D81B60] text-white':'text-slate-400 hover:text-white'}`}>
                  {item.icon}{item.label}
                </button>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-800">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">I kyçur si</p>
              <p className="text-xs text-white font-black uppercase mb-3">{username}</p>
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 transition-all text-xs font-black uppercase">
                <LogOut size={14}/> Dil nga llogaria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      {previewInvoice  && <InvoicePreview invoice={previewInvoice} business={config} client={clients.find(c=>c.id===previewInvoice.clientId)} onClose={()=>setPreviewInvoice(null)} onEdit={inv=>{setPreviewInvoice(null);setEditInvoice(inv);setCurrentView('new-invoice');}}/>}
      {previewStockEntry && <StockEntryPreview entry={previewStockEntry} business={config} onClose={()=>setPreviewStockEntry(null)} onEdit={e=>{setPreviewStockEntry(null);setEditStockEntry(e);setCurrentView('new-stock-entry');}}/>}
      {selectedProfileClient && <ClientProfile client={selectedProfileClient} invoices={invoices} items={items} onUpdateItems={ni=>{setItems(ni);local.setAll(uid,'items',ni);}} onUpdateClient={u=>{const upd=clients.map(c=>c.id===u.id?u:c);setClients(upd);local.setAll(uid,'clients',upd);}} onClose={()=>setSelectedProfileClient(null)} onViewInvoice={inv=>{setSelectedProfileClient(null);setPreviewInvoice(inv);}} onNewInvoice={handleNewInvoiceForClient}/>}
      {selectedProfileItem && <ItemProfile item={selectedProfileItem} invoices={invoices} stockEntries={stockEntries} clients={clients} onUpdateItem={u=>{const upd=items.map(i=>i.id===u.id?u:i);setItems(upd);local.setAll(uid,'items',upd);}} onClose={()=>setSelectedProfileItem(null)}/>}
    </div>
  );
};

export default App;
