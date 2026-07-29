import React, { useEffect, useState } from 'react';
import { Shield, Users, RefreshCw, FileText, Clock } from 'lucide-react';
import { cloudGetAllUsers, CLOUD_ENABLED } from '../utils/cloudSync';

interface UserRow { username: string; invoiceCount: number; lastSync: string; }

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await cloudGetAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('sq-AL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center gap-3">
        <div className="bg-[#D81B60] p-2 rounded-xl"><Shield size={22} /></div>
        <div className="flex-1">
          <h2 className="text-lg font-black uppercase tracking-tight">Paneli i Administratorit</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Firebase RTDB — Përdoruesit e regjistruar</p>
        </div>
        <button onClick={fetchUsers} disabled={loading}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Rifresko
        </button>
      </div>

      {!CLOUD_ENABLED && (
        <div className="bg-red-950 border border-red-800 text-red-300 p-4 rounded-2xl text-sm font-bold">
          Cloud jo aktiv — nuk mund të ngarkohen përdoruesit.
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Users size={18} className="text-[#D81B60]" />
          <span className="font-black text-slate-800 uppercase tracking-tight text-sm">
            Përdoruesit ({users.length})
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm font-bold">
            Nuk u gjet asnjë përdorues në cloud.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {users.map(u => (
              <div key={u.username} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-[#D81B60]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#D81B60] font-black text-sm uppercase">{u.username.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm">{u.username}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                      <FileText size={10} /> {u.invoiceCount} fatura
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                      <Clock size={10} /> {formatDate(u.lastSync)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  Aktiv
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
