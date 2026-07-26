import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { OnboardingData, UserProfile } from '../types';
import { aiMasterEngine, handleAIError } from '../services/aiMasterEngine';

export interface AICoachAnalysisResult {
  progressScore: number;
  adherenceScore: number;
  fatLossTrend: string;
  muscleGainTrend: string;
  nextWeekEstimate: string;
  nextMonthEstimate: string;
  summary: string;
}

export interface AICoachWorkoutPlan {
  id?: string;
  title: string;
  split: string;
  goal: string;
  exercises: Array<{
    name: string;
    sets: string;
    reps: string;
    rest: string;
    tempo: string;
    notes: string;
  }>;
  cardio: string;
  notes: string;
}

export interface AICoachMealPlan {
  id?: string;
  title: string;
  goal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: Array<{
    name: string;
    type: string;
    details: string;
  }>;
}

export interface AICoachPrediction {
  expectedWeight: number;
  expectedBodyFat: number;
  expectedBmi: number;
  expectedMuscleMass: number;
  confidence: number;
  horizon: '7d' | '30d' | '90d';
}

export interface AICoachRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AICoachReport {
  id?: string;
  title: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextGoals: string[];
  motivationalMessage: string;
  createdAt?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getLatestMeasurement(profile: UserProfile) {
  const history = [...(profile.measurementHistory || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return history[history.length - 1];
}

function getPreviousMeasurement(profile: UserProfile) {
  const history = [...(profile.measurementHistory || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return history[history.length - 2];
}

function estimateBmi(weight: number, height?: number) {
  if (!height || !weight) return 0;
  const heightMeters = height / 100;
  return Number((weight / (heightMeters * heightMeters)).toFixed(1));
}

function resolveGoal(onboarding?: OnboardingData) {
  switch (onboarding?.goal) {
    case 'loss':
      return 'fat loss';
    case 'bulk':
      return 'muscle gain';
    case 'fitness':
      return 'fitness';
    case 'rehab':
      return 'rehab';
    default:
      return 'general improvement';
  }
}

export async function buildAICoachAnalysis(profile: UserProfile): Promise<AICoachAnalysisResult> {
  const latest = getLatestMeasurement(profile);
  const previous = getPreviousMeasurement(profile);
  const onboarding = profile.onboardingData;
  const weight = latest?.weight || onboarding?.weight || 0;
  const previousWeight = previous?.weight || weight;
  const bodyFat = latest?.fatPercentage || 0;
  const muscleMass = latest?.muscleMass || 0;
  const goal = resolveGoal(onboarding);

  try {
    const response = await aiMasterEngine.generateCoachAnalysis(profile);
    const parsed = response?.content ? JSON.parse(response.content) : null;
    if (parsed) {
      return {
        progressScore: Number(parsed.progressScore || clamp(Math.round(70 + (weight - previousWeight < 0 ? 10 : 0) + (muscleMass > 0 ? 8 : 0) + (bodyFat < 20 ? 6 : 0)), 40, 100)),
        adherenceScore: Number(parsed.adherenceScore || clamp(Math.round(75 + (goal === 'fat loss' ? 8 : 0) + (muscleMass > 0 ? 5 : 0) + (weight - previousWeight < 0 ? 4 : 0)), 45, 100)),
        fatLossTrend: parsed.fatLossTrend || (weight - previousWeight < -0.5 ? 'Improving' : 'Needs attention'),
        muscleGainTrend: parsed.muscleGainTrend || (muscleMass > (previous?.muscleMass || 0) ? 'Positive' : 'Needs attention'),
        nextWeekEstimate: parsed.nextWeekEstimate || 'Stay consistent this week',
        nextMonthEstimate: parsed.nextMonthEstimate || 'Continue the current trend',
        summary: parsed.summary || `Based on the latest data, ${profile.name || 'the client'} is progressing steadily.`,
      };
    }
  } catch (error) {
    console.warn('AI analysis fallback used', error);
  }

  const weightDelta = weight - previousWeight;
  const progressScore = clamp(Math.round(70 + (weightDelta < 0 ? 10 : 0) + (muscleMass > 0 ? 8 : 0) + (bodyFat < 20 ? 6 : 0)), 40, 100);
  const adherenceScore = clamp(Math.round(75 + (goal === 'fat loss' ? 8 : 0) + (muscleMass > 0 ? 5 : 0) + (weightDelta < 0 ? 4 : 0)), 45, 100);
  const fatLossTrend = weightDelta < -0.5 ? 'Improving' : weightDelta < 0 ? 'Stable' : 'Needs attention';
  const muscleGainTrend = muscleMass > (previous?.muscleMass || 0) ? 'Positive' : 'Needs attention';
  const nextWeekEstimate = `${weightDelta < 0 ? 'Slightly lower' : 'Maintain'} weight next week with consistent adherence`;
  const nextMonthEstimate = goal === 'fat loss' ? 'Expected to improve body composition' : 'Expected to maintain or improve lean mass';
  const summary = `Based on the latest metrics, ${profile.name || 'the client'} shows ${fatLossTrend.toLowerCase()} progress with a ${progressScore}% overall score.`;

  return {
    progressScore,
    adherenceScore,
    fatLossTrend,
    muscleGainTrend,
    nextWeekEstimate,
    nextMonthEstimate,
    summary,
  };
}

export async function buildAICoachWorkoutPlan(profile: UserProfile, options?: { split?: string; goal?: string; experienceLevel?: string }): Promise<AICoachWorkoutPlan> {
  try {
    const response = await aiMasterEngine.generateCoachWorkout(profile, options);
    const parsed = response?.content ? JSON.parse(response.content) : null;
    if (parsed) {
      return {
        title: parsed.title || 'AI workout plan',
        split: parsed.split || options?.split || 'Full Body',
        goal: parsed.goal || options?.goal || resolveGoal(profile.onboardingData),
        exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
        cardio: parsed.cardio || 'Zone 2 cardio',
        notes: parsed.notes || 'Follow the progression notes closely.',
      };
    }
  } catch (error) {
    console.warn('AI workout fallback used', error);
  }

  const goal = options?.goal || resolveGoal(profile.onboardingData);
  const split = options?.split || 'Full Body';
  const experienceLevel = options?.experienceLevel || profile.experienceLevel || 'intermediate';

  const exerciseLibrary = [
    { name: 'Goblet Squat', sets: '3', reps: '10-12', rest: '90s', tempo: '3-1-1', notes: 'Focus on depth and control' },
    { name: 'Incline Dumbbell Press', sets: '3', reps: '8-10', rest: '75s', tempo: '2-1-1', notes: 'Keep shoulders stable' },
    { name: 'Romanian Deadlift', sets: '3', reps: '8-10', rest: '90s', tempo: '3-1-1', notes: 'Drive through hips' },
    { name: 'Lat Pulldown', sets: '3', reps: '10-12', rest: '60s', tempo: '2-1-1', notes: 'Squeeze the back' },
  ];

  return {
    title: `${goal} plan • ${split}`,
    split,
    goal,
    exercises: exerciseLibrary.slice(0, experienceLevel === 'advanced' ? 4 : 3).map((exercise) => ({ ...exercise })),
    cardio: '10-15 min zone 2 walking',
    notes: 'Keep a 1-2 reps in reserve and recover well between sets.',
  };
}

export async function buildAICoachMealPlan(profile: UserProfile, options?: { goal?: string; calories?: number; protein?: number; carbs?: number; fat?: number }): Promise<AICoachMealPlan> {
  try {
    const response = await aiMasterEngine.generateCoachMeal(profile, options);
    const parsed = response?.content ? JSON.parse(response.content) : null;
    if (parsed) {
      return {
        title: parsed.title || 'AI meal plan',
        goal: parsed.goal || options?.goal || resolveGoal(profile.onboardingData),
        calories: Number(parsed.calories || 0),
        protein: Number(parsed.protein || 0),
        carbs: Number(parsed.carbs || 0),
        fat: Number(parsed.fat || 0),
        meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      };
    }
  } catch (error) {
    console.warn('AI meal fallback used', error);
  }

  const goal = options?.goal || resolveGoal(profile.onboardingData);
  const calories = options?.calories || 2200;
  const protein = options?.protein || 160;
  const carbs = options?.carbs || 220;
  const fat = options?.fat || 70;

  return {
    title: `${goal} meal plan`,
    goal,
    calories,
    protein,
    carbs,
    fat,
    meals: [
      { name: 'Breakfast', type: 'breakfast', details: 'Greek yogurt bowl with berries, oats, and walnuts' },
      { name: 'Lunch', type: 'lunch', details: 'Chicken rice bowl with roasted vegetables and avocado' },
      { name: 'Dinner', type: 'dinner', details: 'Salmon with potatoes and green beans' },
      { name: 'Snack', type: 'snack', details: 'Protein shake and banana' },
    ],
  };
}

export async function buildAICoachPredictions(profile: UserProfile): Promise<AICoachPrediction[]> {
  try {
    const response = await aiMasterEngine.generateCoachPrediction(profile);
    const parsed = response?.content ? JSON.parse(response.content) : null;
    if (parsed?.predictions) {
      return parsed.predictions;
    }
  } catch (error) {
    console.warn('AI prediction fallback used', error);
  }

  const latest = getLatestMeasurement(profile);
  const onboarding = profile.onboardingData;
  const baseWeight = latest?.weight || onboarding?.weight || 0;
  const baseFat = latest?.fatPercentage || 0;
  const baseBmi = estimateBmi(baseWeight, onboarding?.height);
  const baseMuscle = latest?.muscleMass || 0;

  return [
    { horizon: '7d', expectedWeight: Number((baseWeight - 0.2).toFixed(1)), expectedBodyFat: Number((baseFat - 0.1).toFixed(1)), expectedBmi: Number((baseBmi - 0.1).toFixed(1)), expectedMuscleMass: Number((baseMuscle + 0.1).toFixed(1)), confidence: 78, },
    { horizon: '30d', expectedWeight: Number((baseWeight - 0.8).toFixed(1)), expectedBodyFat: Number((baseFat - 0.3).toFixed(1)), expectedBmi: Number((baseBmi - 0.3).toFixed(1)), expectedMuscleMass: Number((baseMuscle + 0.2).toFixed(1)), confidence: 72, },
    { horizon: '90d', expectedWeight: Number((baseWeight - 2.5).toFixed(1)), expectedBodyFat: Number((baseFat - 0.8).toFixed(1)), expectedBmi: Number((baseBmi - 0.8).toFixed(1)), expectedMuscleMass: Number((baseMuscle + 0.6).toFixed(1)), confidence: 68, },
  ];
}

export async function buildAICoachRecommendations(profile: UserProfile): Promise<AICoachRecommendation[]> {
  try {
    const response = await aiMasterEngine.generateCoachRecommendations(profile);
    const parsed = response?.content ? JSON.parse(response.content) : null;
    if (Array.isArray(parsed?.recommendations)) {
      return parsed.recommendations;
    }
  } catch (error) {
    console.warn('AI recommendation fallback used', error);
  }

  const latest = getLatestMeasurement(profile);
  const onboarding = profile.onboardingData;
  const goal = resolveGoal(onboarding);
  const recommendations: AICoachRecommendation[] = [];

  if (goal === 'fat loss') {
    recommendations.push({ title: 'Increase protein', description: 'Keep protein high to support muscle retention.', priority: 'high' });
    recommendations.push({ title: 'Increase cardio', description: 'Use 2-3 short cardio sessions to support energy expenditure.', priority: 'medium' });
  } else {
    recommendations.push({ title: 'Increase calories', description: 'Add a small calorie surplus to support growth.', priority: 'high' });
    recommendations.push({ title: 'Increase training volume', description: 'Use moderate volume progression for strength gains.', priority: 'medium' });
  }

  if ((latest?.waterPercentage || 0) < 60) {
    recommendations.push({ title: 'Water intake suggestions', description: 'Increase hydration to support recovery and performance.', priority: 'medium' });
  }

  recommendations.push({ title: 'Sleep suggestions', description: 'Aim for 7-9 hours of sleep for better recovery.', priority: 'medium' });
  return recommendations;
}

export async function buildAICoachReport(profile: UserProfile): Promise<AICoachReport> {
  try {
    const response = await aiMasterEngine.generateCoachReport(profile);
    const parsed = response?.content ? JSON.parse(response.content) : null;
    if (parsed) {
      return {
        title: parsed.title || `AI Coach Report • ${profile.name || 'Client'}`,
        summary: parsed.summary || 'Professional report generated.',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        nextGoals: Array.isArray(parsed.nextGoals) ? parsed.nextGoals : [],
        motivationalMessage: parsed.motivationalMessage || 'Keep going.',
      };
    }
  } catch (error) {
    console.warn('AI report fallback used', error);
  }

  const analysis = await buildAICoachAnalysis(profile);
  const recommendations = await buildAICoachRecommendations(profile);
  return {
    title: `AI Coach Report • ${profile.name || 'Client'}`,
    summary: analysis.summary,
    strengths: ['Consistent measurement history', 'Clear goal alignment'],
    weaknesses: ['Needs more frequent tracking', 'Recovery could improve'],
    recommendations: recommendations.map((item) => item.title),
    nextGoals: ['Maintain the current routine', 'Track progress weekly'],
    motivationalMessage: 'You are building momentum. Small consistent actions create major results.',
  };
}

export async function saveAICoachReport(profile: UserProfile, report: AICoachReport) {
  if (!profile.uid) return null;
  const ref = doc(collection(db, 'users', profile.uid, 'aiReports'));
  await setDoc(ref, { ...report, createdAt: report.createdAt || new Date().toISOString() });
  return ref.id;
}

export async function saveAICoachWorkout(profile: UserProfile, plan: AICoachWorkoutPlan) {
  if (!profile.uid) return null;
  const ref = doc(collection(db, 'users', profile.uid, 'aiWorkouts'));
  await setDoc(ref, { ...plan, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function saveAICoachMeal(profile: UserProfile, plan: AICoachMealPlan) {
  if (!profile.uid) return null;
  const ref = doc(collection(db, 'users', profile.uid, 'aiMeals'));
  await setDoc(ref, { ...plan, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function saveAICoachPrediction(profile: UserProfile, predictions: AICoachPrediction[]) {
  if (!profile.uid) return null;
  const ref = doc(collection(db, 'users', profile.uid, 'aiPredictions'));
  await setDoc(ref, { predictions, createdAt: new Date().toISOString() });
  return ref.id;
}
