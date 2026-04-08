import React, { useState } from 'react';
import { FileText, LogIn, UserPlus, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase, usernameToEmail } from '../utils/supabase';

interface Props { onAuth: () => void; }

const AuthScreen: React.FC<Props> = ({ onAuth }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const withTimeout = <T,>(promise: Promise<T>, ms = 20000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

  // Kontrollo nëse mund të arrijmë Supabase
  const checkConnectivity = async (): Promise<'ok' | 'no-internet' | 'server-down'> => {
    if (!navigator.onLine) return 'no-internet';
    try {
      const url = (import.meta as any).env?.VITE_SUPABASE_URL;
      if (!url) return 'server-down';
      const res = await fetch(`${url}/auth/v1/health`, { method: 'GET', signal: AbortSignal.timeout(8000) });
      return res.ok || res.status === 400 ? 'ok' : 'server-down';
    } catch {
      return 'server-down';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const uname = username.trim();
    if (!uname || uname.length < 3) return setError('Emri i përdoruesit duhet të ketë të paktën 3 karaktere.');
    if (password.length < 6)        return setError('Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
    if (mode === 'register' && password !== password2) return setError('Fjalëkalimet nuk përputhen.');

    setLoading(true);
    const email = usernameToEmail(uname);

    try {
      // Kontrollo lidhjen para se të provosh auth
      const conn = await checkConnectivity();
      if (conn === 'no-internet') {
        setError('Nuk ka internet. Kontrollo lidhjen dhe provo sërish.');
        return;
      }
      if (conn === 'server-down') {
        setError('Serveri nuk është i arritshëm. Provo pas pak sekondash.');
        return;
      }

      if (mode === 'register') {
        const { error: err } = await withTimeout(supabase.auth.signUp({ email, password,
          options: { data: { username: uname } }
        }));
        if (err) {
          if (err.message.includes('already registered') || err.message.includes('User already registered'))
            setError('Ky emër përdoruesi ekziston tashmë. Provoni të logoheni.');
          else setError(err.message);
        } else {
          setSuccess('Llogaria u krijua! Duke u lidhur...');
          const { error: loginErr } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
          if (!loginErr) onAuth();
          else setError(loginErr.message);
        }
      } else {
        const { error: err } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
        if (err) {
          if (err.message.includes('Invalid login') || err.message.includes('invalid_credentials'))
            setError('Emri i përdoruesit ose fjalëkalimi është i gabuar.');
          else setError(err.message);
        } else {
          onAuth();
        }
      }
    } catch (ex: any) {
      if (ex?.message === 'timeout')
        setError('Koha e pritjes skadoi. Lidhja është e ngadaltë — provo sërish.');
      else
        setError('Gabim i papritur. Provo sërish.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
          {/* Toggle */}
          <div className="flex bg-slate-700 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <LogIn size={12} className="inline mr-1.5" /> Hyr
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <UserPlus size={12} className="inline mr-1.5" /> Krijo Llogari
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Emri i Përdoruesit
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="p.sh. arditzgura"
                autoComplete="username"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#D81B60] transition-colors text-sm font-bold"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Fjalëkalimi
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimumi 6 karaktere"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#D81B60] transition-colors text-sm font-bold"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Konfirmo fjalëkalimin (vetëm register) */}
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Konfirmo Fjalëkalimin
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  placeholder="Ripërsërit fjalëkalimin"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#D81B60] transition-colors text-sm font-bold"
                />
              </div>
            )}

            {/* Error / Success */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D81B60] hover:bg-[#AD1457] text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#D81B60]/20 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> :
                mode === 'login' ? <><LogIn size={16} /> Hyr</> : <><UserPlus size={16} /> Krijo & Hyr</>
              }
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
