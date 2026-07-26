/**
 * AI Workout Generator Service
 * Uses Gemini to create personalized training programs based on client profile
 */
import { safeGenerateContent } from './aiMasterEngine';
import type { ClientTrainingProfile, AIGeneratedProgram, SplitType, PeriodizationBlock, StructuredExercise } from '../types';
import DEFAULT_PROFESSIONAL_EXERCISES from '../lib/professionalExercises';

export async function generateProgramFromProfile(profile: ClientTrainingProfile): Promise<AIGeneratedProgram | null> {
  try {
    const system = `You are an elite strength and conditioning coach with 20+ years of experience.
    
Given a client training profile, design a complete personalized training program including:
1. Most suitable training split (from: Push/Pull/Legs, Upper/Lower, Body Part, Full Body, Bro Split, Powerbuilding, etc.)
2. Weekly schedule with specific exercises for each session
3. Sets, reps, tempo, rest times based on their goal
4. Progression strategy
5. Deload week frequency

Return JSON with structure: {
  "split": "Push Pull Legs|Upper Lower|...",
  "rationale": "why this split is best for them",
  "weeklySchedule": {
    "monday": { "dayName": "Push", "focus": "Chest/Shoulders/Triceps", "dayType": "hypertrophy|strength|power" },
    "tuesday": { "dayName": "Pull", "focus": "Back/Biceps", "dayType": "hypertrophy|strength" },
    ...
  },
  "progressionStrategy": "description of how to progress",
  "deloadFrequency": 4,
  "periodizationModel": "linear|undulating|block",
  "notes": "key coaching points"
}`;

    const profileSummary = `
Client Profile:
- Goal: ${profile.goal}
- Age: ${profile.age || '?'}, Gender: ${profile.gender || '?'}
- Height: ${profile.height}cm, Weight: ${profile.weight}kg, Body Fat: ${profile.bodyFat || '?'}%
- Experience: ${profile.experience}
- Available Days/Week: ${profile.availableDays}
- Session Duration: ${profile.sessionDuration} minutes
- Location: ${profile.trainingLocation}
- Equipment: ${profile.availableEquipment?.join(', ') || 'Standard'}
- Injuries: ${profile.injuries && profile.injuries.length > 0 ? profile.injuries.map(i => `${i.bodyPart} (${i.severity})`).join(', ') : 'None'}
- Weak Points: ${profile.weakMuscles?.join(', ') || 'None'}
- Strong Points: ${profile.strongMuscles?.join(', ') || 'None'}
- Sleep: ${profile.sleepHours || '?'} hours
- Stress Level: ${profile.stressLevel}
- Preferred Style: ${profile.preferredStyle}
- Periodization: ${profile.periodizationPreference}
- Notes: ${profile.notes || 'None'}`;

    const res = await safeGenerateContent('gemini-1.5-flash', profileSummary, system, {
      responseMimeType: 'application/json',
    });

    let text = res.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);

    const weeklySchedule: any = {};
    for (const [day, details] of Object.entries(parsed.weeklySchedule || {})) {
      weeklySchedule[day] = {
        dayName: (details as any).dayName || day,
        focus: (details as any).focus,
        notes: (details as any).notes || `${(details as any).dayName} workout`,
        exercises: generateExercisesForDay((details as any).focus, profile),
      };
    }

    const periodizationPlan: PeriodizationBlock[] = generatePeriodization(
      parsed.periodizationModel || 'linear',
      profile.goal
    );

    const program: AIGeneratedProgram = {
      id: `prog-${Date.now()}`,
      clientUid: profile.clientUid,
      profile,
      split: (parsed.split || 'Upper Lower') as SplitType,
      weeklySchedule,
      periodizationPlan,
      progressionStrategy: parsed.progressionStrategy || 'Progressive overload - add weight or reps each week',
      deloadWeekFrequency: parsed.deloadFrequency || 4,
      rationale: parsed.rationale || '',
      generatedAt: new Date().toISOString(),
    };

    return program;
  } catch (e) {
    console.error('Failed to generate program:', e);
    return null;
  }
}

