import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, CheckCircle2 } from 'lucide-react';
import type { ClientWorkout, WorkoutExercise } from '../types';

interface WorkoutPlannerProps {
  workouts: ClientWorkout[];
  onSelectWorkout?: (workout: ClientWorkout) => void;
  onAddWorkout?: (day: string) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WorkoutPlanner({ workouts, onSelectWorkout, onAddWorkout }: WorkoutPlannerProps) {
  const [selectedDay, setSelectedDay] = useState('Monday');

  const dayWorkouts = useMemo(() => workouts.filter((workout) => workout.day === selectedDay), [selectedDay, workouts]);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Weekly Planner</h3>
          <p className="text-sm text-slate-400">Build multi-workout weekly schedules and assign them to each day.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {DAYS.map((day) => (
          <button key={day} onClick={() => setSelectedDay(day)} className={`rounded-full px-3 py-2 text-sm font-semibold transition ${selectedDay === day ? 'bg-cyan-600 text-white' : 'bg-slate-950/60 text-slate-400'}`}>
            {day}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {dayWorkouts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
            No workouts scheduled for this day yet.
          </div>
        )}
        {dayWorkouts.map((workout) => (
          <button key={workout.id} onClick={() => onSelectWorkout?.(workout)} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{workout.title}</p>
                <p className="text-sm text-slate-400">{workout.exercises?.length || 0} exercises • {workout.completionPercent || 0}% complete</p>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">{workout.completed ? 'Done' : 'Active'}</div>
            </div>
          </button>
        ))}
        <button onClick={() => onAddWorkout?.(selectedDay)} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/10 px-3 py-3 text-sm font-semibold text-cyan-300">
          <Plus size={16} /> Add workout to {selectedDay}
        </button>
      </div>
    </div>
  );
}
