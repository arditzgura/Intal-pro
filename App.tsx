
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LayoutDashboard, FileText, Users, Package, PlusCircle,
  Menu, Settings, X as CloseIcon, Warehouse, ArrowLeft, LogOut, Loader2, Shield
} from 'lucide-react';
import { Client, Item, Invoice, StockEntry, View, BusinessConfig, InvoiceItem } from './types';
import { clearData, STORAGE_KEYS } from './utils/storage';
import { supabase } from './utils/supabase';
import { db } from './utils/db';
import { local } from './utils/localDb';
import type { Session, RealtimeChannel } from '@supabase/supabase-js';

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
  // ─── Auth ──────────────────────────────────────────────────────────────────
  const [session,     setSession]    = useState<Session | null | undefined>(undefined); // undefined = loading
  const [realSession, setRealSession] = useState<Session | null>(null); // sesioni real nga Supabase (për realtime)
  const [dataReady,   setDataReady]  = useState(false);

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
  const [isMobileMenuOpen,      setIsMobileMenuOpen]      = useState(false);
  const [syncError,             setSyncError]             = useState<string | null>(null);
  const [isRefreshing,          setIsRefreshing]          = useState(false);

  const mainRef          = useRef<HTMLDivElement>(null);
  const scrollPositions  = useRef<Record<string, number>>({});
  const realtimeChannel  = useRef<RealtimeChannel | null>(null);

  // ─── Ngarko të dhënat: localStorage (i menjëhershëm) + Supabase (background) ─
  const loadAllData = useCallback(async (userId: string) => {
    // 1. Ngarko nga localStorage menjëherë — shfaq UI pa vonesa
    const localClients  = local.getAll<Client>(userId, 'clients');
    const localItems    = local.getAll<Item>(userId, 'items');
    const localInvoices = local.getAll<Invoice>(userId, 'invoices');
    const localStock    = local.getAll<StockEntry>(userId, 'stock_entries');
    const localCfg      = local.getConfig(userId);
    setClients(localClients);
    setItems(localItems);
    setInvoices(localInvoices);
    setStockEntries(localStock);
    if (localCfg) setConfig({ ...DEFAULT_CONFIG, ...localCfg });
    setDataReady(true);

    // 2. Sinkronizo me Supabase në background (nëse ka internet)
    try {
      const [cls, itms, invs, stock, cfg] = await Promise.all([
        db.clients.fetchAll(userId),
        db.items.fetchAll(userId),
        db.invoices.fetchAll(userId),
        db.stockEntries.fetchAll(userId),
        db.config.fetch(userId),
      ]);

      // Merge: bashko të dhënat cloud me ato lokale (cloud ka prioritet për rekorde ekzistuese)
      const merge = <T extends { id: string }>(cloud: T[], local: T[]): T[] => {
        const map = new Map<string, T>();
        local.forEach(r => map.set(r.id, r));   // fillimisht lokalet
        cloud.forEach(r => map.set(r.id, r));   // cloud mbishkruan lokalet (versioni më i ri)
        return Array.from(map.values());
      };

      const mergedClients  = merge(cls,   localClients);
      const mergedItems    = merge(itms,  localItems);
      const mergedInvoices = merge(invs,  localInvoices);
      const mergedStock    = merge(stock, localStock);

      setClients(mergedClients);
      setItems(mergedItems);
      setInvoices(mergedInvoices);
      setStockEntries(mergedStock);
      if (cfg) setConfig({ ...DEFAULT_CONFIG, ...cfg });

      // Ngarko në Supabase rekordet që mungojnë (janë vetëm lokalisht)
      const missingClients  = localClients.filter(r  => !cls.find(c  => c.id === r.id));
      const missingItems    = localItems.filter(r    => !itms.find(c => c.id === r.id));
      const missingInvoices = localInvoices.filter(r => !invs.find(c => c.id === r.id));
      const missingStock    = localStock.filter(r    => !stock.find(c => c.id === r.id));

      if (missingClients.length)  { console.log(`[sync] uploading ${missingClients.length} missing clients`);  db.clients.upsertMany(userId, missingClients); }
      if (missingItems.length)    { console.log(`[sync] uploading ${missingItems.length} missing items`);      db.items.upsertMany(userId, missingItems); }
      if (missingInvoices.length) { console.log(`[sync] uploading ${missingInvoices.length} missing invoices`); db.invoices.upsertMany(userId, missingInvoices); }
      if (missingStock.length)    { console.log(`[sync] uploading ${missingStock.length} missing stock`);      db.stockEntries.upsertMany(userId, missingStock); }

      // Ruaj gjendjen e bashkuar lokalisht
      local.setAll(userId, 'clients',       mergedClients);
      local.setAll(userId, 'items',         mergedItems);
      local.setAll(userId, 'invoices',      mergedInvoices);
      local.setAll(userId, 'stock_entries', mergedStock);
    } catch {
      // Offline — vazhdo me të dhënat lokale
      console.info('[offline] Duke përdorur të dhënat lokale');
    }
  }, []);

  // ─── Sync error listener ───────────────────────────────────────────────────
  useEffect(() => {
    const onErr = (e: Event) => {
      const { table, msg } = (e as CustomEvent).detail;
      setSyncError(`Gabim sinkronizimi (${table}): ${msg}`);
    };
    const onOk = () => setSyncError(null);
    window.addEventListener('intal-sync-error', onErr);
    window.addEventListener('intal-sync-ok', onOk);
    return () => { window.removeEventListener('intal-sync-error', onErr); window.removeEventListener('intal-sync-ok', onOk); };
  }, []);

  const handleForceRefresh = async () => {
    if (!session || isRefreshing) return;
    setIsRefreshing(true);
    try { await loadAllData(session.user.id); setSyncError(null); }
    finally { setIsRefreshing(false); }
  };

  // ─── Auth state change ─────────────────────────────────────────────────────
  const checkBlocked = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.from('profiles').select('is_blocked').eq('user_id', userId).single();
      return data?.is_blocked === true;
    } catch { return false; }
  };

  useEffect(() => {
    // Lexo sesionin nga localStorage menjëherë (sinkron, pa rrjet)
    // Supabase e ruan sesionin me çelësin: sb-<ref>-auth-token
    const getLocalSession = (): any => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || '';
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const val = JSON.parse(localStorage.getItem(key) || 'null');
            if (val?.access_token) return val;
          }
        }
      } catch { /* ignore */ }
      return null;
    };

    const localSess = getLocalSession();
    if (localSess) {
      // Ka sesion lokal — ngarko të dhënat menjëherë pa pritur Supabase
      const fakeSession = { user: { id: localSess.user?.id, user_metadata: localSess.user?.user_metadata, email: localSess.user?.email } } as any;
      setSession(fakeSession);
      loadAllData(fakeSession.user.id);
    }

    // Valido/rifresko sesionin me Supabase (në background, timeout 15s)
    const timeout = setTimeout(() => {
      if (!localSess) { setSession(null); setDataReady(true); }
    }, 15000);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      if (data.session) {
        setSession(data.session);
        setRealSession(data.session);
        // Gjithmonë rifresko nga cloud kur kemi sesion real (me auth token të vlefshëm)
        // Kur kishim localSess, thirrjet Supabase dështonin sepse client s'kishte token
        loadAllData(data.session.user.id);
      } else {
        // Token lokal nuk është valid — fshi dhe shfaq login
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i) || '';
            if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
          }
        } catch {}
        setSession(null);
        setDataReady(true);
      }
    }).catch(() => {
      clearTimeout(timeout);
      // Offline — lejo sesionin lokal të vazhdojë
      if (localSess) return;
      setSession(null);
      setDataReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'INITIAL_SESSION') return;

      if (sess && event === 'SIGNED_IN') {
        const blocked = await checkBlocked(sess.user.id);
        if (blocked) { await supabase.auth.signOut(); return; }
      }

      setRealSession(sess); // përditëso sesionin real (realtime)
      setSession(sess);
      if (sess) {
        setDataReady(false);
        loadAllData(sess.user.id);
      } else {
        setClients([]); setItems([]); setInvoices([]); setStockEntries([]);
        setConfig(DEFAULT_CONFIG); setDataReady(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadAllData]);

  // ─── Real-time subscriptions — vetëm me sesion real nga Supabase ────────────
  useEffect(() => {
    if (!realSession) {
      realtimeChannel.current?.unsubscribe();
      realtimeChannel.current = null;
      return;
    }
    const userId = realSession.user.id;

    // Krijoni channel me filtër për user_id
    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients',      filter: `user_id=eq.${userId}` },
        () => db.clients.fetchAll(userId).then(setClients).catch(console.error))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items',        filter: `user_id=eq.${userId}` },
        () => db.items.fetchAll(userId).then(setItems).catch(console.error))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices',     filter: `user_id=eq.${userId}` },
        () => db.invoices.fetchAll(userId).then(setInvoices).catch(console.error))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_entries',filter: `user_id=eq.${userId}` },
        () => db.stockEntries.fetchAll(userId).then(setStockEntries).catch(console.error))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_config',  filter: `user_id=eq.${userId}` },
        () => db.config.fetch(userId).then(cfg => { if (cfg) setConfig(c => ({ ...c, ...cfg })); }).catch(console.error))
      .subscribe();

    realtimeChannel.current = channel;
    return () => { channel.unsubscribe(); };
  }, [realSession]);

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
      db.clients.saveAll(userId, updated, changedC);
    }
  }, [invoices]); // eslint-disable-line

  // ─── Config auto-save ──────────────────────────────────────────────────────
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || !dataReady) return;
    if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(() => {
      db.config.save(session.user.id, config).catch(console.error);
    }, 800);
  }, [config]); // eslint-disable-line

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

  const handleLogout = async () => {
    // 1. Fshi token nga localStorage menjëherë (sinkron)
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
      }
    } catch {}
    // 2. Pastro state
    setSession(null);
    setRealSession(null);
    setClients([]); setItems([]); setInvoices([]); setStockEntries([]);
    setConfig(DEFAULT_CONFIG);
    // 3. Njofto Supabase në background
    supabase.auth.signOut().catch(() => {});
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

  // ─── CRUD me Supabase ──────────────────────────────────────────────────────
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
    const changedInvs = updated.filter((u, i) => u !== invoices[i]); // pozicioni nuk ndryshon këtu
    db.invoices.saveAll(uid, updated, changedInvs.slice(0, 50)); // max 50
  };

  const handleAddStockEntry = (entry: StockEntry, updatePrices: boolean) => {
    const newEntries = editStockEntry
      ? stockEntries.map(e => e.id === entry.id ? entry : e)
      : [entry, ...stockEntries];
    setStockEntries(newEntries);
    db.stockEntries.upsert(uid, entry).catch(console.error);
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
    if (changed) { setItems(updatedItems); updatedItems.forEach(i => db.items.upsert(uid, i).catch(console.error)); }
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
      db.clients.upsert(uid, nc).catch(console.error);
    } else { final.clientId = existing.id; }

    final.items = invoice.items.map(invItem => {
      const iLow = invItem.name.trim().toLowerCase();
      const ex = updItems.find(i => i.name.toLowerCase() === iLow);
      if (!ex) {
        const ni: Item = { id: 'item-' + Date.now() + Math.random().toString(36).substr(2,5), name: invItem.name.trim(), unit: 'copë', price: invItem.price, preferentialPrices: [] };
        updItems.push(ni); iChanged = true;
        db.items.upsert(uid, ni).catch(console.error);
        return { ...invItem, itemId: ni.id };
      }
      return { ...invItem, itemId: ex.id };
    });

    if (cChanged) setClients(updClients);
    if (iChanged) setItems(updItems);

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
    // Krahaso sipas ID-së (jo pozicionit) — parandalon dërgimin e të gjitha faturave
    const oldMap = new Map(invoices.map(inv => [inv.id, inv]));
    const changed = newInvoices.filter(u => {
      const old = oldMap.get(u.id);
      return !old || JSON.stringify(old) !== JSON.stringify(u);
    });
    db.invoices.saveAll(uid, newInvoices, changed);

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
  if (!session) return <AuthScreen onAuth={() => {}} />;

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

  const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Përdoruesi';
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
            <button onClick={handleForceRefresh} title="Rifresko të dhënat nga cloud"
              className={`p-2 rounded-xl transition-all ${isRefreshing ? 'text-[#D81B60]' : syncError ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-[#D81B60]'} hover:bg-slate-50`}>
              <Loader2 size={18} className={isRefreshing ? 'animate-spin' : ''} strokeWidth={isRefreshing ? 2.5 : 2}/>
            </button>
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

        {syncError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
            <p className="text-amber-800 text-[11px] font-bold truncate">{syncError}</p>
            <button onClick={() => setSyncError(null)} className="text-amber-500 hover:text-amber-700 shrink-0 text-xs font-black">✕</button>
          </div>
        )}
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
            {currentView==='new-invoice'   && <InvoiceGenerator key={nextInvoiceNumber} clients={clients} items={items} invoices={invoices} initialData={editInvoice} defaultInvoiceNumber={nextInvoiceNumber} onSubmit={addOrUpdateInvoice} onCancel={handleGoBack}/>}
            {currentView==='stock-entries' && <StockEntryManager entries={stockEntries} items={items} onAddNew={() => {setEditStockEntry(null);setCurrentView('new-stock-entry');}} onEdit={e=>{setEditStockEntry(e);setCurrentView('new-stock-entry');}} onDelete={id=>{setStockEntries(p=>p.filter(e=>e.id!==id)); db.stockEntries.remove(uid,id).catch(console.error);}} onPreview={setPreviewStockEntry}/>}
            {currentView==='new-stock-entry' && <StockEntryGenerator items={items} nextNumber={nextStockNumber} initialData={editStockEntry} onSave={handleAddStockEntry} onCancel={handleGoBack}/>}
            {currentView==='invoices'      && <InvoiceHistory invoices={invoices} clients={clients} onDelete={id=>{setInvoices(p=>p.filter(i=>i.id!==id)); db.invoices.remove(uid,id).catch(console.error);}} onPreview={setPreviewInvoice} onEdit={inv=>{setPreviewInvoice(null);setEditInvoice(inv);setCurrentView('new-invoice');}} onUpdateStatus={handleUpdateInvoiceStatus} onSelectClient={cid=>{const c=clients.find(cl=>cl.id===cid);if(c)setSelectedProfileClient(c);}}/>}
            {currentView==='clients'       && <ClientManager clients={clients} items={items} invoices={invoices} onAdd={c=>{setClients(p=>[...p,c]);db.clients.upsert(uid,c).catch(console.error);}} onUpdate={u=>{setClients(p=>p.map(c=>c.id===u.id?u:c));db.clients.upsert(uid,u).catch(console.error);}} onDelete={id=>{setClients(p=>p.filter(c=>c.id!==id));db.clients.remove(uid,id).catch(console.error);}} onUpdateItems={ni=>{setItems(ni);ni.forEach(i=>db.items.upsert(uid,i).catch(console.error));}} onPreviewInvoice={setPreviewInvoice} onOpenProfile={setSelectedProfileClient}/>}
            {currentView==='items'         && <ItemManager items={items} clients={clients} invoices={invoices} stockEntries={stockEntries} onAdd={i=>{setItems(p=>[...p,i]);db.items.upsert(uid,i).catch(console.error);}} onUpdate={u=>{setItems(p=>p.map(i=>i.id===u.id?u:i));db.items.upsert(uid,u).catch(console.error);}} onDelete={id=>{setItems(p=>p.filter(i=>i.id!==id));db.items.remove(uid,id).catch(console.error);}} onOpenProfile={setSelectedProfileItem}/>}
            {currentView==='admin'         && isAdmin && <AdminPanel />}
            {currentView==='settings'      && (
              <SettingsPanel config={config} onUpdate={setConfig}
                onExport={() => {
                  // Lexo direkt nga localStorage — garanton të dhëna 100% të plota
                  const db_export: Record<string, any> = {
                    _version: 2,
                    _exportedAt: new Date().toISOString(),
                    _user: username,
                    clients:      local.getAll(uid, 'clients'),
                    items:        local.getAll(uid, 'items'),
                    invoices:     local.getAll(uid, 'invoices'),
                    stockEntries: local.getAll(uid, 'stockEntries'),
                    config:       local.getConfig(uid) ?? config,
                  };
                  const blob = new Blob([JSON.stringify(db_export, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                  a.download = `backup_intal_pro_${new Date().toLocaleDateString('en-CA')}.json`; a.click();
                }}
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
                    // Ruaj në localStorage dhe Supabase (fire-and-forget)
                    if (cl.length)  { local.setAll(uid,'clients',cl);      db.clients.clear(uid).then(()=>db.clients.upsertMany(uid,cl)).catch(()=>{}); setClients(cl); }
                    if (it.length)  { local.setAll(uid,'items',it);        db.items.clear(uid).then(()=>db.items.upsertMany(uid,it)).catch(()=>{}); setItems(it); }
                    if (inv.length) { local.setAll(uid,'invoices',inv);    db.invoices.clear(uid).then(()=>db.invoices.upsertMany(uid,inv)).catch(()=>{}); setInvoices(inv); }
                    if (se.length)  { local.setAll(uid,'stockEntries',se); db.stockEntries.clear(uid).then(()=>db.stockEntries.upsertMany(uid,se)).catch(()=>{}); setStockEntries(se); }
                    if (cf)         { local.setConfig(uid,cf); db.config.save(uid,cf).catch(()=>{}); setConfig(cf); }
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
      {selectedProfileClient && <ClientProfile client={selectedProfileClient} invoices={invoices} items={items} onUpdateItems={ni=>{setItems(ni);ni.forEach(i=>db.items.upsert(uid,i).catch(console.error));}} onUpdateClient={u=>{setClients(p=>p.map(c=>c.id===u.id?u:c));db.clients.upsert(uid,u).catch(console.error);}} onClose={()=>setSelectedProfileClient(null)} onViewInvoice={inv=>{setSelectedProfileClient(null);setPreviewInvoice(inv);}} onNewInvoice={handleNewInvoiceForClient}/>}
      {selectedProfileItem && <ItemProfile item={selectedProfileItem} invoices={invoices} stockEntries={stockEntries} clients={clients} onUpdateItem={u=>{setItems(p=>p.map(i=>i.id===u.id?u:i));db.items.upsert(uid,u).catch(console.error);}} onClose={()=>setSelectedProfileItem(null)}/>}
    </div>
  );
};

export default App;
