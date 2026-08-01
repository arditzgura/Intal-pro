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
  console.log('[cloudLogin] UID:', cred.user.uid, '| email:', cred.user.email);
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

// ─── Data ─────────────────────────────────────────────────────────────────────

const TABLES = ['invoices', 'clients', 'items', 'stock_entries', 'config'] as const;

export async function cloudSave(uid: string, tableName: string, data: any[]): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'tables', tableName), {
    data,
    updatedAt: new Date().toISOString(),
  });
}

export async function cloudLoadAll(uid: string): Promise<Record<string, CloudRow>> {
  const result: Record<string, CloudRow> = {};
  for (const table of TABLES) {
    const snap = await getDoc(doc(db, 'users', uid, 'tables', table));
    if (snap.exists()) {
      const d = snap.data();
      if (Array.isArray(d.data)) result[table] = { data: d.data, updatedAt: d.updatedAt || '' };
    }
  }
  console.log('[cloudSync] loadAll result tables:', Object.keys(result));
  return result;
}

export function cloudSubscribe(
  uid: string,
  onChange: (tableName: string, data: any[]) => void
): CloudChannel {
  const tablesCol = collection(db, 'users', uid, 'tables');
  return onSnapshot(tablesCol, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'modified' || change.type === 'added') {
        const d = change.doc.data();
        if (Array.isArray(d.data)) onChange(change.doc.id, d.data);
      }
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
