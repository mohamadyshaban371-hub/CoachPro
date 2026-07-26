import React, { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Trash2, Sparkles } from 'lucide-react';
import type { WorkoutTemplate } from '../types';
import { WORKOUT_TEMPLATE_CATEGORIES } from '../lib/workoutBuilder';

interface WorkoutTemplateManagerProps {
  templates: WorkoutTemplate[];
  onCreateTemplate?: (name: string, category: WorkoutTemplate['category']) => void;
  onEditTemplate?: (template: WorkoutTemplate) => void;
  onDuplicateTemplate?: (template: WorkoutTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onAssignTemplate?: (template: WorkoutTemplate) => void;
}

export default function WorkoutTemplateManager({ templates, onCreateTemplate, onEditTemplate, onDuplicateTemplate, onDeleteTemplate, onAssignTemplate }: WorkoutTemplateManagerProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorkoutTemplate['category']>('Custom');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateTemplate?.(name.trim(), category);
    setName('');
    setCategory('Custom');
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Workout Templates</h3>
          <p className="text-sm text-slate-400">Create, edit, duplicate, and assign reusable training templates.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none" placeholder="Template name" />
        <select value={category} onChange={(event) => setCategory(event.target.value as WorkoutTemplate['category'])} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          {WORKOUT_TEMPLATE_CATEGORIES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button onClick={handleCreate} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
          <Plus size={16} /> Create
        </button>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{template.name}</p>
                <p className="text-sm text-slate-400">{template.category} • {template.exercises?.length || 0} exercises</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEditTemplate?.(template)} className="rounded-xl border border-white/10 p-2 text-slate-300 transition hover:text-white"><Pencil size={14} /></button>
                <button onClick={() => onDuplicateTemplate?.(template)} className="rounded-xl border border-white/10 p-2 text-slate-300 transition hover:text-white"><Copy size={14} /></button>
                <button onClick={() => onDeleteTemplate?.(template.id || '')} className="rounded-xl border border-white/10 p-2 text-rose-400 transition hover:text-rose-300"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onAssignTemplate?.(template)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">Assign to client</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
