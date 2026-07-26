import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import type { ClientMealPlan, MealPlanEntry, NutritionFood } from '../types';
import { createEmptyMealEntry } from '../lib/mealBuilder';

interface MealBuilderProps {
  plan: ClientMealPlan | null;
  onSave?: (plan: ClientMealPlan) => void;
  onAddFood?: (mealId: string, food: NutritionFood) => void;
  onGenerateWithAI?: () => void;
}

export default function MealBuilder({ plan, onSave, onAddFood, onGenerateWithAI }: MealBuilderProps) {
  const [draft, setDraft] = useState<ClientMealPlan | null>(plan);

  useEffect(() => {
    setDraft(plan);
  }, [plan]);

  if (!draft) return <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">Select or create a meal plan to start building.</div>;

  const updateMealField = (mealId: string, field: keyof MealPlanEntry, value: string | number | boolean) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, meals: current.meals.map((meal) => meal.id === mealId ? { ...meal, [field]: value } : meal) };
    });
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Meal Builder</h3>
          <p className="text-sm text-slate-400">Construct daily meals, calculate macros automatically, and generate with AI.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onGenerateWithAI?.()} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
            <Sparkles size={14} /> AI Generate
          </button>
          <button onClick={() => draft && onSave?.(draft)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">Save plan</button>
        </div>
      </div>

      <div className="space-y-4">
        {draft.meals.map((meal) => (
          <div key={meal.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{meal.type}</p>
                <p className="text-xs text-slate-400">{meal.name}</p>
              </div>
              <button onClick={() => onAddFood?.(meal.id || '', { id: '', englishName: 'Add food', arabicName: 'أضف غذاء', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, servingSize: 100, unit: 'g', category: 'Protein' })} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:text-white">Add food</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Meal name</span>
                <input value={meal.name || ''} onChange={(event) => updateMealField(meal.id || '', 'name', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Calories</span>
                <input value={meal.calories || 0} onChange={(event) => updateMealField(meal.id || '', 'calories', Number(event.target.value))} type="number" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Protein</span>
                <input value={meal.protein || 0} onChange={(event) => updateMealField(meal.id || '', 'protein', Number(event.target.value))} type="number" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-1 block text-[11px] uppercase tracking-widest text-slate-500">Notes</span>
                <input value={meal.notes || ''} onChange={(event) => updateMealField(meal.id || '', 'notes', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none" />
              </label>
            </div>
            <div className="mt-3 text-sm text-slate-400">Foods: {meal.foods?.length || 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
