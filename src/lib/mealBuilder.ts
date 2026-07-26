import type { ClientMealPlan, MealPlanEntry, NutritionFood, NutritionHistoryEntry, MealTemplate } from '../types';

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre Workout', 'Post Workout'] as const;

export const DEFAULT_FOOD_LIBRARY: NutritionFood[] = [
  {
    id: 'chicken-breast',
    arabicName: 'صدر دجاج',
    englishName: 'Chicken Breast',
    category: 'Protein',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    sugar: 0,
    sodium: 74,
    servingSize: 100,
    unit: 'g',
    tags: ['protein'],
  },
  {
    id: 'rice',
    arabicName: 'أرز',
    englishName: 'Rice',
    category: 'Carbs',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
    sugar: 0.1,
    sodium: 1,
    servingSize: 100,
    unit: 'g',
    tags: ['carbs'],
  },
  {
    id: 'avocado',
    arabicName: 'أفوكادو',
    englishName: 'Avocado',
    category: 'Healthy Fat',
    calories: 160,
    protein: 2,
    carbs: 9,
    fat: 15,
    fiber: 7,
    sugar: 0.7,
    sodium: 7,
    servingSize: 100,
    unit: 'g',
    tags: ['fat', 'fiber'],
  },
  {
    id: 'banana',
    arabicName: 'موز',
    englishName: 'Banana',
    category: 'Fruit',
    calories: 89,
    protein: 1.1,
    carbs: 23,
    fat: 0.3,
    fiber: 2.6,
    sugar: 12,
    sodium: 1,
    servingSize: 100,
    unit: 'g',
    tags: ['fruit'],
  },
  {
    id: 'oats',
    arabicName: 'شوفان',
    englishName: 'Oats',
    category: 'Carbs',
    calories: 389,
    protein: 16.9,
    carbs: 66.3,
    fat: 6.9,
    fiber: 8.5,
    sugar: 1.1,
    sodium: 2,
    servingSize: 100,
    unit: 'g',
    tags: ['carbs', 'fiber'],
  },
  {
    id: 'yogurt',
    arabicName: 'زبادي',
    englishName: 'Greek Yogurt',
    category: 'Protein',
    calories: 59,
    protein: 10.3,
    carbs: 3.6,
    fat: 0.4,
    fiber: 0,
    sugar: 3.2,
    sodium: 36,
    servingSize: 100,
    unit: 'g',
    tags: ['protein'],
  },
  {
    id: 'salmon',
    arabicName: 'سلمون',
    englishName: 'Salmon',
    category: 'Protein',
    calories: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
    fiber: 0,
    sugar: 0,
    sodium: 59,
    servingSize: 100,
    unit: 'g',
    tags: ['protein', 'omega-3'],
  },
  {
    id: 'spinach',
    arabicName: 'سبانخ',
    englishName: 'Spinach',
    category: 'Vegetable',
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    fiber: 2.2,
    sugar: 0.4,
    sodium: 79,
    servingSize: 100,
    unit: 'g',
    tags: ['fiber', 'vegetable'],
  },
];

export function createEmptyMealEntry(type: MealPlanEntry['type']): MealPlanEntry {
  return {
    id: crypto.randomUUID?.() || `meal-${Date.now()}`,
    type,
    name: `${type} Meal`,
    foods: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    notes: '',
    completed: false,
  };
}

export function createEmptyMealPlan(clientUid: string, day: string): ClientMealPlan {
  return {
    id: crypto.randomUUID?.() || `meal-plan-${Date.now()}`,
    title: 'Daily Meal Plan',
    clientUid,
    day,
    meals: MEAL_TYPES.slice(0, 4).map((type) => createEmptyMealEntry(type as MealPlanEntry['type'])),
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    waterIntake: 0,
    completionPercent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildMealTemplateFromPlan(title: string, plan: ClientMealPlan): MealTemplate {
  return {
    id: crypto.randomUUID?.() || `meal-template-${Date.now()}`,
    name: title,
    category: 'Custom',
    meals: plan.meals.map((meal) => ({ ...meal, id: meal.id || crypto.randomUUID?.() || `meal-${Date.now()}` })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function calculateMealTotals(meals: MealPlanEntry[]) {
  return meals.reduce(
    (acc, meal) => {
      acc.calories += meal.calories || 0;
      acc.protein += meal.protein || 0;
      acc.carbs += meal.carbs || 0;
      acc.fat += meal.fat || 0;
      acc.fiber += meal.fiber || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

export function calculateCompletionPercent(meals: MealPlanEntry[]) {
  if (!meals.length) return 0;
  const completedCount = meals.filter((meal) => meal.completed).length;
  return Math.round((completedCount / meals.length) * 100);
}

export function createNutritionHistoryEntry(plan: ClientMealPlan, clientUid: string): NutritionHistoryEntry {
  return {
    id: crypto.randomUUID?.() || `nutrition-${Date.now()}`,
    clientUid,
    date: new Date().toISOString(),
    calories: plan.totalCalories || 0,
    protein: plan.totalProtein || 0,
    carbs: plan.totalCarbs || 0,
    fat: plan.totalFat || 0,
    fiber: plan.totalFiber || 0,
    waterMl: plan.waterIntake || 0,
    completed: plan.completionPercent === 100,
    notes: plan.title,
  };
}

export function calculateNutritionAnalytics(entries: NutritionHistoryEntry[]) {
  if (!entries.length) {
    return {
      caloriesConsumed: 0,
      proteinAverage: 0,
      carbsAverage: 0,
      fatAverage: 0,
      waterIntake: 0,
      mealAdherence: 0,
      completionPercent: 0,
    };
  }

  const average = (key: keyof NutritionHistoryEntry) => {
    const values = entries.map((entry) => Number((entry as any)[key] || 0));
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  const completionPercent = Math.round((entries.filter((entry) => entry.completed).length / entries.length) * 100);

  return {
    caloriesConsumed: average('calories' as keyof NutritionHistoryEntry),
    proteinAverage: average('protein' as keyof NutritionHistoryEntry),
    carbsAverage: average('carbs' as keyof NutritionHistoryEntry),
    fatAverage: average('fat' as keyof NutritionHistoryEntry),
    waterIntake: average('waterMl' as keyof NutritionHistoryEntry),
    mealAdherence: completionPercent,
    completionPercent,
  };
}
