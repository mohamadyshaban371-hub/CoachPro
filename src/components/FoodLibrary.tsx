import React, { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import type { NutritionFood } from '../types';
import { DEFAULT_FOOD_LIBRARY } from '../lib/mealBuilder';

interface FoodLibraryProps {
  foods?: NutritionFood[];
  favorites?: string[];
  recentFoods?: string[];
  onAddFood?: (food: NutritionFood) => void;
  onToggleFavorite?: (foodId: string) => void;
}

export default function FoodLibrary({ foods = DEFAULT_FOOD_LIBRARY, favorites = [], recentFoods = [], onAddFood, onToggleFavorite }: FoodLibraryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    return foods.filter((food) => {
      const haystack = `${food.englishName} ${food.arabicName} ${food.category} ${food.tags?.join(' ') || ''}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesFilter = filter === 'All' || food.category === filter;
      return matchesQuery && matchesFilter;
    });
  }, [foods, filter, query]);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Food Library</h3>
          <p className="text-sm text-slate-400">Search foods, pin favorites, and build meals quickly.</p>
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Search foods" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <option value="All">All</option>
          <option value="Protein">Protein</option>
          <option value="Carbs">Carbs</option>
          <option value="Healthy Fat">Healthy Fat</option>
          <option value="Fruit">Fruit</option>
          <option value="Vegetable">Vegetable</option>
        </select>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {recentFoods.map((foodId) => {
          const food = foods.find((entry) => entry.id === foodId);
          if (!food) return null;
          return <span key={food.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{food.englishName}</span>;
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((food) => {
          const isFavorite = favorites.includes(food.id || '');
          return (
            <div key={food.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{food.englishName}</p>
                  <p className="text-xs text-slate-400">{food.arabicName}</p>
                </div>
                <button onClick={() => onToggleFavorite?.(food.id || '')} className={`rounded-full p-2 ${isFavorite ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'}`}>
                  <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-white/10 px-2 py-1">{food.category}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{food.calories} kcal</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{food.protein}g protein</span>
              </div>
              <button onClick={() => onAddFood?.(food)} className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">Add to meal</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
