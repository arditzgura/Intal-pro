
import React, { useState, useEffect, useMemo, useRef, useCallback, Component } from 'react';

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div style={{padding:32,fontFamily:'monospace',background:'#0f172a',color:'#f87171',minHeight:'100vh'}}>
        <h2 style={{color:'#fbbf24'}}>App Error</h2>
        <pre style={{whiteSpace:'pre-wrap'}}>{this.state.error}</pre>
        <button onClick={() => { localStorage.removeItem('intal_session'); window.location.reload(); }}
          style={{marginTop:16,padding:'8px 16px',background:'#D81B60',color:'white',border:'none',borderRadius:8,cursor:'pointer'}}>
          Dil dhe rihap
        </button>
      </div>
    );
    return this.props.children;
  }
}
import {
  LayoutDashboard, FileText, Users, Package, PlusCircle,
  Menu, Settings, X as CloseIcon, Warehouse, ArrowLeft, LogOut, Loader2, Shield, WifiOff, Wifi, Download
} from 'lucide-react';
import { Client, Item, Invoice, StockEntry, View, BusinessConfig, InvoiceItem } from './types';
import { clearData, STORAGE_KEYS, normalize } from './utils/storage';
import { local, touchNow, preloadUserData, electronLoadAll } from './utils/localDb';
import { fsApiSupported, loadSavedFileHandle, pickSaveFile, clearFileHandle, hasFileHandle, writeToFile } from './utils/fileSync';
import { cloudSave, cloudSaveConfig, cloudLoadAll, cloudSubscribe, cloudUnsubscribe, cloudLogout, cloudOnAuthChange, cloudClearAll, CLOUD_ENABLED } from './utils/cloudSync';
import type { CloudRow, CloudChannel } from './utils/cloudSync';
import { getLocalSession, clearLocalSession, setLocalSession, GUEST_USER } from './components/AuthScreen';

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
import QRSyncModal    from './components/QRSyncModal';

const DEFAULT_CONFIG: BusinessConfig = {
  name: '', nipt: '',
  address: '', phone: '', email: '',
  website: '', slogan: ''
};

