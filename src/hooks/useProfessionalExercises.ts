import { useEffect, useMemo, useState } from 'react';
import type { ProfessionalExercise } from '../types';
import { listenProfessionalExercises } from '../services/professionalExercises';

export function useProfessionalExercises() {
  const [exercises, setExercises] = useState<ProfessionalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{ muscle?: string; equipment?: string; category?: string; difficulty?: string; movement?: string; trainingStyle?: string }>({});
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const unsub = listenProfessionalExercises((items) => {
      setExercises(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleFavorite = (id: string) => setFavorites((cur) => (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (q) {
        const hay = `${ex.name} ${ex.arabicName || ''} ${ex.tags?.join(' ') || ''} ${ex.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.muscle && ex.muscleGroup !== filters.muscle) return false;
      if (filters.equipment && ex.equipment !== filters.equipment) return false;
      if (filters.category && ex.category !== filters.category) return false;
      if (filters.difficulty && ex.difficulty !== (filters.difficulty as any)) return false;
      if (filters.movement && ex.movementPattern !== filters.movement) return false;
      return true;
    });
  }, [exercises, query, filters]);

  return { exercises: results, rawExercises: exercises, loading, query, setQuery, filters, setFilters, favorites, toggleFavorite };
}

export default useProfessionalExercises;
