// ─── Cloud Sync — Firebase Realtime Database ──────────────────────────────────
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onValue, Database } from 'firebase/database';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              as string,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL        as string,
};

let db: Database | null = null;
export let CLOUD_INIT_ERROR = '';

try {
  if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getDatabase(app, firebaseConfig.databaseURL);
    console.log('[cloudSync] RTDB initialized:', firebaseConfig.databaseURL);
  } else {
    CLOUD_INIT_ERROR = 'Config missing: databaseURL=' + firebaseConfig.databaseURL;
    console.error('[cloudSync]', CLOUD_INIT_ERROR);
  }
} catch (e: any) {
  CLOUD_INIT_ERROR = String(e?.message || e);
  console.error('[cloudSync] RTDB init error:', e);
}

export const CLOUD_ENABLED = !!db;

// ─── Tipet ───────────────────────────────────────────────────────────────────
export type CloudChannel = (() => void) | null;
export interface CloudRow { data: any[]; updatedAt: string; }

// ─── Path helpers ─────────────────────────────────────────────────────────────
const uRef  = (u: string)           => ref(db!, `users/${u}`);
const tRef  = (u: string, t: string) => ref(db!, `users/${u}/${t}`);
const authRef = (u: string)         => ref(db!, `users/${u}/auth`);

// ─── Ruaj një tabelë ─────────────────────────────────────────────────────────
export async function cloudSave(username: string, tableName: string, data: any[]): Promise<void> {
  if (!db) return;
  try {
    await set(tRef(username, tableName), { data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('[cloudSync] save error:', e);
    throw e;
  }
}

// ─── Ruaj konfigurimin ────────────────────────────────────────────────────────
export async function cloudSaveConfig(username: string, config: any): Promise<void> {
  if (!db) return;
  await set(tRef(username, 'config'), { data: [config], updatedAt: new Date().toISOString() });
}

// ─── Ngarko të gjitha tabelat (një herë) ─────────────────────────────────────
export async function cloudLoadAll(username: string): Promise<Record<string, CloudRow>> {
  if (!db) return {};
  try {
    const snap = await get(uRef(username));
    if (!snap.exists()) return {};
    const val = snap.val() as Record<string, any>;
    const result: Record<string, CloudRow> = {};
    for (const key of Object.keys(val)) {
      if (key === 'auth') continue;
      const entry = val[key];
      if (entry && Array.isArray(entry.data)) {
        result[key] = { data: entry.data, updatedAt: entry.updatedAt || '' };
      }
    }
    return result;
  } catch (e) {
    console.warn('[cloudSync] loadAll error:', e);
    return {};
  }
}

// ─── Real-time subscribe ──────────────────────────────────────────────────────
export function cloudSubscribe(
  username: string,
  onChange: (tableName: string, data: any[]) => void
): CloudChannel {
  if (!db) return null;

  let initialized = false;

  const unsub = onValue(uRef(username), (snap) => {
    if (!initialized) { initialized = true; return; }
    if (!snap.exists()) return;
    const val = snap.val() as Record<string, any>;
    for (const key of Object.keys(val)) {
      if (key === 'auth') continue;
      const entry = val[key];
      if (entry && Array.isArray(entry.data)) {
        onChange(key, entry.data);
      }
    }
  });

  return unsub;
}

// ─── Çregjistro listener ──────────────────────────────────────────────────────
export function cloudUnsubscribe(channel: CloudChannel): void {
  if (channel) channel();
}

// ─── Auth: regjistrim ─────────────────────────────────────────────────────────
export async function cloudSaveCredentials(username: string, passwordHash: string): Promise<void> {
  if (!db) return;
  try {
    await set(authRef(username.toLowerCase().trim()), { username, passwordHash });
  } catch (e) {
    console.warn('[cloudSync] saveCredentials error:', e);
  }
}

// ─── Auth: kontroll fjalëkalimi ───────────────────────────────────────────────
export async function cloudCheckCredentials(
  username: string,
  passwordHash: string
): Promise<{ username: string } | null> {
  if (!db) return null;
  try {
    const snap = await get(authRef(username.toLowerCase().trim()));
    if (!snap.exists()) return null;
    const auth = snap.val();
    if (auth.passwordHash !== passwordHash) return null;
    if (auth.locked) return null;
    return { username: auth.username || username };
  } catch (e) {
    console.warn('[cloudSync] checkCredentials error:', e);
    return null;
  }
}

// ─── Admin: veprime mbi përdorues ────────────────────────────────────────────
export async function cloudDeleteUser(username: string): Promise<void> {
  if (!db) return;
  await remove(ref(db, `users/${username.toLowerCase().trim()}`));
}

export async function cloudLockUser(username: string, locked: boolean): Promise<void> {
  if (!db) return;
  const key = username.toLowerCase().trim();
  const snap = await get(authRef(key));
  if (!snap.exists()) return;
  await set(authRef(key), { ...snap.val(), locked });
}

export async function cloudResetPassword(username: string, newHash: string): Promise<void> {
  if (!db) return;
  const key = username.toLowerCase().trim();
  const snap = await get(authRef(key));
  if (!snap.exists()) return;
  await set(authRef(key), { ...snap.val(), passwordHash: newHash, locked: false });
}

// ─── Auth: kontroll ekzistencës ───────────────────────────────────────────────
export async function cloudUsernameExists(username: string): Promise<boolean> {
  if (!db) return false;
  try {
    const snap = await get(authRef(username.toLowerCase().trim()));
    return snap.exists();
  } catch { return false; }
}

// ─── Admin: merr të gjithë përdoruesit ───────────────────────────────────────
export async function cloudGetAllUsers(): Promise<{ username: string; invoiceCount: number; lastSync: string; locked: boolean }[]> {
  if (!db) return [];
  try {
    const snap = await get(ref(db, 'users'));
    if (!snap.exists()) return [];
    const users: { username: string; invoiceCount: number; lastSync: string }[] = [];
    snap.forEach(child => {
      const data = child.val();
      const invoiceCount = data?.invoices?.data?.length ?? 0;
      const lastSync = data?.invoices?.updatedAt ?? data?.clients?.updatedAt ?? '';
      const locked = data?.auth?.locked ?? false;
      users.push({ username: child.key || '', invoiceCount, lastSync, locked });
    });
    return users.sort((a, b) => a.username.localeCompare(b.username));
  } catch { return []; }
}
