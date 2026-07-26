import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Sparkles, CheckCircle2, GripVertical } from 'lucide-react';
import type { ClientWorkout, WorkoutExercise } from '../types';
import { createWorkoutExercise, DEFAULT_EXERCISE_LIBRARY } from '../lib/workoutBuilder';

interface WorkoutBuilderProps {
  workout: ClientWorkout | null;
  onSave?: (workout: ClientWorkout) => void;
  onDeleteExercise?: (exerciseId: string) => void;
  onDuplicateExercise?: (exercise: WorkoutExercise) => void;
  onReorderExercise?: (fromIndex: number, toIndex: number) => void;
  onAddExercise?: (exercise: WorkoutExercise) => void;
  onGenerateWithAI?: () => void;
}

export default function WorkoutBuilder({ workout, onSave, onDeleteExercise, onDuplicateExercise, onReorderExercise, onAddExercise, onGenerateWithAI }: WorkoutBuilderProps) {
  const [draft, setDraft] = useState<ClientWorkout | null>(workout);

  useEffect(() => {
    setDraft(workout);
  }, [workout]);

  if (!draft) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-8 text-sm text-slate-400">
        Select or create a workout to start building.
      </div>
    );
  }

  const handleExerciseChange = (exerciseId: string, field: keyof WorkoutExercise, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        exercises: current.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise)),
      };
    });
  };

  const handleSave = () => {
    if (draft) {
      onSave?.(draft);
    }
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Workout Builder</h3>
          <p className="text-sm text-slate-400">Drag, reorder, duplicate, and tune exercises for each client workout.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onGenerateWithAI?.()} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
            <Sparkles size={14} /> Generate with AI
          </button>
          <button onClick={handleSave} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">Save workout</button>
        </div>
      </div>

      <div className="space-y-4">
        {draft.exercises?.map((exercise, index) => (
          <div key={exercise.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{exercise.name}</p>
                <p className="text-xs text-slate-400">{exercise.arabicName || exercise.englishName || exercise.name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onReorderExercise?.(index, index - 1)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:text-white"><ArrowUp size={14} /></button>
                <button onClick={() => onReorderExercise?.(index, index + 1)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:text-white"><ArrowDown size={14} /></button>
                <button onClick={() => onDuplicateExercise?.(exercise)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:text-white"><Copy size={14} /></button>
                <button onClick={() => onDeleteExercise?.(exercise.id || '')} className="rounded-xl border border-white/10 p-2 text-rose-400 hover:text-rose-300"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Sets</span>
                <input value={exercise.sets || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'sets', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Reps</span>
                <input value={exercise.reps || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'reps', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Weight</span>
                <input value={exercise.weight || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'weight', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Tempo</span>
                <input value={exercise.tempo || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'tempo', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Rest</span>
                <input value={exercise.rest || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'rest', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">RPE</span>
                <input value={exercise.rpe || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'rpe', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="md:col-span-2 xl:col-span-4 text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Notes</span>
                <textarea value={exercise.notes || ''} onChange={(event) => handleExerciseChange(exercise.id || '', 'notes', event.target.value)} className="min-h-[90px] w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
            </div>
          </div>
        ))}

        <button onClick={() => onAddExercise?.(createWorkoutExercise(DEFAULT_EXERCISE_LIBRARY[0]))} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/10 px-3 py-3 text-sm font-semibold text-cyan-300">
          <Plus size={16} /> Add exercise
        </button>
      </div>
    </div>
  );
}
