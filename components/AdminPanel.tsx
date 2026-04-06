import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Ban, CheckCircle, Loader2, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Profile {
  user_id: string;
  username: string;
  created_at: string;
  is_blocked: boolean;
}

const AdminPanel: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirm, setConfirm]   = useState<{ type: 'delete' | 'block'; profile: Profile } | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProfiles(data);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleBlock = async (profile: Profile) => {
    setActionId(profile.user_id);
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: !profile.is_blocked })
      .eq('user_id', profile.user_id);
    if (!error) setProfiles(p => p.map(u => u.user_id === profile.user_id ? { ...u, is_blocked: !u.is_blocked } : u));
    setActionId(null);
    setConfirm(null);
  };

  const handleDelete = async (profile: Profile) => {
    setActionId(profile.user_id);
    try {
      // Netlify function me service_role key
      const res = await fetch('/.netlify/functions/admin-delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.user_id }),
      });
      if (res.ok) {
        setProfiles(p => p.filter(u => u.user_id !== profile.user_id));
      } else {
        alert('Gabim gjatë fshirjes.');
      }
    } catch {
      alert('Gabim gjatë fshirjes.');
    }
    setActionId(null);
    setConfirm(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#D81B60] p-2 rounded-xl"><Shield size={22} /></div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Paneli i Administratorit</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{profiles.length} përdorues të regjistruar</p>
          </div>
        </div>
        <button onClick={fetchProfiles} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 size={32} className="animate-spin text-[#D81B60]" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-300">
            <Users size={48} />
            <p className="mt-3 font-bold text-sm uppercase">Asnjë përdorues</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[9px] uppercase font-bold tracking-widest">
                <tr>
                  <th className="px-5 py-4">Përdoruesi</th>
                  <th className="px-5 py-4">Regjistruar</th>
                  <th className="px-5 py-4">Statusi</th>
                  <th className="px-5 py-4 text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map(p => {
                  const isAdmin = p.username === 'arditzgura';
                  const isActing = actionId === p.user_id;
                  return (
                    <tr key={p.user_id} className={`hover:bg-slate-50 transition-colors ${p.is_blocked ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white ${isAdmin ? 'bg-[#D81B60]' : 'bg-slate-700'}`}>
                            {p.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm uppercase">{p.username}</p>
                            {isAdmin && <p className="text-[9px] font-black text-[#D81B60] uppercase tracking-widest">Administrator</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${p.is_blocked ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.is_blocked ? 'Bllokuar' : 'Aktiv'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {!isAdmin && (
                          <div className="flex justify-end gap-1">
                            {isActing ? (
                              <Loader2 size={20} className="animate-spin text-slate-400" />
                            ) : (
                              <>
                                <button onClick={() => setConfirm({ type: 'block', profile: p })}
                                  title={p.is_blocked ? 'Zhblloko' : 'Blloko'}
                                  className={`p-2 rounded-lg transition-all ${p.is_blocked ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}>
                                  {p.is_blocked ? <CheckCircle size={16} /> : <Ban size={16} />}
                                </button>
                                <button onClick={() => setConfirm({ type: 'delete', profile: p })}
                                  title="Fshi"
                                  className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal konfirmimi */}
      {confirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${confirm.type === 'delete' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                <AlertTriangle size={20} className={confirm.type === 'delete' ? 'text-rose-600' : 'text-amber-600'} />
              </div>
              <h3 className="font-black text-slate-900 uppercase text-sm">
                {confirm.type === 'delete' ? 'Fshi Përdoruesin' : confirm.profile.is_blocked ? 'Zhblloko Përdoruesin' : 'Blloko Përdoruesin'}
              </h3>
            </div>
            <p className="text-sm text-slate-600 font-bold mb-6">
              {confirm.type === 'delete'
                ? `Jeni të sigurt që dëshironi të fshini llogarinë e "${confirm.profile.username}"? Ky veprim është i pakthyeshëm.`
                : confirm.profile.is_blocked
                  ? `Zhbllokoni llogarinë e "${confirm.profile.username}"?`
                  : `Bllokoni llogarinë e "${confirm.profile.username}"? Ky përdorues nuk do të mund të hyjë më.`
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-black text-sm uppercase hover:bg-slate-200 transition-all">
                Anulo
              </button>
              <button
                onClick={() => confirm.type === 'delete' ? handleDelete(confirm.profile) : handleBlock(confirm.profile)}
                className={`flex-1 py-2.5 rounded-xl text-white font-black text-sm uppercase transition-all ${confirm.type === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {confirm.type === 'delete' ? 'Fshi' : confirm.profile.is_blocked ? 'Zhblloko' : 'Blloko'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
