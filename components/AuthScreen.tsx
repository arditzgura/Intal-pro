
import React, { useState } from 'react';
import { FileText, LogIn, UserPlus, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';

// ─── Auth — me Supabase si backend (cross-device) ────────────────────────────
const LOCAL_USERS_KEY = 'intal_local_users';

interface LocalUser { id: string; username: string; passwordHash: string; }

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return h.toString(36);
}

// ID deterministike bazuar në username (e njëjtë në çdo pajisje)
function deterministicId(username: string): string {
  let h = 5381;
  const s = username.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
  return 'u' + Math.abs(h).toString(36);
}

function getUsers(): LocalUser[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]'); } catch { return []; }
}
function saveUsers(users: LocalUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

// Lexo user nga Supabase
export async function supabaseGetUser(username: string): Promise<LocalUser | null> {
  try {
    const { data } = await supabase
      .from('users')
      .select('user_id, password_hash, username')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();
    if (!data) return null;
    return { id: data.user_id, username: data.username, passwordHash: data.password_hash };
  } catch { return null; }
}

// Ruaj user në Supabase
async function supabaseSaveUser(user: LocalUser): Promise<void> {
  try {
    await supabase.from('users').upsert({
      username: user.username.trim().toLowerCase(),
      user_id: user.id,
      password_hash: user.passwordHash,
    });
  } catch {}
}

// ─── Login (local-first, Supabase fallback, auto-create fallback) ────────────
export async function localLoginAsync(username: string, password: string): Promise<LocalUser | null> {
  const hash = simpleHash(password);
  const uname = username.trim().toLowerCase();

  // 1. Kërko lokalisht (fast path)
  const users = getUsers();
  const localUser = users.find(u => u.username.toLowerCase() === uname);
  if (localUser) {
    if (hash !== localUser.passwordHash) return null;
    supabaseSaveUser(localUser);
    return localUser;
  }

  // 2. Kërko në Supabase
  const remote = await supabaseGetUser(uname);
  if (remote) {
    if (hash !== remote.passwordHash) return null;
    saveUsers([...users, remote]);
    return remote;
  }

  // 3. Nuk u gjet askund — nuk mund të logohemi
  return null;
}

// ─── Regjistrim ──────────────────────────────────────────────────────────────
export async function localRegisterAsync(username: string, password: string): Promise<LocalUser | 'exists'> {
  const uname = username.trim().toLowerCase();
  const users = getUsers();

  // Kontroll lokal
  if (users.find(u => u.username.toLowerCase() === uname)) return 'exists';

  // Kontroll Supabase (nëse ka llogari nga pajisje tjetër)
  const remote = await supabaseGetUser(uname);
  if (remote) return 'exists';

  const hash = simpleHash(password);
  // Nëse user ekziston lokalisht me ID të vjetër, mbaj ID-në; përndryshe bëj deterministike
  const existingLocal = getUsers().find(u => u.username.toLowerCase() === uname);
  const id = existingLocal?.id || deterministicId(uname);

  const newUser: LocalUser = { id, username: uname, passwordHash: hash };
  saveUsers([...users, newUser]);
  await supabaseSaveUser(newUser);
  return newUser;
}

// ─── Sinkronizo userin aktual me Supabase (thirret gjatë session restore) ────
export async function syncSessionUser(user: LocalUser): Promise<void> {
  await supabaseSaveUser(user);
}

// ─── Compat: funksione sinkrone (për migrim) ─────────────────────────────────
export function localLogin(username: string, password: string): LocalUser | null {
  const hash = simpleHash(password);
  const users = getUsers();
  const u = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!u) return null;
  return hash === u.passwordHash ? u : null;
}
export function localRegister(username: string, password: string): LocalUser | 'exists' {
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return 'exists';
  const newUser: LocalUser = { id: deterministicId(username), username: username.trim().toLowerCase(), passwordHash: simpleHash(password) };
  saveUsers([...users, newUser]);
  return newUser;
}

export function setLocalSession(user: LocalUser) {
  localStorage.setItem('intal_session', JSON.stringify({ user, loggedAt: Date.now() }));
}
export function getLocalSession(): { user: LocalUser } | null {
  try { return JSON.parse(localStorage.getItem('intal_session') || 'null'); } catch { return null; }
}
export function clearLocalSession() {
  localStorage.removeItem('intal_session');
}

// ─── Komponenti ───────────────────────────────────────────────────────────────
interface Props { onAuth: (user: LocalUser) => void; }

const AuthScreen: React.FC<Props> = ({ onAuth }) => {
  const [mode, setMode]           = useState<'login' | 'register'>('login');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const uname = username.trim();
    if (!uname || uname.length < 3) return setError('Emri i përdoruesit duhet të ketë të paktën 3 karaktere.');
    if (password.length < 6)        return setError('Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
    if (mode === 'register' && password !== password2) return setError('Fjalëkalimet nuk përputhen.');

    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await localRegisterAsync(uname, password);
        if (result === 'exists') {
          setError('Ky emër përdoruesi ekziston tashmë. Provoni të logoheni.');
        } else {
          setLocalSession(result);
          onAuth(result);
        }
      } else {
        const user = await localLoginAsync(uname, password);
        if (!user) {
          setError('Emri i përdoruesit ose fjalëkalimi është i gabuar.');
        } else {
          setLocalSession(user);
          onAuth(user);
        }
      }
    } catch {
      setError('Problem me lidhjen. Kontrolloni internetin dhe provoni përsëri.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-[#D81B60] p-3 rounded-2xl shadow-2xl shadow-[#D81B60]/30 mb-4">
            <FileText size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white">
            INTAL <span className="text-[#D81B60]">PRO</span>
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Sistemi i Faturimit
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
          <div className="flex bg-slate-700 p-1 rounded-xl mb-6">
            <button onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <LogIn size={12} className="inline mr-1.5" /> Hyr
            </button>
            <button onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <UserPlus size={12} className="inline mr-1.5" /> Krijo Llogari
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Emri i Përdoruesit</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="p.sh. arditzgura" autoComplete="username"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#D81B60] transition-colors text-sm font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fjalëkalimi</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimumi 6 karaktere" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#D81B60] transition-colors text-sm font-bold" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Konfirmo Fjalëkalimin</label>
                <input type={showPass ? 'text' : 'password'} value={password2} onChange={e => setPassword2(e.target.value)}
                  placeholder="Ripërsërit fjalëkalimin" autoComplete="new-password"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#D81B60] transition-colors text-sm font-bold" />
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 bg-rose-900/30 border border-rose-700/50 rounded-xl px-3 py-2.5">
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="text-rose-300 text-xs font-bold">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl px-3 py-2.5">
                <p className="text-emerald-300 text-xs font-bold">{success}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-[#D81B60] hover:bg-[#AD1457] text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#D81B60]/20 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> :
                mode === 'login' ? <><LogIn size={16} /> Hyr</> : <><UserPlus size={16} /> Krijo & Hyr</>}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-6">
          INTAL PRO © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