function generateExercisesForDay(focus: string, profile: ClientTrainingProfile): StructuredExercise[] {
  const exercises: StructuredExercise[] = [];

  // Map focus to exercise filters
  const muscleFilters = focus?.toLowerCase().split('/').map(m => m.trim()) || [];

  // Get available exercises that match the focus
  const availableExercises = DEFAULT_PROFESSIONAL_EXERCISES.filter(ex => {
    const muscle = (ex.muscleGroup || '').toLowerCase();
    const secondary = (ex.secondaryMuscles || []).map(m => m.toLowerCase());

    // Check if exercise matches focus muscles
    const matchesFocus = muscleFilters.some(filter =>
      muscle.includes(filter) || secondary.some(s => s.includes(filter))
    );

    // Check equipment availability
    const hasRequiredEquipment =
      !ex.equipment ||
      ex.equipment === 'bodyweight' ||
      (profile.availableEquipment && profile.availableEquipment.some(e => ex.equipment?.includes(e)));

    // Check if it's suitable for experience level
    const suitableLevel =
      !ex.difficulty ||
      (profile.experience === 'beginner' && (ex.difficulty === 'beginner' || ex.difficulty === 'intermediate')) ||
      (profile.experience === 'intermediate') ||
      (profile.experience === 'advanced' || profile.experience === 'elite');

    // Check if it conflicts with injuries
    const noConflict =
      !profile.injuries ||
      profile.injuries.length === 0 ||
      !profile.injuries.some(inj => muscle.includes(inj.bodyPart.toLowerCase()) || secondary.some(s => s.includes(inj.bodyPart.toLowerCase())));

    return matchesFocus && hasRequiredEquipment && suitableLevel && noConflict;
  });

  // Select 4-6 exercises based on goal
  const exerciseCount = profile.goal === 'strength' ? 4 : profile.goal === 'endurance' ? 6 : 5;
  const selectedExercises = availableExercises.slice(0, exerciseCount);

  selectedExercises.forEach((ex, idx) => {
    const structured: StructuredExercise = {
      ...ex,
      id: ex.id || `ex-${idx}`,
      details: generateSetsForGoal(profile.goal, idx === 0),
    };
    exercises.push(structured);
  });

  return exercises;
}

function generateSetsForGoal(goal: string, isCompound: boolean) {
  const baseReps = { sets: '3' };

  const configs: { [key: string]: any } = {
    strength: { ...baseReps, reps: isCompound ? '3-5' : '6-8', rpe: '8-9', rest: '3-4m', tempo: '3-1-1-1' },
    hypertrophy: { ...baseReps, reps: isCompound ? '6-10' : '8-12', rpe: '7-8', rest: '60-90s', tempo: '2-0-2-0' },
    'fat-loss': { ...baseReps, reps: '10-15', rpe: '6-7', rest: '45-60s', tempo: '2-1-2-0' },
    power: { ...baseReps, reps: isCompound ? '3-5' : '5-8', rpe: '8-9', rest: '2-3m', tempo: '1-0-1-0' },
    endurance: { ...baseReps, reps: '15-20', rpe: '5-6', rest: '30-45s', tempo: '2-0-1-0' },
    'general-fitness': { ...baseReps, reps: '8-12', rpe: '7', rest: '60s', tempo: '2-0-2-0' },
    athletic: { ...baseReps, reps: '5-10', rpe: '7-8', rest: '90s', tempo: '2-0-2-0' },
  };

  return [{ ...configs[goal] || configs['general-fitness'] }];
}

