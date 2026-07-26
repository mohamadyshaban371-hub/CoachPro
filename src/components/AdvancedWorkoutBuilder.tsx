import React, { useState } from 'react';
import type { ClientWorkout, WorkoutExercise, ExerciseSetDetail } from '../types';
import { Plus, Trash2, Copy, GripVertical, Link2, Circle, ListChecks, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface ExerciseGroup {
  id: string;
  type: 'normal' | 'superset' | 'giant-set' | 'circuit' | 'dropset' | 'rest-pause' | 'cluster' | 'emom' | 'amrap' | 'tabata';
  exercises: WorkoutExercise[];
  notes?: string;
  emomReps?: number;
  amrapDuration?: number;
  tabataDuration?: number;
}

interface AdvancedWorkoutBuilderProps {
  workout: ClientWorkout | null;
  onSave?: (workout: ClientWorkout) => void;
  onDeleteExercise?: (exerciseId: string) => void;
  onDuplicateExercise?: (exercise: WorkoutExercise) => void;
  onReorderExercise?: (fromIndex: number, toIndex: number) => void;
  onAddExercise?: (exercise: WorkoutExercise) => void;
}

const GROUP_TYPES: Array<{ value: ExerciseGroup['type']; label: string; description: string }> = [
  { value: 'normal', label: 'Normal Set', description: 'Standard exercise with rest' },
  { value: 'superset', label: 'Superset', description: '2 exercises back-to-back, minimal rest' },
  { value: 'giant-set', label: 'Giant Set', description: '3-4 exercises back-to-back' },
  { value: 'circuit', label: 'Circuit', description: 'Multiple exercises, multiple rounds' },
  { value: 'dropset', label: 'Drop Set', description: 'Same exercise, decreasing weight' },
  { value: 'rest-pause', label: 'Rest-Pause', description: 'Max reps, rest, more reps' },
  { value: 'cluster', label: 'Cluster Set', description: 'Sets with minimal rest between' },
  { value: 'emom', label: 'EMOM', description: 'Every Minute On The Minute' },
  { value: 'amrap', label: 'AMRAP', description: 'As Many Rounds As Possible' },
  { value: 'tabata', label: 'TABATA', description: '20sec work / 10sec rest' },
];

export default function AdvancedWorkoutBuilder({
  workout,
  onSave,
  onDeleteExercise,
  onDuplicateExercise,
}: AdvancedWorkoutBuilderProps) {
  const [groups, setGroups] = useState<ExerciseGroup[]>(() => {
    if (!workout?.exercises) return [];
    return workout.exercises.map((ex, idx) => ({
      id: `group-${idx}`,
      type: 'normal',
      exercises: [ex],
    }));
  });

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const handleAddGroup = (type: ExerciseGroup['type'] = 'normal') => {
    const newGroup: ExerciseGroup = {
      id: `group-${Date.now()}`,
      type,
      exercises: [],
      notes: '',
    };
    setGroups([...groups, newGroup]);
  };

  const handleChangeGroupType = (groupId: string, newType: ExerciseGroup['type']) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId ? { ...g, type: newType } : g
      )
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleDeleteExerciseFromGroup = (groupId: string, exerciseId: string) => {
    setGroups(
      groups
        .map((g) =>
          g.id === groupId
            ? { ...g, exercises: g.exercises.filter((e) => e.id !== exerciseId) }
            : g
        )
        .filter((g) => g.exercises.length > 0 || g.type !== 'normal')
    );
  };

  const handleSave = () => {
    const allExercises = groups.flatMap((g) => g.exercises);
    if (workout) {
      onSave?.({ ...workout, exercises: allExercises });
    }
  };

  const getGroupIcon = (type: ExerciseGroup['type']) => {
    switch (type) {
      case 'superset':
        return <Link2 className="h-4 w-4" />;
      case 'giant-set':
        return <ListChecks className="h-4 w-4" />;
      case 'circuit':
        return <Circle className="h-4 w-4" />;
      case 'dropset':
      case 'rest-pause':
      case 'cluster':
        return <ArrowRight className="h-4 w-4" />;
      case 'emom':
      case 'amrap':
      case 'tabata':
        return <Zap className="h-4 w-4" />;
      default:
        return <GripVertical className="h-4 w-4" />;
    }
  };

  const getGroupColor = (type: ExerciseGroup['type']) => {
    switch (type) {
      case 'superset':
        return 'border-blue-500/20 bg-blue-500/5';
      case 'giant-set':
        return 'border-purple-500/20 bg-purple-500/5';
      case 'circuit':
        return 'border-cyan-500/20 bg-cyan-500/5';
      case 'dropset':
      case 'rest-pause':
        return 'border-amber-500/20 bg-amber-500/5';
      case 'cluster':
        return 'border-rose-500/20 bg-rose-500/5';
      case 'emom':
      case 'amrap':
      case 'tabata':
        return 'border-emerald-500/20 bg-emerald-500/5';
      default:
        return 'border-white/10 bg-slate-900/30';
    }
  };

  if (!workout) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
        Select or create a workout to start building.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Advanced Workout Builder</h3>
          <p className="mt-1 text-sm text-slate-400">Create complex training programs with supersets, circuits, and more</p>
        </div>
        <button
          onClick={handleSave}
          className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
        >
          Save Workout
        </button>
      </div>

      {/* Group Types Menu */}
      <div className="mb-6 flex flex-wrap gap-2">
        {GROUP_TYPES.map((gt) => (
          <button
            key={gt.value}
            onClick={() => handleAddGroup(gt.value)}
            className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/20 hover:text-white transition"
            title={gt.description}
          >
            + {gt.label}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {groups.map((group, groupIdx) => {
          const groupTypeInfo = GROUP_TYPES.find((gt) => gt.value === group.type);
          return (
            <motion.div
              key={group.id}
              layout
              className={`rounded-2xl border ${getGroupColor(group.type)} p-4`}
            >
              {/* Group Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getGroupIcon(group.type)}
                  <div>
                    <p className="font-semibold text-white capitalize">{group.type.replace('-', ' ')}</p>
                    <p className="text-xs text-slate-400">{groupTypeInfo?.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={group.type}
                    onChange={(e) => handleChangeGroupType(group.id, e.target.value as any)}
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white outline-none"
                  >
                    {GROUP_TYPES.map((gt) => (
                      <option key={gt.value} value={gt.value}>
                        {gt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="rounded-lg border border-white/10 p-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Group Options */}
              {(group.type === 'emom' || group.type === 'amrap' || group.type === 'tabata') && (
                <div className="mb-4 grid gap-2 md:grid-cols-3">
                  {group.type === 'emom' && (
                    <input
                      type="number"
                      placeholder="Reps per minute"
                      value={group.emomReps || ''}
                      onChange={(e) =>
                        setGroups(
                          groups.map((g) =>
                            g.id === group.id ? { ...g, emomReps: parseInt(e.target.value) || 0 } : g
                          )
                        )
                      }
                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white outline-none"
                    />
                  )}
                  {group.type === 'amrap' && (
                    <input
                      type="number"
                      placeholder="Duration (minutes)"
                      value={group.amrapDuration || ''}
                      onChange={(e) =>
                        setGroups(
                          groups.map((g) =>
                            g.id === group.id ? { ...g, amrapDuration: parseInt(e.target.value) || 0 } : g
                          )
                        )
                      }
                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white outline-none"
                    />
                  )}
                  {group.type === 'tabata' && (
                    <input
                      type="number"
                      placeholder="Duration (minutes)"
                      value={group.tabataDuration || ''}
                      onChange={(e) =>
                        setGroups(
                          groups.map((g) =>
                            g.id === group.id ? { ...g, tabataDuration: parseInt(e.target.value) || 0 } : g
                          )
                        )
                      }
                      className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white outline-none"
                    />
                  )}
                </div>
              )}

              {/* Exercises in Group */}
              <div className="space-y-3">
                {group.exercises.map((exercise, exIdx) => (
                  <motion.div
                    key={exercise.id}
                    layout
                    className="rounded-xl border border-white/10 bg-slate-900/50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{exercise.name}</p>
                        <p className="text-xs text-slate-500">{exercise.englishName}</p>
                      </div>
                      <div className="flex gap-1">
                        {onDuplicateExercise && (
                          <button
                            onClick={() => onDuplicateExercise(exercise)}
                            className="rounded-lg border border-white/10 p-1 text-slate-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteExerciseFromGroup(group.id, exercise.id || '')}
                          className="rounded-lg border border-white/10 p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Exercise Details */}
                    <div className="grid gap-2 md:grid-cols-4 text-xs">
                      <div>
                        <p className="text-slate-500">Sets</p>
                        <p className="font-semibold text-white">{exercise.sets}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reps</p>
                        <p className="font-semibold text-white">{exercise.reps}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Weight</p>
                        <p className="font-semibold text-white">{exercise.weight}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Tempo</p>
                        <p className="font-semibold text-white">{exercise.tempo}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Rest</p>
                        <p className="font-semibold text-white">{exercise.rest}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">RPE</p>
                        <p className="font-semibold text-white">{exercise.rpe}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Add Exercise to Group */}
              <button
                onClick={() => {
                  // This would typically open an exercise picker
                  alert('Exercise picker would open here');
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-slate-900/20 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-white/40"
              >
                <Plus className="h-3 w-3" />
                Add Exercise
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Add First Group */}
      {groups.length === 0 && (
        <button
          onClick={() => handleAddGroup('normal')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/10 px-4 py-6 text-sm font-semibold text-cyan-300 hover:border-cyan-500/50"
        >
          <Plus className="h-5 w-5" />
          Create First Exercise Group
        </button>
      )}
    </div>
  );
}
