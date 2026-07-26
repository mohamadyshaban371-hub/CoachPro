import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ClientMealPlan, MealPlanEntry, MealTemplate, NutritionFood, NutritionHistoryEntry } from '../types';
import { buildMealTemplateFromPlan, calculateCompletionPercent, calculateMealTotals, createEmptyMealPlan, createNutritionHistoryEntry } from '../lib/mealBuilder';

export function useMealBuilder(clientUid?: string) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [mealPlans, setMealPlans] = useState<ClientMealPlan[]>([]);
  const [nutritionHistory, setNutritionHistory] = useState<NutritionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientUid) return;

    const templatesRef = collection(db, 'users', clientUid, 'mealTemplates');
    const templatesQuery = query(templatesRef, orderBy('updatedAt', 'desc'));
    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as MealTemplate));
      setTemplates(items);
    });

    const plansRef = collection(db, 'users', clientUid, 'clientMealPlans');
    const plansQuery = query(plansRef, orderBy('updatedAt', 'desc'));
    const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ClientMealPlan));
      setMealPlans(items);
    });

    const historyRef = collection(db, 'users', clientUid, 'nutritionHistory');
    const historyQuery = query(historyRef, orderBy('date', 'desc'));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as NutritionHistoryEntry));
      setNutritionHistory(items);
    });

    setLoading(false);

    return () => {
      unsubscribeTemplates();
      unsubscribePlans();
      unsubscribeHistory();
    };
  }, [clientUid]);

  const createTemplate = useCallback(async (name: string, plan: ClientMealPlan) => {
    if (!clientUid) return null;
    const template = buildMealTemplateFromPlan(name, plan);
    const id = template.id || `template-${Date.now()}`;
    const payload = { ...template, id };
    await setDoc(doc(db, 'users', clientUid, 'mealTemplates', id), payload);
    return payload;
  }, [clientUid]);

  const updateTemplate = useCallback(async (template: MealTemplate) => {
    if (!clientUid || !template.id) return null;
    const payload = { ...template, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', clientUid, 'mealTemplates', template.id), payload);
    return payload;
  }, [clientUid]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!clientUid) return;
    await deleteDoc(doc(db, 'users', clientUid, 'mealTemplates', templateId));
  }, [clientUid]);

  const duplicateTemplate = useCallback(async (template: MealTemplate) => {
    if (!clientUid) return null;
    const duplicate = { ...template, id: `${template.id}-copy`, name: `${template.name} Copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', clientUid, 'mealTemplates', duplicate.id), duplicate);
    return duplicate;
  }, [clientUid]);

  const savePlan = useCallback(async (plan: ClientMealPlan) => {
    if (!clientUid) return null;
    const totals = calculateMealTotals(plan.meals);
    const payload = { ...plan, ...totals, totalCalories: totals.calories, totalProtein: totals.protein, totalCarbs: totals.carbs, totalFat: totals.fat, totalFiber: totals.fiber, completionPercent: calculateCompletionPercent(plan.meals), updatedAt: new Date().toISOString() };
    const id = payload.id || `meal-plan-${Date.now()}`;
    const persisted = { ...payload, id };
    await setDoc(doc(db, 'users', clientUid, 'clientMealPlans', id), persisted);
    return persisted;
  }, [clientUid]);

  const markMealComplete = useCallback(async (plan: ClientMealPlan, mealId: string) => {
    if (!clientUid) return null;
    const nextMeals = plan.meals.map((meal) => meal.id === mealId ? { ...meal, completed: !meal.completed } : meal);
    const updatedPlan = { ...plan, meals: nextMeals, completionPercent: calculateCompletionPercent(nextMeals) };
    const persisted = await savePlan(updatedPlan);
    if (persisted) {
      const history = createNutritionHistoryEntry(persisted, clientUid);
      await setDoc(doc(db, 'users', clientUid, 'nutritionHistory', history.id || `nutrition-${Date.now()}`), history);
    }
    return persisted;
  }, [clientUid, savePlan]);

  const assignTemplate = useCallback(async (template: MealTemplate, day: string) => {
    if (!clientUid) return null;
    const plan = createEmptyMealPlan(clientUid, day);
    const payload = { ...plan, title: template.name, meals: template.meals.map((meal) => ({ ...meal, id: meal.id || `meal-${Date.now()}` })) };
    return savePlan(payload);
  }, [clientUid, savePlan]);

  return useMemo(() => ({
    loading,
    templates,
    mealPlans,
    nutritionHistory,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    savePlan,
    markMealComplete,
    assignTemplate,
  }), [assignTemplate, createTemplate, deleteTemplate, duplicateTemplate, loading, mealPlans, nutritionHistory, savePlan, templates, updateTemplate, markMealComplete]);
}

export default useMealBuilder;
