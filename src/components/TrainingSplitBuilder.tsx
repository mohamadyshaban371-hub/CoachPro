import React from 'react';
import type { SplitType } from '../types';

const SPLITS: SplitType[] = ['Push Pull Legs','Upper Lower','Body Part Split','Full Body','Bro Split','Powerbuilding','Powerlifting','Olympic Weightlifting','CrossFit','Functional','Calisthenics','Hybrid Athlete','Strongman','Custom'];

export default function TrainingSplitBuilder({ value, onChange }: { value?: SplitType; onChange?: (s: SplitType) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <h3 className="text-lg font-semibold text-white">Training Split Builder</h3>
      <p className="text-sm text-slate-400 mb-3">Pick a training split or create a custom split.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {SPLITS.map((s) => (
          <button key={s} onClick={() => onChange?.(s)} className={`rounded-xl border px-3 py-2 text-sm ${value===s? 'bg-cyan-600 text-white':'bg-slate-900/40 text-slate-300'}`}>{s}</button>
        ))}
      </div>
    </div>
  );
}
