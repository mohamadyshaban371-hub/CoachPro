import React from 'react';
import type { MealTemplate } from '../types';

interface MealTemplateManagerProps {
  templates: MealTemplate[];
  onSelect?: (template: MealTemplate) => void;
  onDuplicate?: (template: MealTemplate) => void;
  onDelete?: (templateId: string) => void;
}

export default function MealTemplateManager({ templates, onSelect, onDuplicate, onDelete }: MealTemplateManagerProps) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Meal Templates</h3>
          <p className="text-sm text-slate-400">Reuse successful meal structures across clients.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold text-white">{template.name}</p>
              <span className="text-xs text-slate-400">{template.meals.length} meals</span>
            </div>
            <p className="mb-3 text-sm text-slate-400">{template.description}</p>
            <div className="flex gap-2">
              <button onClick={() => onSelect?.(template)} className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">Use</button>
              <button onClick={() => onDuplicate?.(template)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:text-white">Duplicate</button>
              <button onClick={() => onDelete?.(template.id || '')} className="rounded-xl border border-rose-500/30 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
