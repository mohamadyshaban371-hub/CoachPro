import React, { useState } from 'react';
import { Search, Star } from 'lucide-react';
import useProfessionalExercises from '../hooks/useProfessionalExercises';
import ExerciseDetails from './ExerciseDetails';

export default function ProfessionalExerciseLibrary() {
  const { exercises, loading, query, setQuery, filters, setFilters, favorites, toggleFavorite } = useProfessionalExercises();
  const [active, setActive] = useState<string | null>(null);

  const open = (id?: string) => setActive(id || null);
  const activeExercise = exercises.find((e) => e.id === active) || null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Professional Exercise Library</h3>
          <p className="text-sm text-slate-400">Search, filter and explore detailed professional exercises.</p>
        </div>
        <div className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">{exercises.length} items</div>
      </div>

      <div className="mb-4 flex gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none" placeholder="Search exercises (Arabic/English)" />
        </label>
        <select value={filters.category || ''} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <option value="">All categories</option>
          <option value="Strength">Strength</option>
          <option value="Hypertrophy">Hypertrophy</option>
          <option value="Powerlifting">Powerlifting</option>
          <option value="Olympic Lifting">Olympic Lifting</option>
          <option value="CrossFit">CrossFit</option>
          <option value="Functional Training">Functional Training</option>
          <option value="Bodybuilding">Bodybuilding</option>
          <option value="Calisthenics">Calisthenics</option>
          <option value="Mobility">Mobility</option>
          <option value="Rehabilitation">Rehabilitation</option>
          <option value="Cardio">Cardio</option>
          <option value="HIIT">HIIT</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {loading ? <div className="text-slate-400">Loading…</div> : exercises.map((ex) => {
          const isFav = favorites.includes(ex.id);
          return (
            <div key={ex.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{ex.name}</p>
                  <p className="text-xs text-slate-400">{ex.arabicName}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFavorite(ex.id)} className={`rounded-full p-2 ${isFav ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'}`}>
                    <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-white/10 px-2 py-1">{ex.muscleGroup}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{ex.equipment}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{ex.difficulty}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{ex.category}</span>
              </div>
              <p className="mb-3 text-sm text-slate-300">{ex.instructions?.slice(0, 120) || ''}{ex.instructions && ex.instructions.length > 120 ? '…' : ''}</p>
              <div className="flex gap-2">
                <button onClick={() => open(ex.id)} className="flex-1 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">Details</button>
              </div>
            </div>
          );
        })}
      </div>

      <ExerciseDetails exercise={activeExercise} onClose={() => setActive(null)} />
    </div>
  );
}
