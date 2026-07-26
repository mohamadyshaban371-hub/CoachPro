/**
 * Fatigue & Recovery Engine
 * Calculates readiness, fatigue, and recovery scores
 */
import { safeGenerateContent } from './aiMasterEngine';
import type { FatigueRecord } from '../types';

export interface ReadinessScore {
  score: number; // 1-10
  category: 'poor' | 'fair' | 'good' | 'excellent';
  factors: {
    sleep: number;
    stress: number;
    soreness: number;
    workload: number;
    recoveryModalities: number;
  };
  recommendations: string[];
  trainingIntensityAdjustment: number; // 0.5 = 50% intensity, 1.5 = 150% intensity
}

export function calculateReadinessScore(record: Partial<FatigueRecord>): ReadinessScore {
  const weights = {
    sleep: 0.3,
    stress: 0.2,
    soreness: 0.2,
    fatigue: 0.2,
    recovery: 0.1,
  };

  // Sleep scoring: 8 hours = 10, 6 hours = 5, <5 hours = 2, 9+ hours = 8
  const sleepScore = Math.min(10, Math.max(2, (record.sleepHours || 7) * 1.25));

  // Stress scoring: inverted (low stress = high score)
  const stressScore = 10 - Math.min(10, record.stressLevel || 5);

  // Soreness scoring: inverted
  const sorenessScore = 10 - Math.min(10, record.soreness || 0);

  // Fatigue scoring: inverted
  const fatigueScore = 10 - Math.min(10, record.fatigueScore || 5);

  // Recovery scoring
  const recoveryScore = Math.min(10, record.recoveryScore || 5);

  const totalScore =
    sleepScore * weights.sleep +
    stressScore * weights.stress +
    sorenessScore * weights.soreness +
    fatigueScore * weights.fatigue +
    recoveryScore * weights.recovery;

  const score = Math.round(totalScore * 10) / 10;

  // Determine category
  let category: 'poor' | 'fair' | 'good' | 'excellent';
  if (score >= 8) category = 'excellent';
  else if (score >= 6.5) category = 'good';
  else if (score >= 4.5) category = 'fair';
  else category = 'poor';

  // Intensity adjustment
  let trainingIntensityAdjustment = 1.0;
  if (category === 'excellent') trainingIntensityAdjustment = 1.2;
  else if (category === 'good') trainingIntensityAdjustment = 1.0;
  else if (category === 'fair') trainingIntensityAdjustment = 0.8;
  else trainingIntensityAdjustment = 0.5;

  const recommendations: string[] = [];

  if ((record.sleepHours || 8) < 7) {
    recommendations.push('⚠️ Sleep is below optimal - prioritize 7-9 hours tonight');
  }
  if ((record.stressLevel || 5) >= 7) {
    recommendations.push('⚠️ Stress is high - consider lighter training or active recovery');
  }
  if ((record.soreness || 0) >= 6) {
    recommendations.push('⚠️ DOMS is significant - reduce training volume today');
  }
  if ((record.fatigueScore || 5) >= 7) {
    recommendations.push('⚠️ Fatigue is elevated - take extra rest or deload');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Excellent readiness - you can push today');
  }

  const factors = {
    sleep: Math.round(sleepScore * 10) / 10,
    stress: Math.round(stressScore * 10) / 10,
    soreness: Math.round(sorenessScore * 10) / 10,
    workload: Math.round(fatigueScore * 10) / 10,
    recoveryModalities: Math.round(recoveryScore * 10) / 10,
  };

  return {
    score,
    category,
    factors,
    recommendations,
    trainingIntensityAdjustment,
  };
}

export interface RecoveryAnalysis {
  isRecoveringWell: boolean;
  recoveryRate: 'fast' | 'normal' | 'slow';
  dominantStressor: 'sleep' | 'stress' | 'volume' | 'soreness' | 'none';
  interventions: string[];
  estimatedRecoveryDays: number;
}

export function analyzeRecovery(recentRecords: FatigueRecord[]): RecoveryAnalysis {
  if (recentRecords.length < 2) {
    return {
      isRecoveringWell: true,
      recoveryRate: 'normal',
      dominantStressor: 'none',
      interventions: ['Establish baseline - continue logging daily metrics'],
      estimatedRecoveryDays: 1,
    };
  }

  const avgFatigue = recentRecords.reduce((sum, r) => sum + r.fatigueScore, 0) / recentRecords.length;
  const avgRecovery = recentRecords.reduce((sum, r) => sum + r.recoveryScore, 0) / recentRecords.length;
  const trendFatigue = recentRecords[recentRecords.length - 1].fatigueScore - recentRecords[0].fatigueScore;

  const recoveryRate = avgRecovery >= 7 ? 'fast' : avgRecovery >= 5 ? 'normal' : 'slow';
  const isRecoveringWell = avgRecovery >= 6 && trendFatigue <= 1;

  // Identify dominant stressor
  const avgSort = recentRecords[recentRecords.length - 1];
  let dominantStressor: 'sleep' | 'stress' | 'volume' | 'soreness' | 'none' = 'none';

  if ((avgSort.sleepHours || 8) < 6.5) dominantStressor = 'sleep';
  else if ((avgSort.stressLevel || 5) >= 7) dominantStressor = 'stress';
  else if (avgSort.fatigueScore >= 7) dominantStressor = 'volume';
  else if ((avgSort.soreness || 0) >= 6) dominantStressor = 'soreness';

  const interventions: string[] = [];

  switch (dominantStressor) {
    case 'sleep':
      interventions.push('Increase sleep duration to 8+ hours');
      interventions.push('Improve sleep quality: dark room, cool temperature, no screens 1 hour before bed');
      interventions.push('Consider magnesium supplementation');
      break;
    case 'stress':
      interventions.push('Practice stress management: meditation, breathing exercises');
      interventions.push('Reduce workout intensity by 20%');
      interventions.push('Add yoga or stretching sessions');
      break;
    case 'volume':
      interventions.push('Reduce training volume by 20-30%');
      interventions.push('Implement deload week');
      interventions.push('Add more rest days');
      break;
    case 'soreness':
      interventions.push('Increase warm-up duration');
      interventions.push('Add foam rolling and stretching');
      interventions.push('Consider massage or contrast therapy');
      interventions.push('Ensure adequate protein intake');
      break;
  }

  const estimatedRecoveryDays = isRecoveringWell ? 1 : recoveryRate === 'slow' ? 3 : 2;

  return {
    isRecoveringWell,
    recoveryRate,
    dominantStressor,
    interventions,
    estimatedRecoveryDays,
  };
}

