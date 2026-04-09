import React from 'react';
import { Shield } from 'lucide-react';

const AdminPanel: React.FC = () => {

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center gap-3">
        <div className="bg-[#D81B60] p-2 rounded-xl"><Shield size={22} /></div>
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight">Paneli i Administratorit</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sistemi lokal — pa Supabase</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
