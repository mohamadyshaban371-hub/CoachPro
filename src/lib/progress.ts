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
