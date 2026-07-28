// ─── Cloud Sync layer — Firebase Firestore ────────────────────────────────────
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, doc,
  setDoc, getDoc, getDocs,
  onSnapshot, Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              as string,
};

let db: Firestore | null = null;
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(firebaseApp);
}

export const CLOUD_ENABLED = !!db;

// ─── Struktura Firestore ──────────────────────────────────────────────────────
// users/{cloudId}/data/{tableName}  → { data: any[], updatedAt: string }
// users/{cloudId}/data/_auth        → { data: [{ username, passwordHash }] }

const userCol  = (id: string) => collection(db!, 'users', id, 'data');
const tableDoc = (id: string, t: string) => doc(db!, 'users', id, 'data', t);

// Tipi i kanalit — funksion unsubscribe i Firebase (zëvendëson RealtimeChannel)
export type CloudChannel = (() => void) | null;

export interface CloudRow { data: any[]; updatedAt: string; }

// ─── Ruaj një tabelë ─────────────────────────────────────────────────────────
export async function cloudSave(userId: string, tableName: string, data: any[]): Promise<void> {
  if (!db) return;
  try {
    await setDoc(tableDoc(userId, tableName), { data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('[cloudSync] save error:', e);
    throw e;
  }
}

// ─── Ruaj konfigurimin ────────────────────────────────────────────────────────
export async function cloudSaveConfig(userId: string, config: any): Promise<void> {
  await cloudSave(userId, 'config', [config]);
}

// ─── Ngarko të gjitha tabelat ─────────────────────────────────────────────────
export async function cloudLoadAll(userId: string): Promise<Record<string, CloudRow>> {
  if (!db) return {};
  try {
    const snapshot = await getDocs(userCol(userId));
    const result: Record<string, CloudRow> = {};
    snapshot.forEach(d => {
      const td = d.data();
      if (d.id !== '_auth' && Array.isArray(td.data)) {
        result[d.id] = { data: td.data, updatedAt: td.updatedAt || '' };
      }
    });
    return result;
  } catch (e) {
    console.warn('[cloudSync] loadAll error:', e);
    return {};
  }
}

// ─── Real-time subscribe ──────────────────────────────────────────────────────
export function cloudSubscribe(
  userId: string,
  onChange: (tableName: string, data: any[]) => void
): CloudChannel {
  if (!db) return null;

  let initialized = false;

  const unsubscribe = onSnapshot(
    userCol(userId),
    (snapshot) => {
      // Snapshot-i fillestar mbulohet nga cloudLoadAll — kalo
      if (!initialized) { initialized = true; return; }

      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const tableName = change.doc.id;
          const data = change.doc.data().data;
          if (tableName !== '_auth' && Array.isArray(data)) {
            onChange(tableName, data);
          }
        }
      });
    },
    (error) => console.warn('[cloudSync] subscription error:', error)
  );

  return unsubscribe;
}

// ─── Çregjistro listener ──────────────────────────────────────────────────────
export function cloudUnsubscribe(channel: CloudChannel): void {
  if (channel) channel();
}

// ─── Auth cloud: kredencialet ndër-pajisje ────────────────────────────────────
export async function cloudSaveCredentials(username: string, passwordHash: string): Promise<void> {
  if (!db) return;
  try {
    await setDoc(tableDoc(username.toLowerCase().trim(), '_auth'), {
      data: [{ username, passwordHash }],
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[cloudSync] saveCredentials error:', e);
  }
}

export async function cloudCheckCredentials(
  username: string,
  passwordHash: string
): Promise<{ username: string } | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(tableDoc(username.toLowerCase().trim(), '_auth'));
    if (!snap.exists()) return null;
    const cred = snap.data()?.data?.[0];
    if (!cred || cred.passwordHash !== passwordHash) return null;
    return { username: cred.username };
  } catch (e) {
    console.warn('[cloudSync] checkCredentials error:', e);
    return null;
  }
}

export async function cloudUsernameExists(username: string): Promise<boolean> {
  if (!db) return false;
  try {
    const snap = await getDoc(tableDoc(username.toLowerCase().trim(), '_auth'));
    return snap.exists();
  } catch { return false; }
}
