import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Copy, Trash2, ChevronUp, ChevronDown, Clipboard, ClipboardPaste } from 'lucide-react';
import type { ExerciseSetDetail } from '../types';

// Helper: calculate tonnage (volume) from a single set
function calculateSetVolume(set: ExerciseSetDetail): number {
  const weight = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight;
  const reps = typeof set.reps === 'string' ? parseFloat(set.reps) : parseFloat(set.reps || '0');
  const sets = typeof set.sets === 'string' ? parseFloat(set.sets) : parseFloat(set.sets || '1');
  if (!weight || !reps || !sets) return 0;
  return weight * reps * sets;
}

// Helper: estimate 1RM using Brzycki formula
function estimateOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return (weight * 36) / (37 - reps);
}

// Helper: calculate average RPE from all sets
function calculateAvgRPE(sets: ExerciseSetDetail[]): number {
  const rpeValues = sets.map(s => parseFloat(s.rpe || '0')).filter(r => r > 0);
  if (!rpeValues.length) return 0;
  return rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
}

// Helper: calculate average intensity %
function calculateAvgIntensity(sets: ExerciseSetDetail[]): number {
  const intensities = sets.map(s => parseFloat(s.loadPercent || '0')).filter(i => i > 0);
  if (!intensities.length) return 0;
  return intensities.reduce((a, b) => a + b, 0) / intensities.length;
}

// Helper: calculate total rest time in seconds
function calculateTotalRest(sets: ExerciseSetDetail[]): number {
  return sets.reduce((total, set) => {
    const match = (set.rest || '0').match(/(\d+)/);
    const seconds = match ? parseInt(match[1]) * 60 : 0;
    return total + seconds;
  }, 0);
}

// Helper: estimate total workout time (volume + rest)
function estimateWorkoutTime(sets: ExerciseSetDetail[], setDurationSeconds: number = 30): number {
  const totalSets = sets.reduce((sum, s) => sum + (parseInt(s.sets || '1') || 1), 0);
  const workTime = totalSets * setDurationSeconds;
  const restTime = calculateTotalRest(sets);
  return workTime + restTime;
}

interface AdvancedSetEditorProps {
  exerciseName: string;
  sets: ExerciseSetDetail[];
  onChange: (sets: ExerciseSetDetail[]) => void;
  onSave?: () => void;
}

