import { supabase } from './supabase';
import { local } from './localDb';
import { Client, Invoice, Item, StockEntry, BusinessConfig } from '../types';

type Table = 'clients' | 'items' | 'invoices' | 'stock_entries';

// ─── Lexo nga Supabase (me fallback në localStorage) ─────────────────────────
async function fetchAll<T>(table: Table, userId: string): Promise<T[]> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('data')
      .eq('user_id', userId);
    if (error) throw error;
    const result = (data ?? []).map(r => r.data as T);
    // Sinkronizo localStorage me të dhënat cloud
    local.setAll(userId, table, result);
    return result;
  } catch {
    // Offline — kthe nga localStorage
    return local.getAll<T>(userId, table);
  }
}

// ─── Ruaj një rekord ──────────────────────────────────────────────────────────
async function upsertOne<T extends { id: string }>(
  table: Table, userId: string, record: T
): Promise<void> {
  // Ruaj lokalisht menjëherë
  local.upsert(userId, table, record);
  // Sinkronizo me cloud (pa pritur)
  supabase
    .from(table)
    .upsert({ id: record.id, user_id: userId, data: record }, { onConflict: 'id,user_id' })
    .then(({ error }) => { if (error) console.warn('[sync]', table, error.message); });
}

// ─── Ruaj shumë rekorde (import / migrate) ───────────────────────────────────
async function upsertMany<T extends { id: string }>(
  table: Table, userId: string, records: T[]
): Promise<void> {
  if (!records.length) return;
  // Ruaj lokalisht menjëherë
  local.setAll(userId, table, records);
  // Sinkronizo me cloud në background (pa pritur)
  const rows = records.map(r => ({ id: r.id, user_id: userId, data: r }));
  supabase.from(table).upsert(rows, { onConflict: 'id,user_id' })
    .then(({ error }) => { if (error) console.warn('[sync] upsertMany', table, error.message); })
    .catch(() => { /* offline */ });
}

// ─── Fshi një rekord ──────────────────────────────────────────────────────────
async function removeOne(table: Table, userId: string, id: string): Promise<void> {
  // Fshi lokalisht
  local.remove(userId, table, id);
  // Sinkronizo me cloud
  supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .then(({ error }) => { if (error) console.warn('[sync] remove', table, error.message); });
}

// ─── Fshi të gjitha ───────────────────────────────────────────────────────────
async function clearTable(table: Table, userId: string): Promise<void> {
  // Fshi lokalisht menjëherë
  local.clear(userId, table);
  // Sinkronizo me cloud në background (pa pritur)
  supabase.from(table).delete().eq('user_id', userId)
    .then(({ error }) => { if (error) console.warn('[sync] clear', table, error.message); })
    .catch(() => { /* offline */ });
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function fetchConfig(userId: string): Promise<BusinessConfig | null> {
  try {
    const { data } = await supabase
      .from('user_config')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    const cfg = data?.data ?? null;
    if (cfg) local.setConfig(userId, cfg);
    return cfg;
  } catch {
    return local.getConfig(userId);
  }
}

async function saveConfig(userId: string, config: BusinessConfig): Promise<void> {
  local.setConfig(userId, config);
  supabase
    .from('user_config')
    .upsert({ user_id: userId, data: config }, { onConflict: 'user_id' })
    .then(({ error }) => { if (error) console.warn('[sync] config', error.message); });
}

// ─── Ruaj listën e plotë lokalisht (batch — një shkrim i vetëm) ───────────────
function saveAllLocal<T extends { id: string }>(
  table: Table, userId: string, records: T[], changed: T[]
): void {
  // Një shkrim i vetëm në localStorage për të gjithë listën
  local.setAll(userId, table, records);
  // Sinkronizo vetëm rekorder e ndryshuar me cloud (background)
  if (!changed.length) return;
  const rows = changed.map(r => ({ id: r.id, user_id: userId, data: r }));
  supabase.from(table).upsert(rows, { onConflict: 'id,user_id' })
    .then(({ error }) => { if (error) console.warn('[sync] saveAll', table, error.message); })
    .catch(() => { /* offline */ });
}

// ─── API publike ─────────────────────────────────────────────────────────────
export const db = {
  clients: {
    fetchAll:   (uid: string)              => fetchAll<Client>('clients', uid),
    upsert:     (uid: string, r: Client)   => upsertOne('clients', uid, r),
    upsertMany: (uid: string, rs: Client[])=> upsertMany('clients', uid, rs),
    saveAll:    (uid: string, all: Client[], changed: Client[]) => saveAllLocal('clients', uid, all, changed),
    remove:     (uid: string, id: string)  => removeOne('clients', uid, id),
    clear:      (uid: string)              => clearTable('clients', uid),
  },
  items: {
    fetchAll:   (uid: string)              => fetchAll<Item>('items', uid),
    upsert:     (uid: string, r: Item)     => upsertOne('items', uid, r),
    upsertMany: (uid: string, rs: Item[])  => upsertMany('items', uid, rs),
    saveAll:    (uid: string, all: Item[], changed: Item[]) => saveAllLocal('items', uid, all, changed),
    remove:     (uid: string, id: string)  => removeOne('items', uid, id),
    clear:      (uid: string)              => clearTable('items', uid),
  },
  invoices: {
    fetchAll:   (uid: string)              => fetchAll<Invoice>('invoices', uid),
    upsert:     (uid: string, r: Invoice)  => upsertOne('invoices', uid, r),
    upsertMany: (uid: string, rs: Invoice[])=> upsertMany('invoices', uid, rs),
    saveAll:    (uid: string, all: Invoice[], changed: Invoice[]) => saveAllLocal('invoices', uid, all, changed),
    remove:     (uid: string, id: string)  => removeOne('invoices', uid, id),
    clear:      (uid: string)              => clearTable('invoices', uid),
  },
  stockEntries: {
    fetchAll:   (uid: string)                => fetchAll<StockEntry>('stock_entries', uid),
    upsert:     (uid: string, r: StockEntry) => upsertOne('stock_entries', uid, r),
    upsertMany: (uid: string, rs: StockEntry[])=> upsertMany('stock_entries', uid, rs),
    saveAll:    (uid: string, all: StockEntry[], changed: StockEntry[]) => saveAllLocal('stock_entries', uid, all, changed),
    remove:     (uid: string, id: string)    => removeOne('stock_entries', uid, id),
    clear:      (uid: string)                => clearTable('stock_entries', uid),
  },
  config: { fetch: fetchConfig, save: saveConfig },
};
