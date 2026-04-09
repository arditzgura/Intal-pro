import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<Props> = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
      <div className="flex items-start gap-4 mb-5">
        <div className="bg-rose-100 p-2.5 rounded-xl shrink-0">
          <AlertTriangle size={22} className="text-rose-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-slate-900 text-base">{title}</h3>
          <p className="text-slate-500 text-sm mt-1">{message}</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all">
          Anulo
        </button>
        <button onClick={() => { onConfirm(); onCancel(); }}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition-all shadow-lg shadow-rose-200">
          Fshi
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
