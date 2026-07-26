import React from 'react';
import type { ClientMealPlan } from '../types';

interface MealPlannerProps {
  plans: ClientMealPlan[];
  selectedPlanId?: string;
  onSelectPlan?: (plan: ClientMealPlan) => void;
  onCreatePlan?: () => void;
}

export default function MealPlanner({ plans, selectedPlanId, onSelectPlan, onCreatePlan }: MealPlannerProps) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Meal Planner</h3>
          <p className="text-sm text-slate-400">Review weekly meal plans, create new ones, and jump into editing.</p>
        </div>
        <button onClick={() => onCreatePlan?.()} className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">New plan</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <button key={plan.id} onClick={() => onSelectPlan?.(plan)} className={`rounded-2xl border p-4 text-left transition ${selectedPlanId === plan.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-white/10 bg-slate-950/50 hover:border-cyan-500/40'}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-white">{plan.title}</p>
              <span className="text-xs text-slate-400">{plan.day}</span>
            </div>
            <p className="text-sm text-slate-400">{plan.meals.length} meals</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-white/10 px-2 py-1">{plan.totalCalories || 0} kcal</span>
              <span className="rounded-full border border-white/10 px-2 py-1">{plan.totalProtein || 0}g protein</span>
              <span className="rounded-full border border-white/10 px-2 py-1">{plan.completionPercent || 0}% done</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
