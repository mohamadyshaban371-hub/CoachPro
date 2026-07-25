import React from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function TimePicker({ label, value, onChange }: TimePickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-500 block text-right pr-1">{label}</label>
      <div className="relative group">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
          <Clock size={18} />
        </div>
        <input 
          type="time" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-800 border border-white/5 rounded-xl p-4 pr-12 text-white outline-none focus:border-blue-500 transition-all font-bold text-center appearance-none"
          style={{ direction: 'ltr' }}
        />
        {/* Helper to show AM/PM more clearly if the value is set */}
        {value && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-500 pointer-events-none">
            {parseInt(value.split(':')[0]) >= 12 ? 'PM' : 'AM'}
          </div>
        )}
      </div>
    </div>
  );
}
