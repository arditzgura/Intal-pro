// ─── localStorage layer — punon offline ──────────────────────────────────────

const k = (userId: string, table: string) => `intal_${userId}_${table}`;

export const local = {
  getAll: <T>(userId: string, table: string): T[] => {
    try { return JSON.parse(localStorage.getItem(k(userId, table)) || '[]'); }
    catch { return []; }
  },

  setAll: <T>(userId: string, table: string, data: T[]): void => {
    localStorage.setItem(k(userId, table), JSON.stringify(data));
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
    localStorage.setItem(`intal_${userId}_config`, JSON.stringify(config));
  },
};
