import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const MUAJT = [
  { v: '01', l: 'Janar' }, { v: '02', l: 'Shkurt' }, { v: '03', l: 'Mars' },
  { v: '04', l: 'Prill' }, { v: '05', l: 'Maj' },    { v: '06', l: 'Qershor' },
  { v: '07', l: 'Korrik' }, { v: '08', l: 'Gusht' }, { v: '09', l: 'Shtator' },
  { v: '10', l: 'Tetor' }, { v: '11', l: 'Nëntor' }, { v: '12', l: 'Dhjetor' },
];

interface Props {
  value: string; // YYYY-MM
  onChange: (v: string) => void;
  className?: string;
}

export default function MonthPicker({ value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [year, month] = value.split('-');
  const muaji = MUAJT.find(m => m.v === month);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setMonth = (mv: string) => { onChange(`${year}-${mv}`); setOpen(false); };
  const currentYear = new Date().getFullYear().toString();
  const setYear = (y: string) => { if (/^\d{0,4}$/.test(y)) onChange(`${y || currentYear}-${month}`); };

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
      >
        <span>{muaji?.l || month}</span>
        <input
          type="number"
          value={year}
          onChange={e => setYear(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="bg-transparent border-none outline-none w-[3.2rem] font-black text-[10px] uppercase cursor-text"
          min="2000" max="2099"
        />
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 grid grid-cols-3 gap-1 w-48">
          {MUAJT.map(m => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMonth(m.v)}
              className={`px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${
                m.v === month
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              {m.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
