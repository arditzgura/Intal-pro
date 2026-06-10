// ─── Cloud Sync layer — Supabase real-time ────────────────────────────────────
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

export const CLOUD_ENABLED = !!supabase;

// ─── Tabela: sync_data ────────────────────────────────────────────────────────
// Kolona: user_id TEXT, table_name TEXT, data JSONB, updated_at TIMESTAMPTZ
// Primary key: (user_id, table_name)
// RLS: user mund të lexojë/shkruajë vetëm rreshtat e vet (user_id = auth.uid() ose value)

const TABLE = 'sync_data';

/** Ruaj të dhënat e një tabele në cloud */
export async function cloudSave(userId: string, tableName: string, data: any[]): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from(TABLE).upsert(
      { user_id: userId, table_name: tableName, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,table_name' }
    );
  } catch (e) {
    console.warn('[cloudSync] save error:', e);
  }
}

/** Ruaj konfigurimin në cloud */
export async function cloudSaveConfig(userId: string, config: any): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from(TABLE).upsert(
      { user_id: userId, table_name: 'config', data: [config], updated_at: new Date().toISOString() },
      { onConflict: 'user_id,table_name' }
    );
  } catch (e) {
    console.warn('[cloudSync] saveConfig error:', e);
  }
}

/** Ngarko të gjitha tabelat nga cloud për një user */
export async function cloudLoadAll(userId: string): Promise<Record<string, any[] | null>> {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('table_name, data')
      .eq('user_id', userId);
    if (error || !data) return {};
    const result: Record<string, any[]> = {};
    data.forEach((row: any) => { result[row.table_name] = row.data; });
    return result;
  } catch (e) {
    console.warn('[cloudSync] loadAll error:', e);
    return {};
  }
}

/** Subscribe për ndryshime real-time me polling fallback */
export function cloudSubscribe(
  userId: string,
  onChange: (tableName: string, data: any[]) => void
): RealtimeChannel | null {
  if (!supabase) return null;

  const channel = supabase
    .channel(`sync_${userId}_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: TABLE,
      },
      (payload: any) => {
        const row = payload.new;
        if (row?.user_id !== userId) return; // filtro manualisht
        if (row?.table_name && Array.isArray(row?.data)) {
          onChange(row.table_name, row.data);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: TABLE,
      },
      (payload: any) => {
        const row = payload.new;
        if (row?.user_id !== userId) return;
        if (row?.table_name && Array.isArray(row?.data)) {
          onChange(row.table_name, row.data);
        }
      }
    )
    .subscribe((status) => {
      console.log('[cloudSync] subscription status:', status);
    });

  return channel;
}

/** Çregjistro channel */
export function cloudUnsubscribe(channel: RealtimeChannel | null): void {
  if (!supabase || !channel) return;
  supabase.removeChannel(channel);
}
