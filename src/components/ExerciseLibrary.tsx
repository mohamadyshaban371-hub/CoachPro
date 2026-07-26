import React, { useMemo, useState } from 'react';
import { Search, Star, Dumbbell, Sparkles } from 'lucide-react';
import type { WorkoutExercise } from '../types';
import { DEFAULT_EXERCISE_LIBRARY } from '../lib/workoutBuilder';

interface ExerciseLibraryProps {
  exercises?: WorkoutExercise[];
  favorites?: string[];
  onAddExercise?: (exercise: WorkoutExercise) => void;
  onToggleFavorite?: (exerciseId: string) => void;
}

export default function ExerciseLibrary({ exercises = DEFAULT_EXERCISE_LIBRARY, favorites = [], onAddExercise, onToggleFavorite }: ExerciseLibraryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    return exercises.filter((exercise) => {
      const haystack = `${exercise.name} ${exercise.arabicName || ''} ${exercise.englishName || ''} ${exercise.tags?.join(' ') || ''}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesFilter = filter === 'All' || exercise.muscleGroup === filter || exercise.tags?.includes(filter.toLowerCase());
      return matchesQuery && matchesFilter;
    });
  }, [exercises, filter, query]);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Exercise Library</h3>
          <p className="text-sm text-slate-400">Search, filter, and favorite exercises for fast coaching.</p>
        </div>
        <div className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">{filtered.length} items</div>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Search exercises" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <option value="All">All</option>
          <option value="Chest">Chest</option>
          <option value="Back">Back</option>
          <option value="Legs">Legs</option>
          <option value="Shoulders">Shoulders</option>
          <option value="Posterior Chain">Posterior Chain</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((exercise) => {
          const isFavorite = favorites.includes(exercise.id || '');
          return (
            <div key={exercise.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{exercise.name}</p>
                  <p className="text-xs text-slate-400">{exercise.arabicName || exercise.englishName || exercise.name}</p>
                </div>
                <button onClick={() => onToggleFavorite?.(exercise.id || '')} className={`rounded-full p-2 ${isFavorite ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'}`}>
                  <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-white/10 px-2 py-1">{exercise.muscleGroup}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{exercise.equipment}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{exercise.difficulty}</span>
              </div>
              <p className="mb-3 text-sm text-slate-300">{exercise.instructions}</p>
              <button onClick={() => onAddExercise?.(exercise)} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
                <Dumbbell size={14} /> Add to builder
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
