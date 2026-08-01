import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

export const CLOUD_ENABLED = true;
export const CLOUD_INIT_ERROR = '';

export interface CloudRow { data: any[]; updatedAt: string; }
export type CloudChannel = Unsubscribe | null;

// username → firebase email (internal)
const toEmail = (username: string) => `${username.toLowerCase().trim()}@intal-pro.app`;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function cloudRegister(username: string, password: string): Promise<{ uid: string; username: string }> {
  const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password);
  // Ruaj profilin dhe username-in
  await setDoc(doc(db, 'usernames', username.toLowerCase().trim()), {
    uid: cred.user.uid,
    username,
    createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, 'users', cred.user.uid, 'profile', 'data'), {
    username,
    createdAt: new Date().toISOString(),
  });
  return { uid: cred.user.uid, username };
}

export async function cloudLogin(username: string, password: string): Promise<{ uid: string; username: string }> {
  const cred = await signInWithEmailAndPassword(auth, toEmail(username), password);
  return { uid: cred.user.uid, username };
}

export async function cloudLogout(): Promise<void> {
  await signOut(auth);
}

export function cloudOnAuthChange(callback: (user: { uid: string; username: string } | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (!firebaseUser) { callback(null); return; }
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid, 'profile', 'data'));
      const username = snap.exists() ? snap.data().username : firebaseUser.email?.split('@')[0] || '';
      callback({ uid: firebaseUser.uid, username });
    } catch {
      callback(null);
    }
  });
}

// ─── Data (chunks: max 400 rekorde / dokument për limitin 1MB) ───────────────

const TABLES = ['invoices', 'clients', 'items', 'stock_entries', 'config'] as const;
const CHUNK = 400;

// Shkruan chunks atomikisht me WriteBatch (max 500 ops/batch)
export async function cloudSave(uid: string, tableName: string, data: any[]): Promise<void> {
  const now = new Date().toISOString();
  const chunks: any[][] = [];
  for (let i = 0; i < Math.max(1, Math.ceil(data.length / CHUNK)); i++) {
    chunks.push(data.slice(i * CHUNK, (i + 1) * CHUNK));
  }

  // Gjej chunks të vjetra për fshirje
  const oldDocIds: string[] = [];
  for (let i = chunks.length; i < chunks.length + 20; i++) {
    const docId = i === 0 ? tableName : `${tableName}_${i}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'tables', docId));
      if (!snap.exists()) break;
      oldDocIds.push(docId);
    } catch { break; }
  }

  // Shkruaj TË GJITHA chunks në një batch (atomik — onSnapshot aktivizohet një herë)
  const batch = writeBatch(db);
  for (let i = 0; i < chunks.length; i++) {
    const docId = i === 0 ? tableName : `${tableName}_${i}`;
    batch.set(doc(db, 'users', uid, 'tables', docId), {
      data: chunks[i],
      chunkIndex: i,
      totalChunks: chunks.length,
      updatedAt: now,
    });
  }
  for (const docId of oldDocIds) {
    batch.delete(doc(db, 'users', uid, 'tables', docId));
  }
  await batch.commit();
}

// Lexon të gjitha chunks dhe i bashkon
async function loadTable(uid: string, tableName: string): Promise<any[]> {
  const first = await getDoc(doc(db, 'users', uid, 'tables', tableName));
  if (!first.exists()) return [];
  const d0 = first.data();
  if (!Array.isArray(d0.data)) return [];
  const total = d0.totalChunks || 1;
  const result = [...d0.data];
  for (let i = 1; i < total; i++) {
    const snap = await getDoc(doc(db, 'users', uid, 'tables', `${tableName}_${i}`));
    if (snap.exists() && Array.isArray(snap.data().data)) result.push(...snap.data().data);
  }
  return result;
}

export async function cloudLoadAll(uid: string): Promise<Record<string, CloudRow>> {
  const result: Record<string, CloudRow> = {};
  const now = new Date().toISOString();
  for (const table of TABLES) {
    const data = await loadTable(uid, table);
    if (data.length > 0 || table === 'config') {
      const snap = await getDoc(doc(db, 'users', uid, 'tables', table));
      const updatedAt = snap.exists() ? (snap.data().updatedAt || now) : now;
      result[table] = { data, updatedAt };
    }
  }
  return result;
}

export function cloudSubscribe(
  uid: string,
  onChange: (tableName: string, data: any[]) => void
): CloudChannel {
  const tablesCol = collection(db, 'users', uid, 'tables');
  const pending: Record<string, ReturnType<typeof setTimeout>> = {};
  return onSnapshot(tablesCol, (snapshot) => {
    const changed = new Set<string>();
    snapshot.docChanges().forEach(change => {
      if (change.type === 'modified' || change.type === 'added') {
        // Merr emrin bazë (invoices_1 → invoices)
        const base = change.doc.id.replace(/_\d+$/, '');
        changed.add(base);
      }
    });
    // Bashko chunks para se të njoftojmë
    changed.forEach(base => {
      if (pending[base]) clearTimeout(pending[base]);
      pending[base] = setTimeout(async () => {
        const data = await loadTable(uid, base);
        onChange(base, data);
      }, 200);
    });
  });
}

export function cloudUnsubscribe(channel: CloudChannel): void {
  if (channel) channel();
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function cloudGetAllUsers(): Promise<{ username: string; uid: string; createdAt: string }[]> {
  try {
    const snap = await getDocs(collection(db, 'usernames'));
    return snap.docs.map(d => ({ username: d.data().username, uid: d.data().uid, createdAt: d.data().createdAt || '' }));
  } catch { return []; }
}

export async function cloudDeleteUser(uid: string, username: string): Promise<void> {
  await deleteDoc(doc(db, 'usernames', username.toLowerCase().trim()));
  for (const table of TABLES) {
    await deleteDoc(doc(db, 'users', uid, 'tables', table));
  }
  await deleteDoc(doc(db, 'users', uid, 'profile', 'data'));
}

// Aliases
export const cloudSaveConfig = (uid: string, config: any) => cloudSave(uid, 'config', [config]);

// Stub — lock/reset kërkon Firebase Admin SDK (server-side)
export async function cloudLockUser(_uid: string, _locked: boolean): Promise<void> {
  console.warn('[cloudSync] cloudLockUser: not available in client-side Firebase Auth');
}
export async function cloudResetPassword(_uid: string, _newHash: string): Promise<void> {
  console.warn('[cloudSync] cloudResetPassword: not available in client-side Firebase Auth');
}
export async function cloudUsernameExists(username: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'usernames', username.toLowerCase().trim()));
    return snap.exists();
  } catch { return false; }
}