const App: React.FC = () => {
  // ─── Auth (lokal) ──────────────────────────────────────────────────────────
  const [session,   setSession]  = useState<{ user: { id: string; username: string } } | null | undefined>(undefined);
  const [dataReady, setDataReady] = useState(false);
  const isGuest = session?.user.id === 'guest';

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
  const [previewInvoiceList,    setPreviewInvoiceList]    = useState<Invoice[]>([]);
  const [previewStockEntry,     setPreviewStockEntry]     = useState<StockEntry | null>(null);
  const [editInvoice,           setEditInvoice]           = useState<Invoice | null>(null);
  const [invoicesInitialFilter, setInvoicesInitialFilter] = useState<string | undefined>(undefined);
  const [showQRSync, setShowQRSync] = useState(false);
  const [editStockEntry,        setEditStockEntry]        = useState<StockEntry | null>(null);
  const [selectedProfileClient, setSelectedProfileClient] = useState<Client | null>(null);
  const [selectedProfileItem,   setSelectedProfileItem]   = useState<Item | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<'saving'|'saved'|'idle'>('idle');
  const saveIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fileSyncActive, setFileSyncActive] = useState(false);

  const mainRef         = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  // ─── Ngarko të dhënat nga IndexedDB → memCache → state ──────────────────────
  const loadAllData = useCallback(async (userId: string) => {
    // Electron: ngarko skedarin JSON para çdo gjëje tjetër
    await electronLoadAll();
    // Prit që IDB/localStorage të ngarkohet në memCache para leximeve sinkrone
    await preloadUserData(userId);
    // File System Access: rikthe lidhjen me skedarin e zgjedhur
    const ok = await loadSavedFileHandle();
    setFileSyncActive(ok);

    let invs  = local.getAll<Invoice>(userId, 'invoices');
    let cls   = local.getAll<Client>(userId, 'clients');
    let itms  = local.getAll<Item>(userId, 'items');
    let stock = local.getAll<StockEntry>(userId, 'stock_entries');
    let cfg   = local.getConfig(userId);

    setClients(cls);
    setItems(itms);
    setInvoices(invs);
    setStockEntries(stock);
    if (cfg) setConfig({ ...DEFAULT_CONFIG, ...cfg });
    setDataReady(true);
    if (invs.length > 0 || cls.length > 0 || itms.length > 0) touchNow();
  }, []);

  // ─── Auth: ngarko sesionin ────────────────────────────────────────────────
  useEffect(() => {
    const cached = getLocalSession();
    // Gjithmonë dëgjo Firebase Auth për të verifikuar UID-in aktual
    const unsub = cloudOnAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        // Jo i kyçur në Firebase
        if (cached) {
          // Sesion lokal por jo Firebase — pastro dhe shfaq login
          clearLocalSession();
        }
        setSession(null);
        setDataReady(true);
        return;
      }

      const firebaseUid = firebaseUser.uid;
      const username    = firebaseUser.username;

      if (cached && cached.id === firebaseUid) {
        // UID-i cache-uar përputhet me Firebase — ngarko normalisht
        setSession({ user: { id: firebaseUid, username: cached.username || username } });
        loadAllData(firebaseUid);
      } else {
        // UID ndryshe (llogari e re ose projekt i vjetër) — migro
        console.log('[auth] UID ndryshoi nga', cached?.id, 'në', firebaseUid, '— duke migruar...');
        const newSession = { id: firebaseUid, username: cached?.username || username };
        setLocalSession(newSession);

        // Ngarko nga Firestore
        let remote: Record<string, any> = {};
        try { remote = await cloudLoadAll(firebaseUid); } catch {}
        const r = (k: string) => remote[k]?.data;
        const remoteHasData = (r('invoices')?.length || 0) > 0 || (r('clients')?.length || 0) > 0;

        if (remoteHasData) {
          if (r('invoices')?.length)      { setInvoices(r('invoices')!);          local.setAll(firebaseUid,'invoices',      r('invoices')!); }
          if (r('clients')?.length)       { setClients(r('clients')!);            local.setAll(firebaseUid,'clients',       r('clients')!); }
          if (r('items')?.length)         { setItems(r('items')!);                local.setAll(firebaseUid,'items',         r('items')!); }
          if (r('stock_entries')?.length) { setStockEntries(r('stock_entries')!); local.setAll(firebaseUid,'stock_entries', r('stock_entries')!); }
          if (r('config')?.[0])           { setConfig(c => ({ ...c, ...r('config')![0] })); local.setConfig(firebaseUid, r('config')![0]); }
          console.log('[auth] ngarkova nga Firestore:', r('invoices')?.length, 'fatura');
        } else if (cached?.id) {
          // Firestore bosh — migro të dhënat lokale nga UID i vjetër
          const oldInvs  = local.getAll<any>(cached.id, 'invoices');
          const oldCls   = local.getAll<any>(cached.id, 'clients');
          const oldItms  = local.getAll<any>(cached.id, 'items');
          const oldStock = local.getAll<any>(cached.id, 'stock_entries');
          const oldCfg   = local.getConfig(cached.id);
          console.log('[auth] migrim lokal:', oldInvs.length, 'fatura nga', cached.id, '→', firebaseUid);
          if (oldInvs.length > 0 || oldCls.length > 0) {
            setInvoices(oldInvs);       local.setAll(firebaseUid,'invoices',      oldInvs);
            setClients(oldCls);         local.setAll(firebaseUid,'clients',       oldCls);
            setItems(oldItms);          local.setAll(firebaseUid,'items',         oldItms);
            setStockEntries(oldStock);  local.setAll(firebaseUid,'stock_entries', oldStock);
            if (oldCfg) { setConfig(c => ({ ...c, ...oldCfg })); local.setConfig(firebaseUid, oldCfg); }
            try {
              await cloudSave(firebaseUid,'invoices',      oldInvs);
              await cloudSave(firebaseUid,'clients',       oldCls);
              await cloudSave(firebaseUid,'items',         oldItms);
              await cloudSave(firebaseUid,'stock_entries', oldStock);
              if (oldCfg) await cloudSaveConfig(firebaseUid, oldCfg);
              console.log('[auth] migrim në Firestore i suksesshëm!');
            } catch(e) { console.warn('[auth] migrim Firestore dështoi:', e); }
          }
        }

        setSession({ user: { id: firebaseUid, username: newSession.username } });
        setDataReady(true);
      }
    });
    return unsub;
  }, [loadAllData]); // eslint-disable-line

  // ─── Migrim: cakto kode klientëve ekzistues pa kod ───────────────────────
  useEffect(() => {
    if (!session || !dataReady || !clients.length) return;
    const needsCode = clients.some(c => !c.code);
    if (!needsCode) return;
    let counter = clients
      .map(c => parseInt((c.code || '').replace('KL', '')) || 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const updated = clients.map(c => {
      if (c.code) return c;
      counter++;
      return { ...c, code: 'KL' + String(counter).padStart(3, '0') };
    });
    setClients(updated);
    local.setAllSilent(session.user.id, 'clients', updated);
    // Gjithashtu lidh faturat ekzistuese me kodet e klientëve
    const codeMap = new Map(updated.map(c => [c.id, c.code!]));
    const updatedInvoices = invoices.map(inv => {
      if (inv.clientCode) return inv; // tashmë ka kod
      if (inv.clientId && inv.clientId !== 'manual' && codeMap.has(inv.clientId)) {
        return { ...inv, clientCode: codeMap.get(inv.clientId) };
      }
      return inv;
    });
    const hasChange = updatedInvoices.some((inv, i) => inv !== invoices[i]);
    if (hasChange) {
      setInvoices(updatedInvoices);
      local.setAllSilent(session.user.id, 'invoices', updatedInvoices);
    }
  }, [dataReady]); // eslint-disable-line

  // ─── Rillogarit statuset e të gjitha faturave pas ngarkimit ─────────────────
  useEffect(() => {
    if (!session || !dataReady || !invoices.length) return;

    const getDebt = (inv: Invoice) => (Number(inv.subtotal) + Number(inv.previousBalance || 0)) - Number(inv.amountPaid || 0);
    const normKey = (inv: Invoice) =>
      normalize(inv.clientName.trim()) + '|' + normalize((inv.clientCity || '').trim());

    // Grumbullo faturat sipas emrit+qyteti (pavarësisht clientId)
    const groups: Record<string, Invoice[]> = {};
    invoices.filter(inv => inv.status !== 'Anuluar').forEach(inv => {
      const k = normKey(inv);
      if (!groups[k]) groups[k] = [];
      groups[k].push(inv);
    });

    const statusMap = new Map<string, Invoice['status']>();

    Object.values(groups).forEach(group => {
      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const latestDebt = getDebt(latest);

      if (latestDebt <= 0) {
        // Klienti pa borxh — të gjitha faturat E paguar
        sorted.forEach(inv => statusMap.set(inv.id, 'E paguar'));
      } else {
        // Ka borxh — apliko zinxhirin
        const n = sorted.length;
        const isPaid = new Array(n).fill(false);
        for (let i = n - 1; i >= 0; i--) {
          if (getDebt(sorted[i]) <= 0) {
            isPaid[i] = true;
          } else if (i < n - 1 && isPaid[i + 1]) {
            if ((sorted[i + 1].previousBalance || 0) >= getDebt(sorted[i])) isPaid[i] = true;
          }
        }
        for (let i = 0; i < n; i++) {
          if (isPaid[i]) statusMap.set(sorted[i].id, 'E paguar');
          else if (i === n - 1) statusMap.set(sorted[i].id, 'Pa paguar');
          else statusMap.set(sorted[i].id, getDebt(sorted[i]) > 0 ? 'Pasuar' : 'E paguar');
        }
      }
    });

    const updated = invoices.map(inv =>
      statusMap.has(inv.id) ? { ...inv, status: statusMap.get(inv.id)! } : inv
    );
    const hasChange = updated.some((inv, i) => inv.status !== invoices[i].status);
    if (hasChange) {
      setInvoices(updated);
      local.setAllSilent(session.user.id, 'invoices', updated);
    }
  }, [dataReady]); // eslint-disable-line

  // ─── Pikët e klientëve ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || !clients.length) return;
    const userId = session.user.id;
    const updated = clients.map(client => {
      const clientNameN = normalize(client.name.trim());
      const clientCityN = normalize(client.city?.trim() || '');
      const hasDupName  = clients.some(c => c.id !== client.id && normalize(c.name.trim()) === clientNameN);
      const pts = invoices
        .filter(inv => {
          if (inv.status === 'Anuluar') return false;
          // Kur ka emra duplikatë, dallo me qytet
          if (hasDupName) {
            if (normalize(inv.clientName.trim()) !== clientNameN) return false;
            if (inv.clientCity && clientCityN) return normalize(inv.clientCity.trim()) === clientCityN;
            return inv.clientId === client.id;
          }
          return inv.clientId === client.id;
        })
        .reduce((s, inv) => s + (inv.currency === 'EUR'
          ? Math.floor(inv.subtotal || 0)
          : Math.floor((inv.subtotal || 0) / 100)), 0);
      return client.points !== pts ? { ...client, points: pts } : client;
    });
    const changedC = updated.filter((u, i) => u !== clients[i]);
    if (changedC.length > 0) {
      setClients(updated);
      local.setAllSilent(userId, 'clients', updated);
    }
  }, [invoices]); // eslint-disable-line

  // ─── Auto-save: pasqyron çdo ndryshim state → localStorage + auto-backup ────
  const applyingRemote = useRef(false);
  const autoBackupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || !dataReady) return;
    const uid = session.user.id;
    local.setAllSilent(uid, 'invoices',      invoices);
    local.setAllSilent(uid, 'clients',       clients);
    local.setAllSilent(uid, 'items',         items);
    local.setAllSilent(uid, 'stock_entries', stockEntries);
    // Trego "Duke ruajtur..." menjëherë
    setSaveIndicator('saving');
    if (saveIndicatorTimer.current) clearTimeout(saveIndicatorTimer.current);

    // Auto-backup i plotë pas çdo veprimi (debounce 2s)
    if (autoBackupTimer.current) clearTimeout(autoBackupTimer.current);
    autoBackupTimer.current = setTimeout(() => {
      try {
        const snap = JSON.stringify({
          exportedAt: new Date().toISOString(),
          version: 2,
          user: session.user.username,
          invoices, clients, items,
          stock_entries: stockEntries,
          config,
        });
        local.saveAutoBackup(snap);
        // Shkruaj automatikisht në skedarin e zgjedhur (nëse është konfiguruar)
        if (hasFileHandle()) writeToFile(snap);
      } catch { /* localStorage plot — injorojmë */ }
      setSaveIndicator('saved');
      saveIndicatorTimer.current = setTimeout(() => setSaveIndicator('idle'), 2500);
    }, 2000);
  }, [invoices, clients, items, stockEntries]); // eslint-disable-line

  // ─── Config auto-save ──────────────────────────────────────────────────────
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || !dataReady) return;
    if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(() => {
      local.setConfig(session.user.id, config);
    }, 800);
  }, [config]); // eslint-disable-line

  // ─── Online / Offline detektor + sync kur kthehet interneti ─────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!session || !CLOUD_ENABLED || isGuest) return;
      const uid = session.user.id;
      Promise.all([
        cloudSave(uid, 'invoices',      invoices),
        cloudSave(uid, 'clients',       clients),
        cloudSave(uid, 'items',         items),
        cloudSave(uid, 'stock_entries', stockEntries),
        cloudSaveConfig(uid,            config),
      ]).then(() => {
        pendingSync.current = false;
      }).catch(() => {
        pendingSync.current = true;
      });
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session]); // eslint-disable-line

  // ─── Auto-sync: çdo ndryshim state → cloud pas 2s ───────────────────────────
  const syncTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudChannelRef = useRef<CloudChannel>(null);
  const pendingSync     = useRef<boolean>(false);
  const [isOnline,      setIsOnline]  = useState<boolean>(navigator.onLine);
  const [syncStatus,    setSyncStatus] = useState<'ok'|'pending'|'err'>('ok');

  useEffect(() => {
    if (!session || !dataReady || isGuest || !CLOUD_ENABLED) return;
    const uid = session.user.id;

    // Backup lokal i plotë
    try { localStorage.setItem('intal_auto_backup', JSON.stringify({
      savedAt: new Date().toISOString(), version: 1, user: session.user.username,
      invoices, clients, items, stock_entries: stockEntries, config,
    })); } catch {}

    setSyncStatus('pending');
    pendingSync.current = true;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      if (!navigator.onLine) { setSyncStatus('err'); return; }
      try {
        await cloudSave(uid, 'invoices',      invoices);
        await cloudSave(uid, 'clients',       clients);
        await cloudSave(uid, 'items',         items);
        await cloudSave(uid, 'stock_entries', stockEntries);
        await cloudSaveConfig(uid,            config);
        pendingSync.current = false;
        setSyncStatus('ok');
      } catch(e) {
        console.error('[sync] dështoi:', e);
        setSyncStatus('err');
        pendingSync.current = false;
      }
    }, 2000);
  }, [clients, items, invoices, stockEntries, config]); // eslint-disable-line

  // ─── Cloud subscribe: merr ndryshimet nga pajisje të tjera në kohë reale ────
  useEffect(() => {
    if (!session || !dataReady || !CLOUD_ENABLED || isGuest) return;
    const uid = session.user.id;

    // Apliko nga Firestore VETËM nëse nuk ka ndryshime lokale pending
    const applyFromFirestore = (tableName: string, data: any[]) => {
      if (pendingSync.current) return; // Ka veprime lokale pa sync — mos mbishkruaj
      applyingRemote.current = true;
      if (tableName === 'invoices')      { setInvoices(data);     local.setAllSilent(uid,'invoices',      data); }
      if (tableName === 'clients')       { setClients(data);      local.setAllSilent(uid,'clients',       data); }
      if (tableName === 'items')         { setItems(data);        local.setAllSilent(uid,'items',         data); }
      if (tableName === 'stock_entries') { setStockEntries(data); local.setAllSilent(uid,'stock_entries', data); }
      if (tableName === 'config' && data[0]) { setConfig(c => ({...c,...data[0]})); local.setConfigSilent(uid, data[0]); }
      setTimeout(() => { applyingRemote.current = false; }, 0);
    };

    // Startup: nëse localStorage bosh (pajisje e re) → ngarko nga Firestore
    const localInvoices = local.getAll<any>(uid, 'invoices');
    const localClients  = local.getAll<any>(uid, 'clients');
    const localHasData  = localInvoices.length > 0 || localClients.length > 0;

    // Startup: krahaso timestamp lokal vs cloud — fiton i reja
    cloudLoadAll(uid).then(remote => {
      const r = (key: string) => remote[key]?.data;
      const remoteHasData = (r('invoices')?.length || 0) > 0 || (r('clients')?.length || 0) > 0;
      const localModified  = local.getLastModified(uid); // ISO string
      const remoteModified = remote['invoices']?.updatedAt || remote['clients']?.updatedAt || '1970-01-01T00:00:00.000Z';
      const cloudIsNewer   = remoteHasData && remoteModified > localModified;

      if (!localHasData || cloudIsNewer) {
        // Pajisje e re ose cloud ka të dhëna më të reja → pull nga Firestore
        console.log('[sync] cloud është më i ri ose lokal bosh — duke tërhequr nga cloud');
        applyingRemote.current = true;
        if (r('invoices')?.length)      { setInvoices(r('invoices')!);          local.setAllSilent(uid,'invoices',      r('invoices')!); }
        if (r('clients')?.length)       { setClients(r('clients')!);            local.setAllSilent(uid,'clients',       r('clients')!); }
        if (r('items')?.length)         { setItems(r('items')!);                local.setAllSilent(uid,'items',         r('items')!); }
        if (r('stock_entries')?.length) { setStockEntries(r('stock_entries')!); local.setAllSilent(uid,'stock_entries', r('stock_entries')!); }
        if (r('config')?.[0])           { setConfig(c => ({...c,...r('config')![0]})); local.setConfigSilent(uid, r('config')![0]); }
        setTimeout(() => { applyingRemote.current = false; }, 0);
      } else {
        // Lokali është më i ri (ose cloud bosh) → push në Firestore
        console.log('[sync] lokali është më i ri — duke ngarkuar në cloud');
        const localItems  = local.getAll<any>(uid, 'items');
        const localStock  = local.getAll<any>(uid, 'stock_entries');
        const localConfig = local.getConfig(uid);
        cloudSave(uid, 'invoices',      localInvoices).catch(() => {});
        cloudSave(uid, 'clients',       localClients).catch(() => {});
        if (localItems.length)  cloudSave(uid, 'items',         localItems).catch(() => {});
        if (localStock.length)  cloudSave(uid, 'stock_entries', localStock).catch(() => {});
        if (localConfig)        cloudSaveConfig(uid, localConfig).catch(() => {});
      }
    }).catch(() => {
      // Firebase jo i disponueshëm — vazhdo me të dhënat lokale
      console.warn('[sync] cloudLoadAll dështoi — po përdor të dhënat lokale');
    });

    // Real-time: ndryshimet nga pajisja TJETËR (desktop-i filtron shkrimet e veta me DEVICE_ID)
    cloudChannelRef.current = cloudSubscribe(uid, applyFromFirestore);

    return () => { cloudUnsubscribe(cloudChannelRef.current); };
  }, [dataReady, session?.user?.id]); // eslint-disable-line

  // ─── Safety-net: nëse sesioni aktiv por nuk ka të dhëna, tërhiq nga Firestore ──
  useEffect(() => {
    if (!session || isGuest || !CLOUD_ENABLED || !dataReady) return;
    if (invoices.length > 0 || clients.length > 0 || items.length > 0) return;
    const uid = session.user.id;
    console.log('[safety-net] state bosh me sesion aktiv — tërhiq nga Firestore');
    cloudLoadAll(uid).then(remote => {
      const r = (key: string) => remote[key]?.data;
      console.log('[safety-net] result:', Object.keys(remote), 'invoices:', r('invoices')?.length ?? 0);
      if (r('invoices')?.length)      { setInvoices(r('invoices')!);          local.setAll(uid,'invoices',      r('invoices')!); }
      if (r('clients')?.length)       { setClients(r('clients')!);            local.setAll(uid,'clients',       r('clients')!); }
      if (r('items')?.length)         { setItems(r('items')!);                local.setAll(uid,'items',         r('items')!); }
      if (r('stock_entries')?.length) { setStockEntries(r('stock_entries')!); local.setAll(uid,'stock_entries', r('stock_entries')!); }
      if (r('config')?.[0])           { setConfig(c => ({ ...c, ...r('config')![0] })); local.setConfig(uid, r('config')![0]); }
    }).catch(e => console.error('[safety-net] error:', e));
  }, [session?.user?.id, dataReady, invoices.length, clients.length]); // eslint-disable-line

  // ─── Backup lokal ─────────────────────────────────────────────────────────
  // _doBackupFn rikrijohet çdo render — ka gjithmonë gjendjen e fundit në closure
  const _doBackupFn = useRef<(isAuto?: boolean) => void>(null!);
  _doBackupFn.current = (isAuto = false) => {
    if (!session) return;
    const data = {
      exportedAt:    new Date().toISOString(),
      version:       2,
      user:          session.user.username,
      invoices,
      clients,
      items,
      stock_entries: stockEntries,
      config,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toLocaleDateString('en-CA');
    a.href     = url;
    a.download = `intal-backup-${date}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    localStorage.setItem('intal_last_backup', Date.now().toString());
    if (!isAuto) alert(
      `✅ Backup u ruajt: intal-backup-${date}.json\n\n` +
      `📄 Faturat:     ${invoices.length}\n` +
      `👥 Klientët:   ${clients.length}\n` +
      `📦 Artikujt:   ${items.length}\n` +
      `🏭 Fletëhyrjet: ${stockEntries.length}`
    );
  };
  // doBackup ka referencë stabile (nuk shkakton re-render të SettingsPanel)
  const doBackup = useCallback((isAuto = false) => _doBackupFn.current(isAuto), []);

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
    const target = currentView === 'new-invoice' ? 0 : (scrollPositions.current[currentView] || 0);
    setTimeout(() => { if (mainRef.current) mainRef.current.scrollTop = target; }, 0);
  }, [currentView]);

  // ─── Helpers navigimi ──────────────────────────────────────────────────────
  const handleNavigate = (view: View) => {
    if (view !== currentView) { setViewHistory(p => [...p, view]); setCurrentView(view); }
    setEditInvoice(null); setEditStockEntry(null);
    setSelectedProfileClient(null); setSelectedProfileItem(null);
    setInvoicesInitialFilter(undefined);
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
    clearLocalSession();
    if (!isGuest) await cloudLogout().catch(() => {});
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

  // Çelës unik klienti: kod klienti (nëse ka) → id reale → manual|emër|qytet
  const getInvClientKey = (inv: Invoice): string => {
    if (inv.clientCode) return `code|${inv.clientCode}`;
    if (inv.clientId && inv.clientId !== 'manual') return inv.clientId;
    return `manual|${normalize(inv.clientName.trim())}|${normalize((inv.clientCity || '').trim())}`;
  };

  // Rillogarit statuset e të gjitha faturave për një klient
  const recalcClientStatuses = (clientKey: string, allInvoices: Invoice[]): Invoice[] => {
    const getDebt = (inv: Invoice) => (Number(inv.subtotal) + Number(inv.previousBalance || 0)) - Number(inv.amountPaid || 0);
    const clientInvs = allInvoices
      .filter(inv => getInvClientKey(inv) === clientKey && inv.status !== 'Anuluar')
      .sort((a, b) => a.date.localeCompare(b.date));
    if (clientInvs.length === 0) return allInvoices;

    const n = clientInvs.length;
    const latest = clientInvs[n - 1];
    const map = new Map<string, Invoice['status']>();

    // Rregulli kryesor: nëse fatura e fundit është paguar (borxh=0) → TË GJITHA bëhen E paguar
    if (getDebt(latest) <= 0) {
      clientInvs.forEach(inv => map.set(inv.id, 'E paguar'));
      return allInvoices.map(inv => map.has(inv.id) ? { ...inv, status: map.get(inv.id)! } : inv);
    }

    // Përndryshe: zinxhir — shiko nëse borxhi i faturës u mbulua nga fatura pasardhëse
    const isPaid = new Array(n).fill(false);
    for (let i = n - 1; i >= 0; i--) {
      const inv = clientInvs[i];
      if (getDebt(inv) <= 0) {
        isPaid[i] = true;
      } else if (i < n - 1 && isPaid[i + 1]) {
        const next = clientInvs[i + 1];
        if ((next.previousBalance || 0) >= getDebt(inv)) isPaid[i] = true;
      }
    }

    for (let i = 0; i < n; i++) {
      const inv = clientInvs[i];
      if (isPaid[i]) {
        map.set(inv.id, 'E paguar');
      } else if (i === n - 1) {
        map.set(inv.id, 'Pa paguar');
      } else {
        map.set(inv.id, getDebt(inv) > 0 ? 'Pasuar' : 'E paguar');
      }
    }

    return allInvoices.map(inv => map.has(inv.id) ? { ...inv, status: map.get(inv.id)! } : inv);
  };

  // ─── Bashko dy klientë në një ─────────────────────────────────────────────
  // keepId = klienti që mbetet, removeId = klienti që fshihet
  const handleMergeClients = (keepId: string, removeId: string) => {
    const keep   = clients.find(c => c.id === keepId);
    const remove = clients.find(c => c.id === removeId);
    if (!keep || !remove) return;

    // 1. Rindërtoj listën e klientëve — fshi klientin e dytë
    const newClients = clients.filter(c => c.id !== removeId);

    // 2. Riasigno të gjitha faturat e klientit të fshirë tek klienti kryesor
    const newInvoices = invoices.map(inv => {
      if (inv.clientId !== removeId) return inv;
      return {
        ...inv,
        clientId:   keepId,
        clientName: keep.name,
        clientCity: keep.city || inv.clientCity,
        clientCode: keep.code || inv.clientCode,
      };
    });

    // 3. Riasigno stock entries
    const newStock = stockEntries.map(se => {
      if (se.clientId !== removeId) return se;
      return { ...se, clientId: keepId, clientName: keep.name };
    });

    // 4. Bashko çmimet preferenciale të artikujve
    const newItems = items.map(item => {
      const keepPref   = item.preferentialPrices?.find(p => p.clientId === keepId);
      const removePref = item.preferentialPrices?.find(p => p.clientId === removeId);
      if (!removePref) return item;
      if (keepPref) {
        // Hiq çmimin e klientit të fshirë
        return { ...item, preferentialPrices: item.preferentialPrices!.filter(p => p.clientId !== removeId) };
      }
      // Transfero çmimin tek klienti kryesor
      return {
        ...item,
        preferentialPrices: item.preferentialPrices!.map(p =>
          p.clientId === removeId ? { ...p, clientId: keepId } : p
        ),
      };
    });

    // 5. Ruaj gjithçka
    setClients(newClients);
    setInvoices(newInvoices);
    setStockEntries(newStock);
    setItems(newItems);
    local.setAll(uid, 'clients',       newClients);
    local.setAll(uid, 'invoices',      newInvoices);
    local.setAll(uid, 'stock_entries', newStock);
    local.setAll(uid, 'items',         newItems);
  };

  const handleUpdateInvoiceStatus = (id: string, status: Invoice['status']) => {
    const target = invoices.find(inv => inv.id === id);
    if (!target) return;
    const today = new Date().toLocaleDateString('en-CA');
    // Vendos pagesën e plotë nëse shënohet si E paguar
    const base = invoices.map(inv => {
      if (inv.id !== id) return inv;
      if (status === 'E paguar')
        return { ...inv, status: 'E paguar' as const, amountPaid: inv.subtotal + (inv.previousBalance || 0), paymentDate: inv.paymentDate || today };
      if (status === 'Pa paguar')
        return { ...inv, status: 'Pa paguar' as const, paymentDate: undefined };
      return { ...inv, status };
    });
    const recalced = recalcClientStatuses(getInvClientKey(target), base);
    
    setInvoices(recalced);
    local.setAll(uid, 'invoices', recalced);
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
      // Gjenero kod unik KL001, KL002...
      const maxCode = updClients
        .map(c => parseInt((c.code || '').replace('KL', '')) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
      const newCode = 'KL' + String(maxCode + 1).padStart(3, '0');
      const nc: Client = { id: Date.now().toString(), code: newCode, name: invoice.clientName.trim(), city: invoice.clientCity || '', address: '', phone: invoice.clientPhone || '', email: '', points: 0 };
      updClients.push(nc); final.clientId = nc.id; final.clientCode = newCode; cChanged = true;
    } else {
      final.clientId = existing.id;
      // Nëse klienti ka kod, lidhe me faturën
      if (existing.code) final.clientCode = existing.code;
    }

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

    const base = editInvoice
      ? invoices.map(inv => inv.id === final.id ? final : inv)
      : [final, ...invoices];
    const newInvoices = recalcClientStatuses(getInvClientKey(final), base);
    
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
  if (!session) return <AuthScreen onAuth={async (user) => {
    const uid = user.id;
    // Ngarko të dhënat nga IndexedDB (burimi i vetëm i të dhënave — cloud është çaktivizuar)
    await loadAllData(uid);
    setSession({ user: { id: uid, username: user.username } });
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
          {!isOnline
            ? <div className="flex items-center justify-center gap-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-1.5 mt-1"><WifiOff size={11} className="text-amber-400"/><span className="text-[9px] text-amber-400 font-black uppercase tracking-widest">Offline — Lokal</span></div>
            : <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${syncStatus==='ok'?'bg-emerald-500':syncStatus==='pending'?'bg-amber-400 animate-pulse':'bg-red-500'}`}/>
                <p className={`text-[9px] font-black uppercase tracking-widest ${syncStatus==='ok'?'text-emerald-600':syncStatus==='pending'?'text-amber-500':'text-red-500'}`}>
                  {syncStatus==='ok'?'Cloud — i sinkronizuar':syncStatus==='pending'?'Duke sinkronizuar...':'Sync dështoi'}
                </p>
              </div>
          }
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
            {!isOnline && (
              <div className="flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-700 rounded-lg px-2.5 py-1.5">
                <WifiOff size={13}/>
                <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Offline</span>
              </div>
            )}
            <div className="hidden lg:flex items-center gap-3">
              {/* Treguesi i ruajtjes automatike */}
              {saveIndicator !== 'idle' && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${saveIndicator === 'saved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                  {saveIndicator === 'saving' ? (
                    <><Loader2 size={11} className="animate-spin"/> Duke ruajtur...</>
                  ) : (
                    <><span>✓</span> U ruajt</>
                  )}
                </div>
              )}
              {fsApiSupported && (
                fileSyncActive ? (
                  <button
                    onClick={async () => { await clearFileHandle(); setFileSyncActive(false); }}
                    title="Backup automatik aktiv — klik për ta çaktivizuar"
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"/>  Auto-Ruajtje ON
                  </button>
                ) : (
                  <button
                    onClick={async () => { const ok = await pickSaveFile(); setFileSyncActive(ok); }}
                    title="Aktivizo ruajtjen automatike në skedar"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-transparent hover:border-emerald-300 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/> Auto-Ruajtje
                  </button>
                )
              )}
              <button onClick={() => doBackup(false)} title="Eksporto Backup JSON"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest border border-transparent hover:border-blue-200">
                <Download size={14}/> Backup
              </button>
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

            {currentView==='dashboard'     && <Dashboard invoices={invoices} clients={clients} items={items} stockEntries={stockEntries} onNavigateUnpaid={() => { setInvoicesInitialFilter('Pa paguar'); setCurrentView('invoices'); }}/>}
            {currentView==='new-invoice'   && <InvoiceGenerator key={nextInvoiceNumber} clients={clients} items={items} invoices={invoices} initialData={editInvoice} defaultInvoiceNumber={nextInvoiceNumber} onSubmit={addOrUpdateInvoice} onCancel={handleGoBack} onAddItem={i=>{const upd=[...items,i];setItems(upd);local.setAll(uid, 'items', upd);}} business={config} onUpdateBusiness={upd=>{const nc={...config,...upd};setConfig(nc);local.setConfig(uid,nc);}}/>}
            {currentView==='stock-entries' && <StockEntryManager entries={stockEntries} items={items} onAddNew={() => {setEditStockEntry(null);setCurrentView('new-stock-entry');}} onEdit={e=>{setEditStockEntry(e);setCurrentView('new-stock-entry');}} onDelete={id=>{const upd=stockEntries.filter(e=>e.id!==id);setStockEntries(upd);local.setAll(uid, 'stock_entries', upd);}} onPreview={setPreviewStockEntry} onOpenProfile={setSelectedProfileItem}/>}
            {currentView==='new-stock-entry' && <StockEntryGenerator items={items} invoices={invoices} stockEntries={stockEntries} nextNumber={nextStockNumber} initialData={editStockEntry} onSave={handleAddStockEntry} onCancel={handleGoBack}/>}
            {currentView==='invoices'      && <InvoiceHistory key={invoicesInitialFilter || 'default'} initialStatusFilter={invoicesInitialFilter} invoices={invoices} clients={clients} items={items} onDelete={id=>{const del=invoices.find(i=>i.id===id);const base=invoices.filter(i=>i.id!==id);const upd=del?recalcClientStatuses(getInvClientKey(del),base):base;setInvoices(upd);local.setAll(uid, 'invoices', upd);}} onPreview={setPreviewInvoice} onEdit={inv=>{setPreviewInvoice(null);setEditInvoice(inv);setCurrentView('new-invoice');}} onUpdateStatus={handleUpdateInvoiceStatus} onSelectClient={inv=>{
  // 1. Gjej sipas ID direkt
  let c = clients.find(cl => cl.id === inv.clientId);
  // 2. Nëse ka dy klientë me të njëjtin emër, dalloji sipas qytetit
  if (c) {
    const hasDup = clients.some(cl => cl.id !== c!.id && normalize(cl.name.trim()) === normalize(c!.name.trim()));
    if (hasDup && inv.clientCity) {
      const byCity = clients.find(cl => normalize(cl.name.trim()) === normalize(c!.name.trim()) && normalize(cl.city?.trim()||'') === normalize(inv.clientCity!.trim()));
      if (byCity) c = byCity;
    }
  }
  // 3. Fallback: gjej sipas kodit ose emrit+qyteti
  if (!c && inv.clientCode) c = clients.find(cl => cl.code === inv.clientCode);
  if (!c && inv.clientName) c = clients.find(cl => normalize(cl.name.trim()) === normalize(inv.clientName.trim()) && (!inv.clientCity || normalize(cl.city?.trim()||'') === normalize(inv.clientCity.trim())));
  if (c) setSelectedProfileClient(c);
}}/>}
            {currentView==='clients'       && <ClientManager clients={clients} items={items} invoices={invoices} onAdd={c=>{const upd=[...clients,c];setClients(upd);local.setAll(uid, 'clients', upd);}} onUpdate={u=>{const upd=clients.map(c=>c.id===u.id?u:c);setClients(upd);local.setAll(uid, 'clients', upd);}} onDelete={id=>{const upd=clients.filter(c=>c.id!==id);setClients(upd);local.setAll(uid, 'clients', upd);}} onUpdateItems={ni=>{setItems(ni);local.setAll(uid, 'items', ni);}} onPreviewInvoice={setPreviewInvoice} onOpenProfile={setSelectedProfileClient} onMerge={handleMergeClients}/>}
            {currentView==='items'         && <ItemManager items={items} clients={clients} invoices={invoices} stockEntries={stockEntries} onAdd={i=>{const upd=[...items,i];setItems(upd);local.setAll(uid, 'items', upd);}} onUpdate={u=>{const upd=items.map(i=>i.id===u.id?u:i);setItems(upd);local.setAll(uid, 'items', upd);}} onDelete={id=>{const upd=items.filter(i=>i.id!==id);setItems(upd);local.setAll(uid, 'items', upd);}} onOpenProfile={setSelectedProfileItem}/>}
            {currentView==='admin'         && isAdmin && <AdminPanel />}
            {currentView==='settings'      && (
              <SettingsPanel config={config} onUpdate={setConfig}
                onQRSync={() => setShowQRSync(true)}
                onExport={() => doBackup(false)}
                onRestoreAutoBackup={() => {
                  try {
                    const raw = local.getAutoBackup();
                    if (!raw) return false;
                    const bk = JSON.parse(raw);
                    const cl  = Array.isArray(bk.clients)       ? bk.clients       : [];
                    const it  = Array.isArray(bk.items)          ? bk.items         : [];
                    const inv = Array.isArray(bk.invoices)       ? bk.invoices      : [];
                    const se  = Array.isArray(bk.stock_entries)  ? bk.stock_entries : [];
                    const cf  = bk.config && typeof bk.config === 'object' ? { ...DEFAULT_CONFIG, ...bk.config } : null;
                    // Bllokon cloud override për 30 sekonda
                    
                    if (cl.length)  { setClients(cl);       local.setAll(uid, 'clients', cl); }
                    if (it.length)  { setItems(it);         local.setAll(uid, 'items', it); }
                    if (inv.length) { setInvoices(inv);     local.setAll(uid, 'invoices', inv); }
                    if (se.length)  { setStockEntries(se);  local.setAll(uid, 'stock_entries', se); }
                    if (cf)         { setConfig(cf);        local.setConfig(uid, cf); }
                    // Push në cloud pa await (onRestoreAutoBackup nuk është async)
                    if (CLOUD_ENABLED) {
                      Promise.all([
                        cl.length  ? cloudSave(uid,'clients',cl)         : Promise.resolve(),
                        it.length  ? cloudSave(uid,'items',it)           : Promise.resolve(),
                        inv.length ? cloudSave(uid,'invoices',inv)       : Promise.resolve(),
                        se.length  ? cloudSave(uid,'stock_entries',se)   : Promise.resolve(),
                        cf         ? cloudSaveConfig(uid,cf)             : Promise.resolve(),
                      ]);
                    }
                    handleNavigate('dashboard');
                    return true;
                  } catch { return false; }
                }}
                onCloudPush={async () => {
                  if (!CLOUD_ENABLED) throw new Error('Cloud jo aktiv');
                  const fuid = session.user.id;
                  await cloudSave(fuid, 'invoices',      invoices);
                  await cloudSave(fuid, 'clients',       clients);
                  await cloudSave(fuid, 'items',         items);
                  await cloudSave(fuid, 'stock_entries', stockEntries);
                  await cloudSaveConfig(fuid,            config);
                }}
                onCloudReset={async () => {
                  if (!CLOUD_ENABLED) throw new Error('Cloud jo aktiv');
                  const fuid = session.user.id;
                  // 1. Fshi TË GJITHA të dhënat e vjetra nga Firestore
                  await cloudClearAll(fuid);
                  // 2. Ringjesh me të dhënat lokale të fundit (lokali gjithmonë fiton)
                  await cloudSave(fuid, 'invoices',      invoices);
                  await cloudSave(fuid, 'clients',       clients);
                  await cloudSave(fuid, 'items',         items);
                  await cloudSave(fuid, 'stock_entries', stockEntries);
                  await cloudSaveConfig(fuid,            config);
                }}
                onImport={async (file) => {
                  try {
                    const text = await file.text();
                    const bk = JSON.parse(text);
                    if (!bk || typeof bk !== 'object') return false;
                    const cl  = Array.isArray(bk.clients)       ? bk.clients       : [];
                    const it  = Array.isArray(bk.items)          ? bk.items         : [];
                    const inv = Array.isArray(bk.invoices)       ? bk.invoices      : [];
                    const se  = Array.isArray(bk.stock_entries)  ? bk.stock_entries
                              : Array.isArray(bk.stockEntries)   ? bk.stockEntries  : [];
                    const cf  = bk.config && typeof bk.config === 'object' ? { ...DEFAULT_CONFIG, ...bk.config } : null;
                    if (!cl.length && !it.length && !inv.length) return false;

                    // 1. Ruaj LOCAL menjëherë (gjithmonë sukses)
                    setClients(cl);       local.setAll(uid, 'clients', cl);
                    setItems(it);         local.setAll(uid, 'items', it);
                    setInvoices(inv);     local.setAll(uid, 'invoices', inv);
                    setStockEntries(se);  local.setAll(uid, 'stock_entries', se);
                    if (cf) { setConfig(cf); local.setConfig(uid, cf); }

                    // 2. Push cloud — best-effort, nuk bllokon importin
                    if (CLOUD_ENABLED) {
                      Promise.all([
                        cloudSave(uid,'clients',       cl),
                        cloudSave(uid,'items',         it),
                        cloudSave(uid,'invoices',      inv),
                        cloudSave(uid,'stock_entries', se),
                        cf ? cloudSaveConfig(uid,cf) : Promise.resolve(),
                      ]).catch(e => console.warn('[import] cloud push failed (jo kritik):', e));
                    }

                    alert(`✅ Import u krye:\n📄 Faturat: ${inv.length} | 👥 Klientët: ${cl.length} | 📦 Artikujt: ${it.length} | 🏭 Fletëhyrjet: ${se.length}`);
                    handleNavigate('dashboard');
                    return true;
                  } catch(e) {
                    console.error('[import] error:', e);
                    return false;
                  }
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

      {/* QR Sync Modal */}
      {showQRSync && session && (
        <QRSyncModal
          backupData={{
            invoices, clients, items, stock_entries: stockEntries,
            config: local.getConfig(session.user.id)
          }}
          onClose={() => setShowQRSync(false)}
          onRestoreData={(data) => {
            const uid = session.user.id;
            if (Array.isArray(data.clients)       && data.clients.length)       { setClients(data.clients);           local.setAll(uid,'clients',data.clients); }
            if (Array.isArray(data.items)          && data.items.length)         { setItems(data.items);               local.setAll(uid,'items',data.items); }
            if (Array.isArray(data.invoices)       && data.invoices.length)      { setInvoices(data.invoices);         local.setAll(uid,'invoices',data.invoices); }
            if (Array.isArray(data.stock_entries)  && data.stock_entries.length) { setStockEntries(data.stock_entries);local.setAll(uid,'stock_entries',data.stock_entries); }
            if (data.config && typeof data.config === 'object')                  { setConfig({...DEFAULT_CONFIG,...data.config}); local.setConfig(uid,{...DEFAULT_CONFIG,...data.config}); }
          }}
        />
      )}

      {/* Overlays */}
      {previewInvoice  && (() => {
        const navList = previewInvoiceList.length > 0 ? previewInvoiceList : [];
        const navIdx  = navList.findIndex(i => i.id === previewInvoice.id);
        const hasPrev = navIdx > 0;
        const hasNext = navIdx >= 0 && navIdx < navList.length - 1;
        return <InvoicePreview
          invoice={previewInvoice}
          business={config}
          client={clients.find(c=>c.id===previewInvoice.clientId)}
          onClose={()=>{ setPreviewInvoice(null); setPreviewInvoiceList([]); }}
          onEdit={inv=>{setPreviewInvoice(null);setPreviewInvoiceList([]);setSelectedProfileClient(null);setEditInvoice(inv);setCurrentView('new-invoice');}}
          onSave={inv=>{const base=invoices.map(i=>i.id===inv.id?inv:i);const upd=recalcClientStatuses(getInvClientKey(inv),base);setInvoices(upd);local.setAll(uid,'invoices',upd);setPreviewInvoice(inv);}}
          onPrev={hasPrev ? ()=>setPreviewInvoice(navList[navIdx-1]) : undefined}
          onNext={hasNext ? ()=>setPreviewInvoice(navList[navIdx+1]) : undefined}
          currentIndex={navIdx >= 0 ? navIdx : undefined}
          totalCount={navList.length > 0 ? navList.length : undefined}
        />;
      })()}
      {previewStockEntry && <StockEntryPreview entry={previewStockEntry} business={config} onClose={()=>setPreviewStockEntry(null)} onEdit={e=>{setPreviewStockEntry(null);setEditStockEntry(e);setCurrentView('new-stock-entry');}}/>}
      {selectedProfileClient && (() => {
        const pc = selectedProfileClient;
        // Klientë me të njëjtin emër por qytet të ndryshëm
        const hasDupName = clients.some(c => c.id !== pc.id && normalize(c.name.trim()) === normalize(pc.name.trim()));
        const pcCity = normalize(pc.city?.trim() || '');
        const profileInvoices = invoices.filter(inv => {
          // Kur ka klientë me të njëjtin emër, qyteti është çelësi kryesor
          // (clientId mund të tregojë klientin e gabuar për faturat e vjetra)
          if (hasDupName) {
            // Emri duhet të përputhet
            if (normalize(inv.clientName.trim()) !== normalize(pc.name.trim())) return false;
            // Nëse ka qytet në faturë dhe te klienti — dalloji me qytet
            if (inv.clientCity && pcCity) return normalize(inv.clientCity.trim()) === pcCity;
            // Pa qytet: fallback te ID ose kodi
            if (pc.code && inv.clientCode) return inv.clientCode === pc.code;
            return inv.clientId === pc.id;
          }
          // Pa emra duplikatë: ID është çelësi kryesor
          if (inv.clientId === pc.id) return true;
          if (pc.code && inv.clientCode) return inv.clientCode === pc.code;
          if (inv.clientCode) return false;
          if (inv.clientId !== 'manual') return false;
          return normalize(inv.clientName.trim()) === normalize(pc.name.trim());
        });
        return <ClientProfile client={pc} invoices={profileInvoices} items={items} onUpdateItems={ni=>{setItems(ni);local.setAll(uid, 'items', ni);}} onUpdateClient={u=>{const upd=clients.map(c=>c.id===u.id?u:c);setClients(upd);local.setAll(uid, 'clients', upd);}} onClose={()=>setSelectedProfileClient(null)} onViewInvoice={inv=>{const sorted=[...profileInvoices].sort((a,b)=>b.date.localeCompare(a.date));setPreviewInvoiceList(sorted);setPreviewInvoice(inv);}} onNewInvoice={handleNewInvoiceForClient}/>;
      })()}
      {selectedProfileItem && <ItemProfile item={selectedProfileItem} invoices={invoices} stockEntries={stockEntries} clients={clients} onUpdateItem={u=>{const upd=items.map(i=>i.id===u.id?u:i);setItems(upd);local.setAll(uid, 'items', upd);}} onUpdateStockEntry={u=>{const upd=stockEntries.map(e=>e.id===u.id?u:e);setStockEntries(upd);local.setAll(uid,'stock_entries',upd);}} onClose={()=>setSelectedProfileItem(null)}/>}
    </div>
  );
};

const WrappedApp: React.FC = () => (
  <ErrorBoundary><App /></ErrorBoundary>
);
export default WrappedApp;