function generatePeriodization(model: string, goal: string): PeriodizationBlock[] {
  const blocks: PeriodizationBlock[] = [];

  if (model === 'linear') {
    blocks.push({ id: '1', name: 'Phase 1', type: 'meso', weeks: 4, intensityRange: { from: 60, to: 70 }, volumeMultiplier: 1.0 });
    blocks.push({ id: '2', name: 'Phase 2', type: 'meso', weeks: 4, intensityRange: { from: 70, to: 80 }, volumeMultiplier: 0.95 });
    blocks.push({ id: '3', name: 'Phase 3', type: 'meso', weeks: 4, intensityRange: { from: 80, to: 90 }, volumeMultiplier: 0.9 });
    blocks.push({ id: 'deload', name: 'Deload', type: 'deload', weeks: 1, intensityRange: { from: 40, to: 50 }, volumeMultiplier: 0.5 });
  } else if (model === 'undulating') {
    blocks.push({ id: '1', name: 'Heavy Day (Strength)', type: 'micro', weeks: 1, intensityRange: { from: 85, to: 95 }, volumeMultiplier: 0.8 });
    blocks.push({ id: '2', name: 'Moderate Day (Hypertrophy)', type: 'micro', weeks: 1, intensityRange: { from: 70, to: 80 }, volumeMultiplier: 1.0 });
    blocks.push({ id: '3', name: 'Light Day (Endurance)', type: 'micro', weeks: 1, intensityRange: { from: 50, to: 70 }, volumeMultiplier: 1.2 });
  } else if (model === 'block') {
    blocks.push({ id: '1', name: 'Accumulation Block', type: 'meso', weeks: 3, intensityRange: { from: 60, to: 75 }, volumeMultiplier: 1.2 });
    blocks.push({ id: '2', name: 'Intensification Block', type: 'meso', weeks: 3, intensityRange: { from: 80, to: 90 }, volumeMultiplier: 0.9 });
    blocks.push({ id: '3', name: 'Realization Block', type: 'meso', weeks: 2, intensityRange: { from: 85, to: 95 }, volumeMultiplier: 0.7 });
  } else {
    blocks.push({ id: '1', name: 'Building Phase', type: 'meso', weeks: 4, intensityRange: { from: 70, to: 80 }, volumeMultiplier: 1.0 });
    blocks.push({ id: '2', name: 'Peak Phase', type: 'meso', weeks: 2, intensityRange: { from: 85, to: 95 }, volumeMultiplier: 0.8 });
  }

  return blocks;
}

export async function aiSelectExerciseReplacements(
  originalExercise: string,
  reason: string,
  availableEquipment?: string[],
  restrictions?: string[]
): Promise<{ replacements: string[]; explanations: string[] } | null> {
  try {
    const system = `You are a strength coach expert in exercise substitutions. Given an exercise and constraints, suggest 3 appropriate replacement exercises. Return JSON: { replacements: string[], explanations: string[] }`;
    const prompt = `Exercise to replace: ${originalExercise}\nReason: ${reason}\nEquipment available: ${availableEquipment?.join(', ') || 'Standard'}\nRestrictions: ${restrictions?.join(', ') || 'None'}`;
    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);
    return { replacements: parsed.replacements || [], explanations: parsed.explanations || [] };
  } catch (e) {
    return null;
  }
}

export async function generateTrainingBlockProgression(currentBlock: PeriodizationBlock, performance: { avgRPE: number; volume: number; adherence: number }): Promise<PeriodizationBlock | null> {
  try {
    const system = `You are a periodization expert. Given current block performance, generate the next training block with adjusted intensity/volume. Return JSON: { name, weeks, intensityRange: {from, to}, volumeMultiplier, progressionStrategy }`;
    const prompt = `Current block: ${currentBlock.name}\nDuration: ${currentBlock.weeks} weeks\nPerformance - Avg RPE: ${performance.avgRPE}, Volume: ${performance.volume}kg, Adherence: ${performance.adherence}%`;
    const res = await safeGenerateContent('gemini-1.5-flash', prompt, system, { responseMimeType: 'application/json' });
    let text = res.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    const parsed = JSON.parse(text);
    return {
      id: `block-${Date.now()}`,
      name: parsed.name || 'Next Block',
      type: 'meso',
      weeks: parsed.weeks || 4,
      intensityRange: parsed.intensityRange || { from: 70, to: 80 },
      volumeMultiplier: parsed.volumeMultiplier || 1.0,
      progressionStrategy: parsed.progressionStrategy,
    };
  } catch (e) {
    return null;
  }
}
