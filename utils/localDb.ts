const k = (userId: string, table: string) => `intal_${userId}_${table}`;

let _lastLocalWrite = 0;
export const getLastLocalWrite = () => _lastLocalWrite;
export const touchNow = () => { _lastLocalWrite = Date.now(); };

const touch = (userId: string) => {
  const now = new Date().toISOString();
  try { localStorage.setItem(`intal_${userId}_last_modified`, now); } catch {}
  _lastLocalWrite = Date.now();
};

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      console.warn('[localDb] QuotaExceeded for', key, '— skipping local cache');
    } else throw e;
  }
}

export const local = {
  getAll: <T>(userId: string, table: string): T[] => {
    try { return JSON.parse(localStorage.getItem(k(userId, table)) || '[]'); }
    catch { return []; }
  },

  setAll: <T>(userId: string, table: string, data: T[]): void => {
    safeSet(k(userId, table), JSON.stringify(data));
    touch(userId);
  },

  setAllSilent: <T>(userId: string, table: string, data: T[]): void => {
    safeSet(k(userId, table), JSON.stringify(data));
  },

  setConfigSilent: (userId: string, config: any): void => {
    safeSet(`intal_${userId}_config`, JSON.stringify(config));
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
    localStorage.removeItem(k(userId, table));
  },

  getConfig: (userId: string): any => {
    try { return JSON.parse(localStorage.getItem(`intal_${userId}_config`) || 'null'); }
    catch { return null; }
  },

  setConfig: (userId: string, config: any): void => {
    safeSet(`intal_${userId}_config`, JSON.stringify(config));
    touch(userId);
  },

  getLastModified: (userId: string): string => {
    return localStorage.getItem(`intal_${userId}_last_modified`) || '1970-01-01T00:00:00.000Z';
  },
};
