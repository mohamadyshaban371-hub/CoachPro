import { MeasurementHistory, OnboardingData } from '../types';

export interface ProgressMetrics {
  bmi: number;
  bmr: number;
  tdee: number;
  leanMass: number;
  fatMass: number;
}

export interface ProgressDiffs {
  weight: number;
  fatPercentage: number;
  muscleMass: number;
  waterPercentage: number;
}

export interface ProgressMetricSummary {
  key: 'weight' | 'fatPercentage' | 'muscleMass' | 'waterPercentage' | 'bmi';
  label: string;
  start: number;
  current: number;
  change: number;
  changePercent: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

export interface ProgressSummary {
  start: number;
  current: number;
  change: number;
  changePercent: number;
  goal: string;
  trend: 'up' | 'down' | 'stable';
}

export interface ProgressChartPoint {
  date: string;
  weight: number;
  fatPercentage: number;
  muscleMass: number;
  waterPercentage: number;
  bmi: number;
}

export interface ProgressAnalytics {
  summary: ProgressSummary;
  metrics: ProgressMetricSummary[];
  chartData: ProgressChartPoint[];
}

export function calculateBodyMetrics(
  entry: Pick<MeasurementHistory, 'weight' | 'fatPercentage' | 'muscleMass' | 'waterPercentage' | 'protein'>,
  onboarding?: Pick<OnboardingData, 'height' | 'birthDate' | 'gender'>
): ProgressMetrics {
  const weight = Number(entry.weight || 0);
  const fatPercentage = Number(entry.fatPercentage || 0);
  const muscleMass = Number(entry.muscleMass || 0);
  const waterPercentage = Number(entry.waterPercentage || 0);

  const fatMass = weight * (fatPercentage / 100);
  const leanMass = weight - fatMass;

  let bmi = 0;
  let bmr = 0;
  let tdee = 0;

  if (onboarding?.height) {
    const heightMeters = onboarding.height / 100;
    bmi = Number((weight / (heightMeters * heightMeters)).toFixed(1));
  }

  if (onboarding?.birthDate) {
    const birthDate = new Date(onboarding.birthDate);
    if (!Number.isNaN(birthDate.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
      }

      const isMale = onboarding.gender === 'male';
      if (isMale) {
        bmr = Math.round(10 * weight + 6.25 * onboarding.height - 5 * age + 5);
      } else {
        bmr = Math.round(10 * weight + 6.25 * onboarding.height - 5 * age - 161);
      }

      tdee = Math.round(bmr * 1.55);
    }
  }

  return {
    bmi,
    bmr,
    tdee,
    leanMass: Number(leanMass.toFixed(1)),
    fatMass: Number(fatMass.toFixed(1)),
  };
}

export function calculateProgressDiffs(
  current: Pick<MeasurementHistory, 'weight' | 'fatPercentage' | 'muscleMass' | 'waterPercentage'>,
  previous: Pick<MeasurementHistory, 'weight' | 'fatPercentage' | 'muscleMass' | 'waterPercentage'> | undefined
): ProgressDiffs {
  const toNumber = (value: number | undefined) => Number(value || 0);

  return {
    weight: Number((toNumber(current.weight) - toNumber(previous?.weight)).toFixed(1)),
    fatPercentage: Number((toNumber(current.fatPercentage) - toNumber(previous?.fatPercentage)).toFixed(1)),
    muscleMass: Number((toNumber(current.muscleMass) - toNumber(previous?.muscleMass)).toFixed(1)),
    waterPercentage: Number((toNumber(current.waterPercentage) - toNumber(previous?.waterPercentage)).toFixed(1)),
  };
}

function calculateTrend(start: number, current: number) {
  if (current === start) return 'stable' as const;
  return current > start ? 'up' as const : 'down' as const;
}

function calculateChangePercent(start: number, current: number) {
  if (!start) return 0;
  return Number((((current - start) / start) * 100).toFixed(1));
}

function calculateBmiForEntry(entry: Pick<MeasurementHistory, 'weight'>, onboarding?: Pick<OnboardingData, 'height'>): number {
  const weight = Number(entry.weight || 0);
  const height = Number(onboarding?.height || 0);
  if (!weight || !height) return 0;
  const heightMeters = height / 100;
  return Number((weight / (heightMeters * heightMeters)).toFixed(1));
}

export function buildProgressAnalytics(
  history: MeasurementHistory[] = [],
  onboarding?: Pick<OnboardingData, 'height' | 'birthDate' | 'gender' | 'goal'>
): ProgressAnalytics {
  if (!history.length) {
    return {
      summary: {
        start: 0,
        current: 0,
        change: 0,
        changePercent: 0,
        goal: 'لا يوجد هدف بعد',
        trend: 'stable',
      },
      metrics: [],
      chartData: [],
    };
  }

  const startEntry = history[0];
  const currentEntry = history[history.length - 1];
  const startWeight = Number(startEntry.weight || 0);
  const currentWeight = Number(currentEntry.weight || 0);
  const change = Number((currentWeight - startWeight).toFixed(1));
  const changePercent = calculateChangePercent(startWeight, currentWeight);

  const goalLabel = onboarding?.goal === 'loss'
    ? 'خسارة الدهون'
    : onboarding?.goal === 'bulk'
      ? 'بناء العضلات'
      : onboarding?.goal === 'fitness'
        ? 'اللياقة'
        : onboarding?.goal === 'rehab'
          ? 'إعادة التأهيل'
          : 'التحسين العام';

  const metrics: ProgressMetricSummary[] = [
    {
      key: 'weight',
      label: 'الوزن',
      start: Number(startWeight.toFixed(1)),
      current: Number(currentWeight.toFixed(1)),
      change: Number(change.toFixed(1)),
      changePercent,
      unit: 'كجم',
      trend: calculateTrend(startWeight, currentWeight),
    },
    {
      key: 'fatPercentage',
      label: 'الدهون',
      start: Number(Number(startEntry.fatPercentage || 0).toFixed(1)),
      current: Number(Number(currentEntry.fatPercentage || 0).toFixed(1)),
      change: Number((Number(currentEntry.fatPercentage || 0) - Number(startEntry.fatPercentage || 0)).toFixed(1)),
      changePercent: calculateChangePercent(Number(startEntry.fatPercentage || 0), Number(currentEntry.fatPercentage || 0)),
      unit: '%',
      trend: calculateTrend(Number(startEntry.fatPercentage || 0), Number(currentEntry.fatPercentage || 0)),
    },
    {
      key: 'muscleMass',
      label: 'العضلات',
      start: Number(Number(startEntry.muscleMass || 0).toFixed(1)),
      current: Number(Number(currentEntry.muscleMass || 0).toFixed(1)),
      change: Number((Number(currentEntry.muscleMass || 0) - Number(startEntry.muscleMass || 0)).toFixed(1)),
      changePercent: calculateChangePercent(Number(startEntry.muscleMass || 0), Number(currentEntry.muscleMass || 0)),
      unit: 'كجم',
      trend: calculateTrend(Number(startEntry.muscleMass || 0), Number(currentEntry.muscleMass || 0)),
    },
    {
      key: 'waterPercentage',
      label: 'الماء',
      start: Number(Number(startEntry.waterPercentage || 0).toFixed(1)),
      current: Number(Number(currentEntry.waterPercentage || 0).toFixed(1)),
      change: Number((Number(currentEntry.waterPercentage || 0) - Number(startEntry.waterPercentage || 0)).toFixed(1)),
      changePercent: calculateChangePercent(Number(startEntry.waterPercentage || 0), Number(currentEntry.waterPercentage || 0)),
      unit: '%',
      trend: calculateTrend(Number(startEntry.waterPercentage || 0), Number(currentEntry.waterPercentage || 0)),
    },
    {
      key: 'bmi',
      label: 'BMI',
      start: calculateBmiForEntry(startEntry, onboarding),
      current: calculateBmiForEntry(currentEntry, onboarding),
      change: Number((calculateBmiForEntry(currentEntry, onboarding) - calculateBmiForEntry(startEntry, onboarding)).toFixed(1)),
      changePercent: calculateChangePercent(calculateBmiForEntry(startEntry, onboarding), calculateBmiForEntry(currentEntry, onboarding)),
      unit: '',
      trend: calculateTrend(calculateBmiForEntry(startEntry, onboarding), calculateBmiForEntry(currentEntry, onboarding)),
    },
  ];

  const chartData: ProgressChartPoint[] = history.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    weight: Number(Number(entry.weight || 0).toFixed(1)),
    fatPercentage: Number(Number(entry.fatPercentage || 0).toFixed(1)),
    muscleMass: Number(Number(entry.muscleMass || 0).toFixed(1)),
    waterPercentage: Number(Number(entry.waterPercentage || 0).toFixed(1)),
    bmi: calculateBmiForEntry(entry, onboarding),
  }));

  return {
    summary: {
      start: Number(startWeight.toFixed(1)),
      current: Number(currentWeight.toFixed(1)),
      change: Number(change.toFixed(1)),
      changePercent,
      goal: goalLabel,
      trend: calculateTrend(startWeight, currentWeight),
    },
    metrics,
    chartData,
  };
}
