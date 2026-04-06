import { supabase } from './supabase';
import { Client, Invoice, Item, StockEntry, BusinessConfig } from '../types';

type Table = 'clients' | 'items' | 'invoices' | 'stock_entries';

// ─── Lexo të gjitha ───────────────────────────────────────────────────────────
async function fetchAll<T>(table: Table, userId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(r => r.data as T);
}

// ─── Ruaj një rekord ──────────────────────────────────────────────────────────
async function upsertOne<T extends { id: string }>(
  table: Table, userId: string, record: T
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .upsert({ id: record.id, user_id: userId, data: record }, { onConflict: 'id,user_id' });
  if (error) throw error;
}

// ─── Ruaj shumë rekorde menjëherë (migrate / import) ─────────────────────────
async function upsertMany<T extends { id: string }>(
  table: Table, userId: string, records: T[]
): Promise<void> {
  if (!records.length) return;
  const rows = records.map(r => ({ id: r.id, user_id: userId, data: r }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id,user_id' });
  if (error) throw error;
}

// ─── Fshi një rekord ──────────────────────────────────────────────────────────
async function removeOne(table: Table, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Fshi të gjitha (për import të plotë) ────────────────────────────────────
async function clearTable(table: Table, userId: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('user_id', userId);
  if (error) throw error;
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function fetchConfig(userId: string): Promise<BusinessConfig | null> {
  const { data } = await supabase
    .from('user_config')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.data ?? null;
}

async function saveConfig(userId: string, config: BusinessConfig): Promise<void> {
  const { error } = await supabase
    .from('user_config')
    .upsert({ user_id: userId, data: config }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ─── API publike ─────────────────────────────────────────────────────────────
export const db = {
  clients: {
    fetchAll: (uid: string) => fetchAll<Client>('clients', uid),
    upsert:   (uid: string, r: Client)   => upsertOne('clients', uid, r),
    upsertMany:(uid: string, rs: Client[])=> upsertMany('clients', uid, rs),
    remove:   (uid: string, id: string)  => removeOne('clients', uid, id),
    clear:    (uid: string)              => clearTable('clients', uid),
  },
  items: {
    fetchAll: (uid: string) => fetchAll<Item>('items', uid),
    upsert:   (uid: string, r: Item)     => upsertOne('items', uid, r),
    upsertMany:(uid: string, rs: Item[]) => upsertMany('items', uid, rs),
    remove:   (uid: string, id: string)  => removeOne('items', uid, id),
    clear:    (uid: string)              => clearTable('items', uid),
  },
  invoices: {
    fetchAll: (uid: string) => fetchAll<Invoice>('invoices', uid),
    upsert:   (uid: string, r: Invoice)  => upsertOne('invoices', uid, r),
    upsertMany:(uid: string, rs: Invoice[])=> upsertMany('invoices', uid, rs),
    remove:   (uid: string, id: string)  => removeOne('invoices', uid, id),
    clear:    (uid: string)              => clearTable('invoices', uid),
  },
  stockEntries: {
    fetchAll: (uid: string) => fetchAll<StockEntry>('stock_entries', uid),
    upsert:   (uid: string, r: StockEntry) => upsertOne('stock_entries', uid, r),
    upsertMany:(uid: string, rs: StockEntry[])=> upsertMany('stock_entries', uid, rs),
    remove:   (uid: string, id: string)  => removeOne('stock_entries', uid, id),
    clear:    (uid: string)              => clearTable('stock_entries', uid),
  },
  config: { fetch: fetchConfig, save: saveConfig },
};
