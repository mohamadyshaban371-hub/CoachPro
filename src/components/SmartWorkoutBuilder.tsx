import React, { useState } from 'react';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import useProfessionalWorkout from '../hooks/useProfessionalWorkout';
import { saveProfessionalWorkout } from '../services/professionalExercises';
import { auth } from '../firebase';

export default function SmartWorkoutBuilder() {
  const { workout, addExercise, updateExerciseDetail, AVAILABLE_PRO_EXERCISES, setWorkout } = useProfessionalWorkout();
  const [selectedExercise, setSelectedExercise] = useState('');

  const coachUid = auth?.currentUser?.uid;

  const persist = async (nextWorkout: any) => {
    try {
      if (!coachUid) return;
      await saveProfessionalWorkout(coachUid, nextWorkout);
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Smart Workout Builder</h3>
          <p className="text-sm text-slate-400">Advanced set schemes, supersets, and progression-ready builder.</p>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <select value={selectedExercise} onChange={(e)=>setSelectedExercise(e.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <option value="">Add exercise…</option>
          {AVAILABLE_PRO_EXERCISES.map((ex) => <option key={ex.id} value={ex.id}>{ex.name} — {ex.muscleGroup}</option>)}
        </select>
        <button onClick={() => { if (selectedExercise) { addExercise(selectedExercise); setSelectedExercise(''); } }} className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={14} /></button>
      </div>

      <div className="space-y-4">
        {workout.exercises.map((ex, idx) => (
          <div key={ex.id} draggable onDragStart={(e)=> e.dataTransfer.setData('text/plain', String(idx))} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
            const from = Number(e.dataTransfer.getData('text/plain'));
            const to = idx;
            if (from === to) return;
            const next = { ...workout, exercises: [...workout.exercises] };
            const [moved] = next.exercises.splice(from, 1);
            next.exercises.splice(to, 0, moved);
            setWorkout(next);
            persist(next);
          }} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{ex.name}</p>
                <p className="text-xs text-slate-400">{ex.muscleGroup}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl border border-white/10 p-2 text-slate-300"><ArrowUp size={14} /></button>
                <button className="rounded-xl border border-white/10 p-2 text-slate-300"><ArrowDown size={14} /></button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {(ex.details || []).map((d, i) => (
                <div key={i} className="text-sm text-slate-300">
                  <div className="mb-2">Sets: {d.sets || '—'} • Reps: {d.reps || '—'}</div>
                  <div className="mb-2">Tempo: {d.tempo || '—'} • Rest: {d.rest || '—'}</div>
                  <div className="text-xs text-slate-400">RPE: {d.rpe || '—'} • RIR: {d.rir || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
