import { useCallback, useMemo, useState } from 'react';
import {
  buildAICoachAnalysis,
  buildAICoachMealPlan,
  buildAICoachPredictions,
  buildAICoachRecommendations,
  buildAICoachReport,
  buildAICoachWorkoutPlan,
  saveAICoachMeal,
  saveAICoachPrediction,
  saveAICoachReport,
  saveAICoachWorkout,
  type AICoachAnalysisResult,
  type AICoachMealPlan,
  type AICoachPrediction,
  type AICoachRecommendation,
  type AICoachReport,
  type AICoachWorkoutPlan,
} from '../lib/aiCoach';
import { UserProfile } from '../types';

export function useAICoach(profile: UserProfile | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AICoachAnalysisResult | null>(null);
  const [workout, setWorkout] = useState<AICoachWorkoutPlan | null>(null);
  const [meal, setMeal] = useState<AICoachMealPlan | null>(null);
  const [predictions, setPredictions] = useState<AICoachPrediction[] | null>(null);
  const [recommendations, setRecommendations] = useState<AICoachRecommendation[] | null>(null);
  const [report, setReport] = useState<AICoachReport | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [nextAnalysis, nextWorkout, nextMeal, nextPredictions, nextRecommendations, nextReport] = await Promise.all([
        buildAICoachAnalysis(profile),
        buildAICoachWorkoutPlan(profile),
        buildAICoachMealPlan(profile),
        buildAICoachPredictions(profile),
        buildAICoachRecommendations(profile),
        buildAICoachReport(profile),
      ]);

      setAnalysis(nextAnalysis);
      setWorkout(nextWorkout);
      setMeal(nextMeal);
      setPredictions(nextPredictions);
      setRecommendations(nextRecommendations);
      setReport(nextReport);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate AI coach output');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const regenerateWorkout = useCallback(async (options?: { split?: string; goal?: string; experienceLevel?: string }) => {
    if (!profile) return null;
    const nextWorkout = await buildAICoachWorkoutPlan(profile, options);
    setWorkout(nextWorkout);
    await saveAICoachWorkout(profile, nextWorkout);
    return nextWorkout;
  }, [profile]);

  const regenerateMeal = useCallback(async (options?: { goal?: string; calories?: number; protein?: number; carbs?: number; fat?: number }) => {
    if (!profile) return null;
    const nextMeal = await buildAICoachMealPlan(profile, options);
    setMeal(nextMeal);
    await saveAICoachMeal(profile, nextMeal);
    return nextMeal;
  }, [profile]);

  const generateReport = useCallback(async () => {
    if (!profile) return null;
    const nextReport = await buildAICoachReport(profile);
    setReport(nextReport);
    await saveAICoachReport(profile, nextReport);
    return nextReport;
  }, [profile]);

  const generatePredictions = useCallback(async () => {
    if (!profile) return null;
    const nextPredictions = await buildAICoachPredictions(profile);
    setPredictions(nextPredictions);
    await saveAICoachPrediction(profile, nextPredictions);
    return nextPredictions;
  }, [profile]);

  return useMemo(() => ({
    loading,
    error,
    analysis,
    workout,
    meal,
    predictions,
    recommendations,
    report,
    refresh,
    regenerateWorkout,
    regenerateMeal,
    generateReport,
    generatePredictions,
  }), [analysis, error, generatePredictions, generateReport, loading, meal, predictions, recommendations, regenerateMeal, regenerateWorkout, refresh, report, workout]);
}

export default useAICoach;
