import React, { useEffect, useState } from 'react';
import { Shield, Users, RefreshCw, FileText, Clock, Trash2, Lock, Unlock, KeyRound, X, AlertTriangle } from 'lucide-react';
import { cloudGetAllUsers, cloudDeleteUser, cloudLockUser, cloudResetPassword, CLOUD_ENABLED } from '../utils/cloudSync';

interface UserRow { username: string; uid: string; invoiceCount: number; lastSync: string; locked: boolean; createdAt?: string; }

type DialogType = 'delete' | 'lock' | 'unlock' | 'reset' | null;

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{ type: DialogType; user: UserRow } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const raw = await cloudGetAllUsers();
    setUsers(raw.map(u => ({ ...u, invoiceCount: 0, lastSync: u.createdAt || '', locked: false })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  const simpleHash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return h.toString(36);
  };

  const handleConfirm = async () => {
    if (!dialog) return;
    setActionLoading(true);
    try {
      if (dialog.type === 'delete') {
        await cloudDeleteUser(dialog.user.uid, dialog.user.username);
        showFeedback(`"${dialog.user.username}" u fshi.`);
      } else if (dialog.type === 'lock') {
        await cloudLockUser(dialog.user.username, true);
        showFeedback(`"${dialog.user.username}" u kyç.`);
      } else if (dialog.type === 'unlock') {
        await cloudLockUser(dialog.user.username, false);
        showFeedback(`"${dialog.user.username}" u çkyç.`);
      } else if (dialog.type === 'reset') {
        if (newPassword.length < 6) { setActionLoading(false); return; }
        await cloudResetPassword(dialog.user.username, simpleHash(newPassword));
        showFeedback(`Fjalëkalimi i "${dialog.user.username}" u ndryshua.`);
        setNewPassword('');
      }
      setDialog(null);
      await fetchUsers();
    } catch {
      showFeedback('Gabim gjatë veprimit.', false);
    }
    setActionLoading(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('sq-AL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch { return iso; }
  };

  const dialogConfig = {
    delete: { title: 'Fshi Përdoruesin', desc: (u: string) => `Do të fshish llogarinë e "${u}" dhe të gjitha të dhënat e tij nga cloud. Ky veprim NUK mund të kthehet.`, color: 'red', confirmLabel: 'Fshi Përgjithmonë' },
    lock:   { title: 'Kyç Llogarinë',   desc: (u: string) => `Përdoruesi "${u}" nuk do të mund të hyjë më deri sa ta çkyçësh.`,                                          color: 'amber', confirmLabel: 'Kyç' },
    unlock: { title: 'Çkyç Llogarinë',  desc: (u: string) => `Përdoruesi "${u}" do të mund të hyjë sërish.`,                                                              color: 'emerald', confirmLabel: 'Çkyç' },
    reset:  { title: 'Ndrysho Fjalëkalimin', desc: (u: string) => `Vendos fjalëkalimin e ri për "${u}".`,                                                                  color: 'blue', confirmLabel: 'Ndrysho' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center gap-3">
        <div className="bg-[#D81B60] p-2 rounded-xl"><Shield size={22} /></div>
        <div className="flex-1">
          <h2 className="text-lg font-black uppercase tracking-tight">Paneli i Administratorit</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Firebase RTDB — Menaxhimi i Përdoruesve</p>
        </div>
        <button onClick={fetchUsers} disabled={loading}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Rifresko
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-sm font-bold ${feedback.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {feedback.msg}
        </div>
      )}

      {!CLOUD_ENABLED && (
        <div className="bg-red-950 border border-red-800 text-red-300 p-4 rounded-2xl text-sm font-bold">
          Cloud jo aktiv — nuk mund të ngarkohen përdoruesit.
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Users size={18} className="text-[#D81B60]" />
          <span className="font-black text-slate-800 uppercase tracking-tight text-sm">Përdoruesit ({users.length})</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-slate-400" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm font-bold">Nuk u gjet asnjë përdorues.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {users.map(u => (
              <div key={u.username} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${u.locked ? 'bg-red-100' : 'bg-[#D81B60]/10'}`}>
                  <span className={`font-black text-sm uppercase ${u.locked ? 'text-red-500' : 'text-[#D81B60]'}`}>{u.username.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-800 text-sm">{u.username}</p>
                    {u.locked && <span className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 px-2 py-0.5 rounded-lg flex items-center gap-1"><Lock size={9}/> Kyçur</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase"><FileText size={10}/> {u.invoiceCount} fatura</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase"><Clock size={10}/> {formatDate(u.lastSync)}</span>
                  </div>
                </div>
                {/* Veprimet */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setDialog({ type: u.locked ? 'unlock' : 'lock', user: u })}
                    title={u.locked ? 'Çkyç' : 'Kyç'}
                    className={`p-2 rounded-xl transition-all ${u.locked ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600' : 'bg-amber-50 hover:bg-amber-100 text-amber-600'}`}>
                    {u.locked ? <Unlock size={15}/> : <Lock size={15}/>}
                  </button>
                  <button onClick={() => { setNewPassword(''); setDialog({ type: 'reset', user: u }); }}
                    title="Ndrysho fjalëkalimin"
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all">
                    <KeyRound size={15}/>
                  </button>
                  <button onClick={() => setDialog({ type: 'delete', user: u })}
                    title="Fshi"
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all">
                    <Trash2 size={15}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog konfirmimi */}
      {dialog && (() => {
        const cfg = dialogConfig[dialog.type!];
        const colorMap: Record<string, string> = {
          red: 'bg-red-600 hover:bg-red-700', amber: 'bg-amber-500 hover:bg-amber-600',
          emerald: 'bg-emerald-600 hover:bg-emerald-700', blue: 'bg-blue-600 hover:bg-blue-700',
        };
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                  <h3 className="font-black text-slate-900 text-base">{cfg.title}</h3>
                </div>
                <button onClick={() => setDialog(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
              </div>
              <p className="text-slate-600 text-sm">{cfg.desc(dialog.user.username)}</p>

              {dialog.type === 'reset' && (
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Fjalëkalimi i ri (min 6 karaktere)"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                  autoFocus
                />
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setDialog(null)} disabled={actionLoading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                  Anulo
                </button>
                <button onClick={handleConfirm} disabled={actionLoading || (dialog.type === 'reset' && newPassword.length < 6)}
                  className={`flex-1 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 ${colorMap[cfg.color]}`}>
                  {actionLoading ? '...' : cfg.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminPanel;
