import React from 'react';
import professionalWorkoutLib from '../lib/professionalWorkout';

export function WarmupPreview({ exercise }: { exercise: any }) {
  const sets = professionalWorkoutLib.buildDefaultWarmup(exercise);
  return (
    <div className="rounded-xl border border-white/10 p-3 text-slate-300">
      <h4 className="font-semibold text-white">Warmup</h4>
      <ul className="list-disc pl-5 text-sm">
        {sets.map((s, i) => <li key={i}>{s.notes || `${s.sets || ''} ${s.reps || ''} ${s.loadPercent || ''}`}</li>)}
      </ul>
    </div>
  );
}

export function CooldownPreview() {
  const items = professionalWorkoutLib.buildDefaultCooldown();
  return (
    <div className="rounded-xl border border-white/10 p-3 text-slate-300">
      <h4 className="font-semibold text-white">Cooldown</h4>
      <ul className="list-disc pl-5 text-sm">
        {items.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}

export default WarmupPreview;