export default function AdvancedSetEditor({ exerciseName, sets, onChange, onSave }: AdvancedSetEditorProps) {
  const [clipboard, setClipboard] = useState<ExerciseSetDetail | null>(null);

  const addSet = useCallback(() => {
    const newSet: ExerciseSetDetail = {
      id: `set-${Date.now()}`,
      sets: '3',
      reps: '10',
      weight: '',
      tempo: '2-0-2-0',
      rest: '90s',
    };
    onChange([...sets, newSet]);
  }, [sets, onChange]);

  const duplicateSet = useCallback((index: number) => {
    const set = sets[index];
    const copy: ExerciseSetDetail = {
      ...set,
      id: `set-${Date.now()}`,
    };
    const newSets = [...sets];
    newSets.splice(index + 1, 0, copy);
    onChange(newSets);
  }, [sets, onChange]);

  const deleteSet = useCallback((index: number) => {
    const newSets = sets.filter((_, i) => i !== index);
    onChange(newSets);
  }, [sets, onChange]);

  const moveSetUp = useCallback((index: number) => {
    if (index === 0) return;
    const newSets = [...sets];
    [newSets[index - 1], newSets[index]] = [newSets[index], newSets[index - 1]];
    onChange(newSets);
  }, [sets, onChange]);

  const moveSetDown = useCallback((index: number) => {
    if (index === sets.length - 1) return;
    const newSets = [...sets];
    [newSets[index], newSets[index + 1]] = [newSets[index + 1], newSets[index]];
    onChange(newSets);
  }, [sets, onChange]);

  const copySet = useCallback((index: number) => {
    setClipboard(sets[index]);
  }, [sets]);

  const pasteSet = useCallback(() => {
    if (!clipboard) return;
    const copy: ExerciseSetDetail = {
      ...clipboard,
      id: `set-${Date.now()}`,
    };
    onChange([...sets, copy]);
  }, [clipboard, sets, onChange]);

  const updateSet = useCallback((index: number, field: keyof ExerciseSetDetail, value: any) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    onChange(newSets);
  }, [sets, onChange]);

  const metrics = useMemo(() => {
    const totalVolume = sets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
    const avgRPE = calculateAvgRPE(sets);
    const avgIntensity = calculateAvgIntensity(sets);
    const totalRest = calculateTotalRest(sets);
    const estimatedTime = estimateWorkoutTime(sets);

    const lastValidWeight = sets
      .reverse()
      .find(s => s.weight && parseFloat(String(s.weight)) > 0)?.weight;
    const lastValidReps = sets.reverse().find(s => s.reps && parseFloat(s.reps) > 0)?.reps;
    const estimated1RM =
      lastValidWeight && lastValidReps
        ? estimateOneRM(parseFloat(String(lastValidWeight)), parseFloat(lastValidReps))
        : 0;

    return {
      totalVolume: Math.round(totalVolume),
      avgRPE: avgRPE.toFixed(1),
      avgIntensity: avgIntensity.toFixed(0),
      totalRest: `${Math.round(totalRest / 60)}m`,
      estimatedTime: `${Math.round(estimatedTime / 60)}m`,
      estimated1RM: estimated1RM.toFixed(1),
    };
  }, [sets]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-6">
      {/* Metrics Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-xs text-slate-400">Volume</div>
          <div className="text-lg font-bold text-white">{metrics.totalVolume} kg</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-xs text-slate-400">Avg RPE</div>
          <div className="text-lg font-bold text-white">{metrics.avgRPE}</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-xs text-slate-400">Avg Intensity</div>
          <div className="text-lg font-bold text-white">{metrics.avgIntensity}%</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-xs text-slate-400">Est. 1RM</div>
          <div className="text-lg font-bold text-white">{metrics.estimated1RM} kg</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-xs text-slate-400">Rest</div>
          <div className="text-lg font-bold text-white">{metrics.totalRest}</div>
        </div>
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-xs text-slate-400">Workout Time</div>
          <div className="text-lg font-bold text-white">{metrics.estimatedTime}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={addSet}
          className="rounded-lg bg-cyan-600 hover:bg-cyan-700 px-3 py-2 text-sm text-white flex items-center gap-2"
        >
          <Plus size={14} /> Add Set
        </button>
        <button
          onClick={pasteSet}
          disabled={!clipboard}
          className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 text-sm text-white flex items-center gap-2"
        >
          <ClipboardPaste size={14} /> Paste Set
        </button>
        {onSave && (
          <button
            onClick={onSave}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm text-white"
          >
            Save to Firestore
          </button>
        )}
      </div>

      {/* Sets List */}
      <div className="space-y-3">
        {sets.map((set, idx) => (
          <div
            key={set.id || idx}
            className="rounded-xl border border-white/10 bg-slate-950/50 p-4 space-y-4"
          >
            {/* Set Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Set {idx + 1}</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => moveSetUp(idx)}
                  disabled={idx === 0}
                  className="p-1 hover:bg-white/10 disabled:opacity-30 rounded"
                  title="Move up"
                >
                  <ChevronUp size={14} className="text-slate-300" />
                </button>
                <button
                  onClick={() => moveSetDown(idx)}
                  disabled={idx === sets.length - 1}
                  className="p-1 hover:bg-white/10 disabled:opacity-30 rounded"
                  title="Move down"
                >
                  <ChevronDown size={14} className="text-slate-300" />
                </button>
                <button
                  onClick={() => copySet(idx)}
                  className="p-1 hover:bg-white/10 rounded"
                  title="Copy to clipboard"
                >
                  <Clipboard size={14} className="text-slate-300" />
                </button>
                <button
                  onClick={() => duplicateSet(idx)}
                  className="p-1 hover:bg-white/10 rounded"
                  title="Duplicate set"
                >
                  <Copy size={14} className="text-slate-300" />
                </button>
                <button
                  onClick={() => deleteSet(idx)}
                  className="p-1 hover:bg-rose-500/20 rounded"
                  title="Delete set"
                >
                  <Trash2 size={14} className="text-rose-400" />
                </button>
              </div>
            </div>

            {/* Core Fields - Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Sets</span>
                <input
                  type="text"
                  value={set.sets || ''}
                  onChange={(e) => updateSet(idx, 'sets', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="3"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Reps</span>
                <input
                  type="text"
                  value={set.reps || ''}
                  onChange={(e) => updateSet(idx, 'reps', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="10"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Target Reps</span>
                <input
                  type="text"
                  value={set.targetReps || ''}
                  onChange={(e) => updateSet(idx, 'targetReps', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="8-12"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Weight (kg)</span>
                <input
                  type="number"
                  value={set.weight || ''}
                  onChange={(e) => updateSet(idx, 'weight', e.target.value ? parseFloat(e.target.value) : '')}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="100"
                />
              </label>
            </div>

            {/* Advanced Fields - Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Tempo</span>
                <input
                  type="text"
                  value={set.tempo || ''}
                  onChange={(e) => updateSet(idx, 'tempo', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="2-0-2-0"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Rest (60s)</span>
                <input
                  type="text"
                  value={set.rest || ''}
                  onChange={(e) => updateSet(idx, 'rest', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="90s"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">RPE (1-10)</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={set.rpe || ''}
                  onChange={(e) => updateSet(idx, 'rpe', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="8"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">RIR</span>
                <input
                  type="text"
                  value={set.rir || ''}
                  onChange={(e) => updateSet(idx, 'rir', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="2"
                />
              </label>
            </div>

            {/* More Advanced Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Intensity %</span>
                <input
                  type="number"
                  value={set.loadPercent || ''}
                  onChange={(e) => updateSet(idx, 'loadPercent', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="75"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Time Under Tension</span>
                <input
                  type="text"
                  value={set.timeUnderTension || ''}
                  onChange={(e) => updateSet(idx, 'timeUnderTension', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                  placeholder="40s"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400 mb-1">Execution Speed</span>
                <select
                  value={set.executionSpeed || 'moderate'}
                  onChange={(e) => updateSet(idx, 'executionSpeed', e.target.value)}
                  className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm"
                >
                  <option value="slow">Slow</option>
                  <option value="moderate">Moderate</option>
                  <option value="explosive">Explosive</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>

            {/* Set Type Toggles */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Set Type</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'isWarmupSet', label: 'Warmup' },
                  { key: 'isDropSet', label: 'Drop Set' },
                  { key: 'isRestPause', label: 'Rest Pause' },
                  { key: 'isClusterSet', label: 'Cluster' },
                  { key: 'isMyoReps', label: 'Myo Reps' },
                  { key: 'isFailure', label: 'To Failure' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => updateSet(idx, item.key as any, !(set as any)[item.key])}
                    className={`px-2 py-1 text-xs rounded-lg border ${
                      (set as any)[item.key]
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <label className="flex flex-col">
              <span className="text-xs text-slate-400 mb-1">Notes</span>
              <textarea
                value={set.notes || ''}
                onChange={(e) => updateSet(idx, 'notes', e.target.value)}
                className="rounded-lg bg-slate-900/60 border border-white/10 text-white px-2 py-1 text-sm resize-none h-12"
                placeholder="Add execution notes..."
              />
            </label>
          </div>
        ))}

        {sets.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <p>No sets yet. Click "Add Set" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
