import React, { useState } from 'react';
import type { PeriodizationBlock } from '../types';
import { Calendar, Plus, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';

interface PeriodizationEditorProps {
  blocks?: PeriodizationBlock[];
  onChange?: (b: PeriodizationBlock[]) => void;
  compact?: boolean;
}

const FOCUS_TYPES = ['meso', 'micro', 'macro'] as const;
const PROGRESSION_STRATEGIES = ['linear', 'undulating', 'block', 'conjugate'] as const;

export default function PeriodizationEditor({ blocks: initialBlocks, onChange, compact = false }: PeriodizationEditorProps) {
  const [local, setLocal] = useState<PeriodizationBlock[]>(initialBlocks || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<Partial<PeriodizationBlock>>({});

  const totalWeeks = local.reduce((sum, b) => sum + (b.weeks || 0), 0);

  const handleAddBlock = () => {
    const next: PeriodizationBlock = {
      id: `block-${Date.now()}`,
      name: 'New Phase',
      type: 'meso',
      weeks: 4,
      intensityRange: { from: 60, to: 75 },
      volumeMultiplier: 1,
      progressionStrategy: 'linear',
    };
    const updated = [...local, next];
    setLocal(updated);
    onChange?.(updated);
  };

  const handleEditBlock = (block: PeriodizationBlock) => {
    setEditingId(block.id);
    setEditingBlock({ ...block });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;

    const updated = local.map((b) =>
      b.id === editingId
        ? {
            ...b,
            name: editingBlock.name || b.name,
            type: editingBlock.type || b.type,
            weeks: editingBlock.weeks || b.weeks,
            intensityRange: editingBlock.intensityRange || b.intensityRange,
            volumeMultiplier: editingBlock.volumeMultiplier || b.volumeMultiplier,
            progressionStrategy: editingBlock.progressionStrategy || b.progressionStrategy,
          }
        : b
    );
    setLocal(updated);
    onChange?.(updated);
    setEditingId(null);
    setEditingBlock({});
  };

  const handleDeleteBlock = (id: string) => {
    const updated = local.filter((b) => b.id !== id);
    setLocal(updated);
    onChange?.(updated);
  };

  if (compact) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white text-sm">
          <Calendar className="h-4 w-4" />
          Periodization ({totalWeeks} weeks)
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {local.map((block) => (
            <div key={block.id} className="flex items-center justify-between rounded-lg bg-slate-900/30 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{block.name}</p>
                <p className="text-xs text-slate-500">{block.weeks} weeks • {block.type}</p>
              </div>
              <p className="text-xs font-semibold text-cyan-400 ml-2">{(block.volumeMultiplier * 100).toFixed(0)}%</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Calendar className="h-6 w-6 text-purple-400" />
            Periodization Editor
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Design your training blocks • Total: {totalWeeks} weeks
          </p>
        </div>
      </div>

      {/* Blocks List */}
      <div className="mb-6 space-y-3">
        {local.map((block) => (
          <motion.div
            key={block.id}
            layout
            className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
          >
            {editingId === block.id ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Name</span>
                  <input
                    type="text"
                    value={editingBlock.name || ''}
                    onChange={(e) => setEditingBlock({ ...editingBlock, name: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Block Type</span>
                    <select
                      value={editingBlock.type || 'meso'}
                      onChange={(e) => setEditingBlock({ ...editingBlock, type: e.target.value as any })}
                      className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                    >
                      {FOCUS_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}cycle
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Duration (weeks)</span>
                    <input
                      type="number"
                      min="1"
                      value={editingBlock.weeks || 4}
                      onChange={(e) => setEditingBlock({ ...editingBlock, weeks: parseInt(e.target.value) })}
                      className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Min Intensity %</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingBlock.intensityRange?.from || 60}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          intensityRange: { from: parseInt(e.target.value), to: editingBlock.intensityRange?.to || 75 },
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Max Intensity %</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingBlock.intensityRange?.to || 75}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          intensityRange: { from: editingBlock.intensityRange?.from || 60, to: parseInt(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Volume Multiplier</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2"
                      value={editingBlock.volumeMultiplier || 1}
                      onChange={(e) => setEditingBlock({ ...editingBlock, volumeMultiplier: parseFloat(e.target.value) })}
                      className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Progression Strategy</span>
                    <select
                      value={editingBlock.progressionStrategy || 'linear'}
                      onChange={(e) => setEditingBlock({ ...editingBlock, progressionStrategy: e.target.value as any })}
                      className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none"
                    >
                      {PROGRESSION_STRATEGIES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{block.name}</h3>
                  <div className="mt-2 grid gap-2 text-sm">
                    <p className="text-slate-400">
                      <span className="font-medium text-slate-300">Type:</span> {block.type}cycle
                    </p>
                    <p className="text-slate-400">
                      <span className="font-medium text-slate-300">Duration:</span> {block.weeks} weeks
                    </p>
                    <p className="text-slate-400">
                      <span className="font-medium text-slate-300">Intensity Range:</span> {block.intensityRange?.from}% - {block.intensityRange?.to}%
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 w-24 rounded-full bg-slate-900">
                        <div
                          className="h-full rounded-full bg-cyan-500"
                          style={{ width: `${(block.volumeMultiplier || 1) * 50}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-cyan-400">{((block.volumeMultiplier || 1) * 100).toFixed(0)}% Vol</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditBlock(block)}
                    className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="rounded-lg border border-white/10 p-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Add Block Button */}
      <button
        onClick={handleAddBlock}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/25 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-300 hover:border-cyan-500/50"
      >
        <Plus className="h-4 w-4" />
        Add Training Phase
      </button>
    </div>
  );
}
