// ─── Storage: Electron (skedar JSON) → IndexedDB → localStorage ───────────────
// Renditja e prioritetit: Electron file > IDB > localStorage

// Detektor Electron
const eAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
const IS_ELECTRON = !!(eAPI?.dbRead && eAPI?.dbWrite);

// ─── Electron file store ──────────────────────────────────────────────────────
// Lexon/shkruan një skedar JSON të vetëm në %APPDATA%\INTAL PRO\intal-data.json
let _fileCache: Record<string, string> = {};   // cache RAM për reads sinkronë
let _fileDirty = false;
let _fileWriteTimer: ReturnType<typeof setTimeout> | null = null;

function electronWrite(): void {
  if (!IS_ELECTRON) return;
  if (_fileWriteTimer) clearTimeout(_fileWriteTimer);
  _fileWriteTimer = setTimeout(() => {
    eAPI.dbWrite(JSON.stringify(_fileCache)).catch((e: any) =>
      console.warn('[electron] dbWrite error:', e)
    );
    _fileDirty = false;
  }, 300); // debounce 300ms
}

export async function electronLoadAll(): Promise<void> {
  if (!IS_ELECTRON) return;
  try {
    const raw = await eAPI.dbRead();
    if (raw) _fileCache = JSON.parse(raw);
  } catch (e) {
    console.warn('[electron] dbRead error:', e);
  }
}

// ─── IndexedDB store ──────────────────────────────────────────────────────────

const DB_NAME = 'intal_db';
const DB_VER  = 1;
const STORE   = 'kv'; // key-value store i thjeshtë

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => { _db = req.result; resolve(_db!); };
    req.onerror   = () => reject(req.error);
  });
}

function idbGet(key: string): Promise<string | null> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  }));
}

function idbSet(key: string, value: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

function idbDel(key: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

// ─── Cache në memorie për lexime sinkrone ────────────────────────────────────
// Meqë IndexedDB është async por shumë vende lexojnë sinkronisht,
// mbajmë një cache RAM që ngarkohet gjatë inicializimit.
const memCache: Record<string, string> = {};

function cacheKey(userId: string, table: string) {
  return `intal_${userId}_${table}`;
}

// Ngarko të gjitha të dhënat e një userId nga IDB → memCache (thirrur gjatë login)
export async function preloadUserData(userId: string): Promise<void> {
  if (IS_ELECTRON) {
    // Electron: ngarko nga skedari JSON (tashmë i ngarkuar nga electronLoadAll)
    const tables = ['invoices','clients','items','stock_entries','config','last_modified','intal_auto_backup'];
    for (const t of tables) {
      const key = t === 'intal_auto_backup' ? t : cacheKey(userId, t);
      if (_fileCache[key] !== undefined) memCache[key] = _fileCache[key];
    }
    return;
  }

  // Web: IDB → localStorage fallback
  const tables = ['invoices','clients','items','stock_entries','config','last_modified'];
  await Promise.all(tables.map(async t => {
    const key = cacheKey(userId, t);
    const idbVal = await idbGet(key);
    const lsVal  = localStorage.getItem(key);

    if (idbVal !== null) {
      memCache[key] = idbVal;
      if (!lsVal) try { localStorage.setItem(key, idbVal); } catch { /* */ }
    } else if (lsVal !== null) {
      memCache[key] = lsVal;
      await idbSet(key, lsVal).catch(() => {});
    }
  }));

  // Auto-backup
  const abKey = 'intal_auto_backup';
  const abIdb = await idbGet(abKey);
  const abLs  = localStorage.getItem(abKey);
  if (abIdb !== null) {
    memCache[abKey] = abIdb;
  } else if (abLs !== null) {
    memCache[abKey] = abLs;
    await idbSet(abKey, abLs).catch(() => {});
  }
}

// ─── Helpers sinkronë (lexojnë nga memCache) ─────────────────────────────────

let _lastLocalWrite = 0;
export const getLastLocalWrite = () => _lastLocalWrite;
export const touchNow = () => { _lastLocalWrite = Date.now(); };

const touch = (userId: string) => {
  const now = new Date().toISOString();
  const key = cacheKey(userId, 'last_modified');
  memCache[key] = now;
  idbSet(key, now).catch(() => {});
  _lastLocalWrite = Date.now();
};

function syncSet(key: string, value: string): void {
  memCache[key] = value;
  if (IS_ELECTRON) {
    // Electron: shkruaj në skedarin JSON
    _fileCache[key] = value;
    electronWrite();
  } else {
    // Web: localStorage backup sinkron + IDB kryesor
    try { localStorage.setItem(key, value); } catch { /* quota */ }
    idbSet(key, value).catch(e => console.warn('[localDb] IDB write error:', key, e));
  }
}

function syncDel(key: string): void {
  delete memCache[key];
  if (IS_ELECTRON) {
    delete _fileCache[key];
    electronWrite();
  } else {
    try { localStorage.removeItem(key); } catch { /* */ }
    idbDel(key).catch(() => {});
  }
}

export const local = {
  getAll: <T>(userId: string, table: string): T[] => {
    try { return JSON.parse(memCache[cacheKey(userId, table)] || '[]'); }
    catch { return []; }
  },

  setAll: <T>(userId: string, table: string, data: T[]): void => {
    syncSet(cacheKey(userId, table), JSON.stringify(data));
    touch(userId);
  },

  setAllSilent: <T>(userId: string, table: string, data: T[]): void => {
    syncSet(cacheKey(userId, table), JSON.stringify(data));
  },

  setConfigSilent: (userId: string, config: any): void => {
    syncSet(cacheKey(userId, 'config'), JSON.stringify(config));
  },

  upsert: <T extends { id: string }>(userId: string, table: string, record: T): void => {
    const all = local.getAll<T>(userId, table);
    const idx = all.findIndex(r => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    local.setAll(userId, table, all);
  },

  remove: <T extends { id: string }>(userId: string, table: string, id: string): void => {
    const filtered = local.getAll<T>(userId, table).filter((r: any) => r.id !== id);
    local.setAll(userId, table, filtered);
  },

  clear: (userId: string, table: string): void => {
    syncDel(cacheKey(userId, table));
  },

  getConfig: (userId: string): any => {
    try { return JSON.parse(memCache[cacheKey(userId, 'config')] || 'null'); }
    catch { return null; }
  },

  setConfig: (userId: string, config: any): void => {
    syncSet(cacheKey(userId, 'config'), JSON.stringify(config));
    touch(userId);
  },

  getLastModified: (userId: string): string => {
    return memCache[cacheKey(userId, 'last_modified')] || '1970-01-01T00:00:00.000Z';
  },

  // Ruaj auto-backup të plotë (thirrur nga App.tsx)
  saveAutoBackup: (data: string): void => {
    memCache['intal_auto_backup'] = data;
    if (IS_ELECTRON) {
      _fileCache['intal_auto_backup'] = data;
      electronWrite();
    } else {
      try { localStorage.setItem('intal_auto_backup', data); } catch { /* quota */ }
      idbSet('intal_auto_backup', data).catch(e => console.warn('[localDb] auto-backup write error:', e));
    }
  },

  getAutoBackup: (): string | null => {
    return memCache['intal_auto_backup'] ?? localStorage.getItem('intal_auto_backup');
  },
};
