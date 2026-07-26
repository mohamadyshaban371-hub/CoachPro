import React, { useState } from 'react';
import useCoachTemplates from '../hooks/useCoachTemplates';
import { Plus, Copy, Trash2 } from 'lucide-react';
import type { WorkoutTemplate } from '../types';

export default function CoachTemplateManager({ coachUid }: { coachUid?: string }) {
  const { templates, saveTemplate, removeTemplate } = useCoachTemplates(coachUid);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);

  const handleCreate = () => {
    const t: WorkoutTemplate = { id: `template-${Date.now()}`, name: 'New Template', category: 'Custom', exercises: [], createdAt: new Date().toISOString() } as any;
    setEditing(t);
  };

  const handleSave = async () => {
    if (!editing) return;
    await saveTemplate(editing);
    setEditing(null);
  };

  const handleDuplicate = async (t: WorkoutTemplate) => {
    const copy = { ...t, id: `${t.id}-copy`, name: `${t.name} Copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await saveTemplate(copy);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Coach Template Manager</h3>
          <p className="text-sm text-slate-400">Create and manage professional workout templates.</p>
        </div>
        <button onClick={handleCreate} className="rounded-xl bg-cyan-600 px-3 py-2 text-sm text-white"><Plus size={14} /></button>
      </div>

      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/10 p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">{t.name}</div>
              <div className="text-xs text-slate-400">{t.category} • {t.exercises?.length || 0} exercises</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(t as any)} className="rounded-xl border px-3 py-2 text-sm text-slate-300"><Copy size={14} /> Edit</button>
              <button onClick={() => handleDuplicate(t)} className="rounded-xl border px-3 py-2 text-sm text-slate-300"><Copy size={14} /></button>
              <button onClick={() => removeTemplate(t.id || '')} className="rounded-xl border px-3 py-2 text-sm text-rose-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="mt-4 rounded-xl border border-white/10 p-4">
          <label className="block text-sm text-slate-300">Name
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white" />
          </label>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white">Save</button>
            <button onClick={() => setEditing(null)} className="rounded-xl border px-3 py-2 text-sm text-slate-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