export interface RecoveryModality {
  name: string;
  duration: number; // minutes
  effectiveness: number; // 1-10
  category: 'active' | 'passive' | 'nutrition' | 'sleep' | 'mental';
}

export const RECOVERY_MODALITIES: RecoveryModality[] = [
  { name: 'Sleep', duration: 480, effectiveness: 10, category: 'sleep' },
  { name: 'Massage', duration: 60, effectiveness: 8, category: 'passive' },
  { name: 'Foam Rolling', duration: 20, effectiveness: 7, category: 'passive' },
  { name: 'Stretching', duration: 15, effectiveness: 6, category: 'passive' },
  { name: 'Cold Plunge', duration: 5, effectiveness: 7, category: 'passive' },
  { name: 'Sauna', duration: 20, effectiveness: 6, category: 'passive' },
  { name: 'Light Cardio', duration: 20, effectiveness: 5, category: 'active' },
  { name: 'Yoga', duration: 30, effectiveness: 7, category: 'active' },
  { name: 'Meditation', duration: 20, effectiveness: 6, category: 'mental' },
  { name: 'Protein Intake', duration: 0, effectiveness: 8, category: 'nutrition' },
  { name: 'Hydration', duration: 0, effectiveness: 7, category: 'nutrition' },
];

export function recommendRecoveryPlan(readiness: ReadinessScore): RecoveryModality[] {
  const plan: RecoveryModality[] = [];

  // Always prioritize sleep
  if (readiness.factors.sleep < 6) {
    plan.push(RECOVERY_MODALITIES[0]); // Sleep
  }

  // High soreness = massage/foam rolling
  if (readiness.factors.soreness < 5) {
    plan.push(RECOVERY_MODALITIES[1], RECOVERY_MODALITIES[2]); // Massage, Foam Rolling
  }

  // High stress = yoga/meditation
  if (readiness.factors.stress < 5) {
    plan.push(RECOVERY_MODALITIES[8], RECOVERY_MODALITIES[9]); // Meditation, Yoga
  }

  // General recovery
  if (readiness.factors.recoveryModalities < 6) {
    plan.push(RECOVERY_MODALITIES[4]); // Cold Plunge
  }

  // Nutrition is always beneficial
  plan.push(RECOVERY_MODALITIES[9], RECOVERY_MODALITIES[10]); // Protein, Hydration

  // Remove duplicates
  const seen = new Set<string>();
  return plan.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}

export async function aiGeneratePersonalizedRecoveryPlan(
  readinessData: {
    sleepHours: number;
    stressLevel: number;
    soreness: number;
    availableTime: number; // minutes
    preferences: string[]; // e.g., "active", "passive", "meditation"
  }
): Promise<{ plan: RecoveryModality[]; tips: string[] } | null> {
  try {
    const system = `You are a recovery specialist. Given readiness data and preferences, suggest specific recovery modalities and tips. Return JSON: { modalities: string[], tips: string[] }`;

    const prompt = `Sleep: ${readinessData.sleepHours}h, Stress: ${readinessData.stressLevel}/10, Soreness: ${readinessData.soreness}/10, Available: ${readinessData.availableTime}min, Preferences: ${readinessData.preferences.join(', ')}`;

    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);

    const plan = (parsed.modalities || []).map((name: string) => RECOVERY_MODALITIES.find(m => m.name.toLowerCase() === name.toLowerCase())).filter(Boolean) as RecoveryModality[];

    return {
      plan: plan.length > 0 ? plan : [RECOVERY_MODALITIES[0]],
      tips: parsed.tips || [],
    };
  } catch (e) {
    return null;
  }
}

export function calculateDOMS(recentSessions: { date: string; intensity: number; volume: number }[]): { score: number; estimatedPeakDay: string; tips: string[] } {
  if (recentSessions.length < 2) {
    return { score: 0, estimatedPeakDay: '', tips: ['Perform a light warm-up before training'] };
  }

  const lastSession = recentSessions[recentSessions.length - 1];
  const hoursSinceSession = (Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60);

  // DOMS typically peaks 24-48 hours after training
  const domsScore = Math.sin((hoursSinceSession / 48) * Math.PI) * 10;
  const peakDay = new Date(new Date(lastSession.date).getTime() + 36 * 60 * 60 * 1000); // 36 hours post-session

  const tips: string[] = [];
  if (hoursSinceSession < 24) {
    tips.push('✅ DOMS will likely peak tomorrow - increase protein intake');
  } else if (hoursSinceSession < 48) {
    tips.push('⚠️ DOMS is at or near peak - consider lighter training or active recovery');
  } else {
    tips.push('✅ DOMS is resolving - normal training can resume');
  }

  return {
    score: Math.round(domsScore * 10) / 10,
    estimatedPeakDay: peakDay.toISOString().split('T')[0],
    tips,
  };
}
