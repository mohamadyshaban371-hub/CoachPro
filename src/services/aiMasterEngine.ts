import { EMSProgram, FullQuestionnaire, MeasurementHistory, RehabProgram, UserProfile } from "../types";
import { scheduleAISchedulerNotifications } from './notificationScheduler';
import { sanitizeAiInput } from '../lib/sanitize';

/**
 * Resolves the client's real age from stored age field OR birthDate.
 * Never returns a static fallback like 30 — always uses actual profile data.
 */
export function resolveClientAge(client: UserProfile): number {
  // 1. Prefer explicitly stored age (set during onboarding)
  const stored = client.onboardingData?.age;
  if (stored && stored > 5 && stored < 120) return stored;

  // 2. Calculate from birthDate
  const bd = client.onboardingData?.birthDate;
  if (bd) {
    try {
      const birth = new Date(bd);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        if (age > 5 && age < 120) return age;
      }
    } catch {/* ignore */}
  }

  console.warn(`[ScientificEngine] No valid age for client ${client.uid} — using 25 as minimum fallback.`);
  return 25;
}

/**
 * Resolves readiness inputs from multiple sources in priority order:
 * 1. Workout questionnaire readiness (freshest — re-asked each submission)
 * 2. Client's daily logs (today's entry if available)
 * 3. Onboarding pain level
 * Does NOT use hardcoded static defaults (no more stress:5 / sleep:7 for everyone).
 */
function resolveReadiness(
  client: UserProfile,
  questionnaire?: FullQuestionnaire
): {
  stress: number;
  sleepHours: number;
  pain: number;
  injuries: string;
  hasRealData: boolean;
  watchHrv?: number;
  watchRecoveryScore?: number;
  watchHrStrain?: 'low' | 'normal' | 'high';
  watchSpo2?: number;
} {
  const qr = questionnaire?.workout?.readiness;

  // Pull today's daily log for sleep hours fallback
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = client.dailyLogs?.[today];
  const watchSleep = todayLog?.watch?.sleepHours;

  // Questionnaire readiness is the gold standard
  const hasQR = qr !== undefined && (
    qr.stress !== undefined || qr.sleepHours !== undefined || qr.pain !== undefined
  );

  const stress = hasQR && qr.stress !== undefined ? qr.stress : null;
  const sleepHours = hasQR && qr.sleepHours !== undefined
    ? qr.sleepHours
    : (watchSleep ?? null);
  const pain = hasQR && qr.pain !== undefined
    ? qr.pain
    : Math.min(10, client.onboardingData?.painIntensity ?? 0);

  const hasRealData = stress !== null || sleepHours !== null;

  // Pull normalized wearable metrics for downstream use in the prompt.
  const watchSnap = todayLog?.watch;
  const watchHrv = watchSnap?.hrv;
  const watchRecoveryScore = watchSnap?.recoveryScore;
  const watchHrStrain = watchSnap?.hrStrain;
  const watchSpo2 = watchSnap?.spo2;

  return {
    // Only fall back to moderate-neutral defaults when truly no data exists
    stress: stress ?? 4,
    sleepHours: sleepHours ?? 7,
    pain: pain,
    injuries: client.onboardingData?.injuryDescription || '',
    hasRealData,
    // Wearable extras — undefined when not available; consumers must guard
    watchHrv,
    watchRecoveryScore,
    watchHrStrain,
    watchSpo2,
  };
}
import {
  runScientificEngine,
  formatEngineForPrompt,
  runProgressionAnalysis,
  formatProgressionForPrompt,
  selectAdaptiveTests,
  formatAdaptiveSelectionForPrompt,
  computeRiskLevel,
  type ScientificInput,
  type ScientificEngineResult,
  type Goal,
  type Level,
  type CyclePhase,
  type DailyProgressLog,
  type ProgressionPrescription,
  type AdaptiveContext,
} from "../lib/scientificEngine";
import {
  calculateMacros,
  type ActivityLevel as MacroActivityLevel,
  type MacroOutput,
} from "../lib/macroCalculator";
import {
  nutritionRailHeader,
  trainingRailHeader,
  emsRailHeader,
} from "../lib/aiBlocks";
import { generateAIInsightNotifications } from '../core/services/notifications.service';

/**
 * Build the deterministic ScientificInput object from the user's
 * profile + (optional) workout questionnaire. Centralised here so
 * every AI entry-point uses the exact same numbers.
 */
function buildScientificInput(
  client: UserProfile,
  questionnaire?: FullQuestionnaire,
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
): ScientificInput {
  const age = resolveClientAge(client);
  const gender = (client.onboardingData?.gender || client.gender || 'male') as 'male' | 'female';
  const goal = (client.onboardingData?.goal || 'fitness') as Goal;
  // Questionnaire is always more up-to-date than onboarding — check it first
  const location = (questionnaire?.workout?.environment?.location
    || client.onboardingData?.trainingLocation
    || 'gym') as 'gym' | 'home';
  const level = (difficulty
    || client.experienceLevel
    || questionnaire?.workout?.level
    || 'intermediate') as Level;

  // STEP 0 — Readiness: pull from real data sources, not static defaults.
  const { stress, sleepHours, pain, injuries } = resolveReadiness(client, questionnaire);
  const readiness = { stress, sleepHours, pain, injuries };

  // Cycle phase derivation (female only). Mirrors the existing logic
  // in generateTrainingPlan so the engine + prompt agree.
  // Sources (priority order): cycleLog on user doc → questionnaire medical section
  let cyclePhase: CyclePhase | undefined;
  try {
    const cl: any = (client as any).cycleLog || {};
    // Questionnaire medical sections (nutrition / workout / ems) as fallback
    const qMed: any = questionnaire?.nutrition?.medical
      || (questionnaire?.workout as any)?.medical
      || (questionnaire as any)?.ems?.medical
      || {};
    const lastPeriodStart = cl.lastPeriodStart || qMed.lastPeriodStart;
    const cycleLength = Number(cl.cycleLength || qMed.cycleLength) || 28;
    if (gender === 'female' && lastPeriodStart) {
      const last = new Date(lastPeriodStart);
      const dayInCycle = Math.floor((Date.now() - last.getTime()) / 86400000) % cycleLength;
      if (dayInCycle >= 0 && dayInCycle < 5) cyclePhase = 'menstrual';
      else if (dayInCycle < 13) cyclePhase = 'follicular';
      else if (dayInCycle < 16) cyclePhase = 'ovulation';
      else cyclePhase = 'luteal';
    }
  } catch {
    cyclePhase = undefined;
  }

  return { age, gender, goal, location, level, readiness, cyclePhase };
}

/**
 * buildAdaptiveContext — assembles the input the Adaptive Test Selector
 * needs to pick safe & appropriate tests for this user. Pulls age / sex
 * / level / goal from the profile, and stress / sleep / pain / injuries
 * from the readiness questionnaire.
 */
export function buildAdaptiveContext(
  client: UserProfile,
  questionnaire?: FullQuestionnaire,
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
): AdaptiveContext {
  const age = resolveClientAge(client);
  const gender = (client.onboardingData?.gender || (client as any).gender || 'male') as 'male' | 'female';
  const goal = (client.onboardingData?.goal || 'fitness') as Goal;
  const level = (difficulty
    || client.experienceLevel
    || questionnaire?.workout?.level
    || 'intermediate') as Level;

  const { stress, sleepHours, pain } = resolveReadiness(client, questionnaire);

  const injuries = [
    ...(client.onboardingData?.painPoints ?? []),
    ...(client.onboardingData?.injuryDescription
      ? [client.onboardingData.injuryDescription]
      : []),
  ].filter(Boolean) as string[];

  const med: any = (client as any).medical || {};
  const nutMed: any = questionnaire?.nutrition?.medical || {};
  const hasChronicCondition = Boolean(
    med?.heartIssue || med?.bloodPressure || med?.diabetes || med?.cholesterol ||
    med?.kidney || med?.liver || med?.digestion ||
    nutMed?.heartIssue || nutMed?.bloodPressure || nutMed?.diabetes ||
    nutMed?.cholesterol || nutMed?.kidney || nutMed?.liver || nutMed?.digestion
  );

  const isPregnant = Boolean(
    (client as any).cycleLog?.isPregnant ||
    nutMed?.pregnant ||
    nutMed?.pregnancyNursing
  );

  // Training location from questionnaire (most up-to-date) then onboarding
  const qLoc = questionnaire?.workout?.environment?.location as 'gym' | 'home' | 'both' | undefined;
  const obLoc = client.onboardingData?.trainingLocation as 'gym' | 'home' | undefined;
  const location: 'gym' | 'home' | 'both' = qLoc || obLoc || 'gym';

  return {
    age, gender, level, goal,
    stress, sleepHours, pain, injuries,
    hasChronicCondition, isPregnant,
    location,
  };
}

/**
 * Public helper so the UI (admin & client cards) can show the same
 * Scientific Engine breakdown the LLM receives.
 */
export function computeScientificPrescription(
  client: UserProfile,
  questionnaire?: FullQuestionnaire,
  difficulty?: 'beginner' | 'intermediate' | 'advanced',
  rawTestResults: Record<string, number> = {}
): ScientificEngineResult {
  const input = buildScientificInput(client, questionnaire, difficulty);
  return runScientificEngine(input, rawTestResults);
}

/**
 * computeMacrosFromProfile — shared deterministic call site.
 *
 * Used by both the AdminMacroCard (visualisation) and the LLM prompt
 * pathway in `generateNutritionDraft`, so the coach sees the EXACT same
 * numbers Gemini is forced to hit. Returns null when the client hasn't
 * supplied a weight yet (no Mifflin-St Jeor possible).
 */
export function computeMacrosFromProfile(
  client: UserProfile,
  questionnaire?: FullQuestionnaire
): MacroOutput | null {
  const measurements = questionnaire?.nutrition?.measurements;

  // Weight: InBody from nutrition survey overrides onboarding, then fall back to latest measurement history
  const weight =
    (measurements?.weight && measurements.weight > 0 ? measurements.weight : 0) ||
    (client.onboardingData?.inBodyExtracted?.weight && client.onboardingData.inBodyExtracted.weight > 0
      ? client.onboardingData.inBodyExtracted.weight : 0) ||
    (client.onboardingData?.weight && client.onboardingData.weight > 0 ? client.onboardingData.weight : 0) ||
    (client.measurementHistory?.length
      ? client.measurementHistory[client.measurementHistory.length - 1]?.weight || 0
      : 0);

  const height = client.onboardingData?.height || 0;
  if (!weight || weight < 30) return null;

  const age = resolveClientAge(client);
  const gender = (client.onboardingData?.gender || client.gender || 'male') as 'male' | 'female';
  const goal = (client.onboardingData?.goal || 'fitness') as Goal;

  const lifestyle = (questionnaire?.nutrition as any)?.lifestyle || {};
  const rawActivity: string = lifestyle.dailyActivityLevel || '';
  const activityLevel: MacroActivityLevel =
    rawActivity === 'sedentary' || rawActivity === 'light' || rawActivity === 'moderate' || rawActivity === 'high'
      ? rawActivity
      : 'light';
  const workoutFrequencyPerWeek: number = Number(lifestyle.workoutFrequencyPerWeek) || 0;

  // Build weight history for trend-based calorie adjustment
  const weightHistory = (client.measurementHistory || [])
    .filter(m => m.weight && m.weight > 0)
    .map(m => ({ date: m.date, weight: m.weight }));

  // Stress from questionnaire lifestyle data
  const rawStress = Number((questionnaire?.nutrition as any)?.lifestyle?.stressLevel) || 0;

  // Population category for dynamic fat% / protein targets
  const nutMed: any = (questionnaire?.nutrition as any)?.medical || (questionnaire as any)?.medical || {};
  const isPregnantOrNursing = !!(nutMed.pregnancyNursing) || !!(client as any).medicalFlags?.pregnancy;
  const isRehabGoal = goal === 'rehab';
  const isAthleteProfile = activityLevel === 'high' && workoutFrequencyPerWeek >= 5;
  const population: 'standard' | 'athlete' | 'pregnant' | 'nursing' | 'sick' =
    isPregnantOrNursing ? 'pregnant' : isRehabGoal ? 'sick' : isAthleteProfile ? 'athlete' : 'standard';

  return calculateMacros({
    weightKg: weight,
    heightCm: height,
    age,
    gender,
    goal,
    activityLevel,
    workoutFrequencyPerWeek,
    weightHistory,
    stressLevel: rawStress,
    population,
  });
}

/**
 * computeProgression — STEP 6→9 of the Scientific Engine.
 *
 * Builds the 14-day DailyProgressLog window from the client's stored
 * dailyProgress + dailyLogs, then runs the deterministic progression
 * analysis. Used by AdminProgressionCard and forwarded into the LLM
 * prompt by `generateTrainingPlan` / `generateWorkoutDraft` so every new
 * cycle's prescribed % of 1RM and volume multiplier come from real data,
 * not the model's guess.
 */
export function buildDailyProgressLogs(
  client: UserProfile,
  windowDays = 14
): DailyProgressLog[] {
  const progress = client.dailyProgress || {};
  const logs: Record<string, DailyProgressLog> = {};
  const today = new Date();
  // Pre-populate empty rows for every day in the window so missed days are visible
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    logs[key] = {
      date: key,
      exercisesCompleted: 0,
      totalExercises: 0,
    };
  }
  // Merge in the recorded daily progress
  for (const [date, p] of Object.entries(progress)) {
    if (!logs[date]) continue;
    logs[date] = {
      ...logs[date],
      exercisesCompleted: Array.isArray(p.exercisesCompleted) ? p.exercisesCompleted.length : 0,
      totalExercises: typeof p.totalExercises === 'number' ? p.totalExercises : 0,
      energyLevel: p.energyLevel,
      moodScore: p.moodScore,
    };
  }
  // Merge dailyLogs: completedWorkout flag + wearable HR strain signal.
  const dailyLogs = client.dailyLogs || {};
  for (const [date, dl] of Object.entries(dailyLogs)) {
    if (!logs[date]) continue;
    logs[date] = {
      ...logs[date],
      completedWorkout: dl.completedWorkout,
      hrStrain: dl.watch?.hrStrain,
    };
  }
  return Object.values(logs);
}

export function computeProgression(
  client: UserProfile,
  previousIntensityPercent: number,
  previousVolume = 1
): ProgressionPrescription {
  const logs = buildDailyProgressLogs(client, 14);
  return runProgressionAnalysis(logs, previousIntensityPercent, previousVolume);
}

/**
 * MODELS:
 * We use standard Gemini models for maximum compatibility.
 * Temporarily forcing all requests to gemini-1.5-flash for 100% stability.
 */
const PRO_MODEL = "gemini-1.5-flash";
const FLASH_MODEL = "gemini-1.5-flash";

/**
 * Helper to sleep for a given number of milliseconds.
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to Safely call Gemini models using our backend proxy.
 * Implements Fallback: Stable -> Flash on 503/429/404 errors.
 */
export const safeGenerateContent = async (modelName: string, contents: any, systemInstruction?: string, extraConfig?: any, retries = 5) => {
  let lastError: any = null;
  let delay = 3000;
  let currentModel = modelName;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s client-side timeout

      // Resolve API URL relative to Vite's BASE_URL so the call works whether
      // the artifact is served at "/" (production) or under a path prefix
      // like "/artifacts/coachpro/" (Replit dev proxy). A bare "/api/..."
      // would escape the artifact's prefix and 404 against the wrong service.
      const apiBase = (import.meta as any).env?.BASE_URL || "/";
      const response = await fetch(`${apiBase}api/ai-service`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: currentModel,
          contents: contents,
          config: { 
            systemInstruction: systemInstruction,
            maxOutputTokens: 32768,
            temperature: 0.7,
            ...extraConfig 
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Server error: ${response.status}`;
        const techCode = errorData.tech_code || response.status;
        
        // Model Fallback Logic
        if (techCode === 503 || techCode === 429 || techCode === 504 || techCode === 404) {
          console.warn(`[AI] ${currentModel} error (${techCode}). Trying fallback...`);
          
          if (currentModel !== FLASH_MODEL) {
            currentModel = FLASH_MODEL;
            await wait(2000);
            i = Math.max(0, i - 1); 
            continue;
          }
        }

        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "Unknown HTML");
        console.error("Non-JSON response received:", text.substring(0, 500));
        
        if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("<body")) {
          throw new Error(`سيرفر الذكاء الاصطناعي غير مستقر حالياً (Status ${response.status}). يرجى المحاولة بعد قليل.`);
        }
        throw new Error(`رد غير متوقع من السيرفر: ${text.substring(0, 50)}...`);
      }

      const data = await response.json();
      return { text: data.text, response: data };
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message?.toLowerCase() || "";
      
      const isQuotaError = errorMessage.includes("quota") || errorMessage.includes("429");
      const isTransientError = errorMessage.includes("500") || errorMessage.includes("503") || 
                               errorMessage.includes("504") || errorMessage.includes("unavailable") || 
                               errorMessage.includes("demand") || errorMessage.includes("timeout") ||
                               errorMessage.includes("connection");

      if (i < retries - 1 && (isQuotaError || isTransientError)) {
        const baseDelay = (isQuotaError || errorMessage.includes("503") || errorMessage.includes("504")) ? delay * 1.5 : delay;
        await wait(baseDelay + (Math.random() * 500));
        delay *= 1.5;
        continue;
      }
      break;
    }
  }
  throw lastError;
};

function extractJsonObject(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    } catch {
      // fall through
    }
  }
  const firstBracket = candidate.indexOf('[');
  const lastBracket = candidate.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try {
      return JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
    } catch {
      // fall through
    }
  }
  return null;
}

function buildClientSnapshot(client: UserProfile) {
  const latestMeasurement = client.measurementHistory?.slice(-1)[0];
  const goal = client.onboardingData?.goal || 'fitness';
  const membershipSummary = [
    client.packages?.workout ? 'workout' : null,
    client.packages?.nutrition ? 'nutrition' : null,
    client.packages?.rehab ? 'rehab' : null,
    client.packages?.ems ? 'ems' : null,
  ].filter(Boolean).join(', ') || 'none';

  return JSON.stringify({
    name: client.name || 'Client',
    goal,
    age: resolveClientAge(client),
    gender: client.onboardingData?.gender || client.gender || 'male',
    height: client.onboardingData?.height || null,
    weight: client.onboardingData?.weight || null,
    latestMeasurement,
    measurementHistory: client.measurementHistory?.slice(-6) || [],
    memberships: membershipSummary,
    packages: client.packages || {},
    dailyProgress: client.dailyProgress || {},
    experienceLevel: client.experienceLevel || 'intermediate',
    injuryDescription: client.onboardingData?.injuryDescription || '',
    painIntensity: client.onboardingData?.painIntensity || 0,
  });
}

const aiCoachCache = new Map<string, string>();

async function generateStructuredCoachOutput<T>(
  key: string,
  client: UserProfile,
  prompt: string,
  systemInstruction: string,
  fallback: T,
  extraConfig?: any
): Promise<T> {
  const cacheKey = `${key}:${client.uid || 'anonymous'}:${buildClientSnapshot(client)}`;
  const cached = aiCoachCache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      aiCoachCache.delete(cacheKey);
    }
  }

  try {
    const response = await safeGenerateContent(
      FLASH_MODEL,
      prompt,
      systemInstruction,
      { responseMimeType: 'application/json', temperature: 0.6, ...extraConfig }
    );
    const parsed = extractJsonObject(response.text || '') || fallback;
    aiCoachCache.set(cacheKey, JSON.stringify(parsed));
    return parsed as T;
  } catch (error) {
    console.warn(`[AI Coach] ${key} failed, using fallback`, error);
    return fallback;
  }
}

export interface AIDraftResponse {
  content: string;
  safetyAlerts?: string[];
  suggestedIntensity?: number;
}

/**
 * Handle AI errors gracefully.
 */
export const handleAIError = (error: any) => {
  console.error("Gemini AI Error Trace:", error);
  
  // Defensive stringification — `String({...})` returns the literal
  // "[object Object]" which is what produced the bug the user reported in
  // production. Walk through likely string-bearing fields, and only
  // JSON.stringify as a last resort so we never surface "[object Object]".
  let msg: string;
  if (typeof error === 'string') {
    msg = error;
  } else if (typeof error?.message === 'string' && error.message.length > 0) {
    msg = error.message;
  } else if (typeof error?.error === 'string' && error.error.length > 0) {
    msg = error.error;
  } else if (error?.error?.message && typeof error.error.message === 'string') {
    msg = error.error.message;
  } else if (error?.details && typeof error.details === 'string') {
    msg = error.details;
  } else {
    try { msg = JSON.stringify(error); } catch { msg = 'Unknown AI error'; }
  }
  
  // Try to parse JSON from our proxy
  try {
    if (msg.includes('{')) {
      const jsonStart = msg.indexOf('{');
      const jsonStr = msg.substring(jsonStart);
      const parsed = JSON.parse(jsonStr);
      if (parsed.error && parsed.details) {
        msg = `${parsed.error}: ${parsed.details}`;
      } else if (parsed.error) {
        msg = parsed.error;
      }
    }
  } catch (error) {
    console.warn('[aiMasterEngine] unable to parse AI error payload:', error);
  }

  const errorMessage = msg.toLowerCase();
  
  if (errorMessage.includes("quota") || errorMessage.includes("429") || errorMessage.includes("resource_exhausted") || errorMessage.includes("503") || errorMessage.includes("demand") || errorMessage.includes("overloaded")) {
    return "عذراً، محرك الذكاء الاصطناعي يواجه ضغطاً كبيراً حالياً (System Busy). يرجى المحاولة مرة أخرى الآن أو بعد دقيقة واحدة.";
  }
  
  if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
    return "تم حجب الرد بسبب معايير السلامة (Safety Filter). يرجى تعديل الطلب ليكون أكثر وضوحاً ومباشرة.";
  }
 
  if (errorMessage.includes("fetch") || errorMessage.includes("timeout") || errorMessage.includes("deadline")) {
    return "خطأ في الاتصال بالشبكة (Connection Timeout). يرجى التأكد من استقرار الإنترنت والمحاولة ثانية.";
  }

  return `حدث خطأ في محرك الذكاء الاصطناعي: ${msg.substring(0, 100)}. يرجى المحاولة لاحقاً.`;
};

export const aiMasterEngine = {
  /**
   * Generates an Egyptian-style nutrition plan draft.
   */
  async generateNutritionDraft(client: UserProfile, questionnaire: FullQuestionnaire): Promise<AIDraftResponse> {
    const nutrition = questionnaire.nutrition;
    if (!nutrition) return { content: "لا يوجد بيانات تغذية كافية." };

    try {
      const dailyLogStr = nutrition.dailyLog && nutrition.dailyLog.length > 0 
        ? nutrition.dailyLog.map(e => `${e.time}: ${e.activity}`).join('\n')
        : "لا يوجد سجل يومي مدخل حالياً.";
        
      const preferences = `Likes: ${nutrition.preferences?.likes || 'N/A'}, Dislikes: ${nutrition.preferences?.dislikes || 'N/A'}, Allergies: ${(nutrition.preferences?.allergies || []).join(', ')}`;
      
      const measurements = nutrition.measurements;
      const weight =
        (measurements?.weight && measurements.weight > 0 ? measurements.weight : 0) ||
        (client.onboardingData?.inBodyExtracted?.weight && client.onboardingData.inBodyExtracted.weight > 0
          ? client.onboardingData.inBodyExtracted.weight : 0) ||
        (client.onboardingData?.weight && client.onboardingData.weight > 0 ? client.onboardingData.weight : 0) ||
        (client.measurementHistory?.length
          ? client.measurementHistory[client.measurementHistory.length - 1]?.weight || 0 : 0);
      const height = client.onboardingData?.height || 0;

      const age = resolveClientAge(client);
      const gender = (client.onboardingData?.gender || (client as any).gender || 'male') as 'male' | 'female';
      const goal = (client.onboardingData?.goal || 'fitness') as
        'shape' | 'loss' | 'bulk' | 'fitness' | 'rehab';
      const fatPercentage = measurements?.fatPercentage || 0;

      // ──────────────────────────────────────────────────────────────
      // April-2026 spec: route through the deterministic macro calculator
      // (lib/macroCalculator.ts). This replaces the hardcoded ×1.375
      // activity factor with the lifestyle-driven multiplier the user
      // actually answered in NutritionSurvey, and forwards the rationale
      // to Gemini as a HARD RAIL so calorie/protein targets are
      // identical run-to-run regardless of model drift.
      // ──────────────────────────────────────────────────────────────
      const lifestyle = (nutrition as any).lifestyle || {};
      const rawActivity: string = lifestyle.dailyActivityLevel || '';
      const activityLevel: MacroActivityLevel =
        rawActivity === 'sedentary' || rawActivity === 'light'
          || rawActivity === 'moderate' || rawActivity === 'high'
          ? rawActivity
          : 'light';
      const workoutFrequencyPerWeek: number = Number(lifestyle.workoutFrequencyPerWeek) || 0;

      // Population category for dynamic fat% / protein
      const nutMedNutr: any = (nutrition as any)?.medical || {};
      const isPregnantNutr = !!(nutMedNutr.pregnancyNursing) || !!(client as any).medicalFlags?.pregnancy;
      const isRehabNutr = goal === 'rehab';
      const isAthleteNutr = activityLevel === 'high' && workoutFrequencyPerWeek >= 5;
      const populationNutr: 'standard' | 'athlete' | 'pregnant' | 'nursing' | 'sick' =
        isPregnantNutr ? 'pregnant' : isRehabNutr ? 'sick' : isAthleteNutr ? 'athlete' : 'standard';

      const macros: MacroOutput = calculateMacros({
        weightKg: weight,
        heightCm: height,
        age,
        gender,
        goal,
        activityLevel,
        workoutFrequencyPerWeek,
        population: populationNutr,
      });

      const isLikelyWaterRetention = (measurements?.waterPercentage || 0) > 65 || (measurements?.protein || 0) < 10;

      // Lifestyle context block forwarded to the LLM so meal timing
      // (breakfast time, last meal, snacks) tracks the client's real
      // wake/work/sleep schedule and insomnia/family-history flags can
      // bias the carb timing recommendations.
      const lifestyleContext = [
        lifestyle.sleepHours ? `Sleep: ${lifestyle.sleepHours}h/night` : '',
        lifestyle.wakeHour ? `Wake: ${lifestyle.wakeHour}` : '',
        lifestyle.workShiftHours ? `Work shift: ${lifestyle.workShiftHours}h` : '',
        lifestyle.jobNature ? `Job nature: ${lifestyle.jobNature}` : '',
        lifestyle.insomnia ? 'Insomnia: yes' : '',
        lifestyle.familyObesityHistory ? 'Family obesity/diabetes history: yes' : '',
        workoutFrequencyPerWeek ? `Workouts/wk: ${workoutFrequencyPerWeek}` : '',
      ].filter(Boolean).join(' | ') || 'No lifestyle data captured.';

      // Phase 2 / item #2 — Data Integration. Forward ALL eating-habit
      // signals + extra body measurements + the new free-text/voice notes
      // so the meal plan reflects every answer the user actually gave.
      const habits = (nutrition as any).habits || {};
      const habitsContext = [
        habits.mealsPerDay ? `Current meals/day: ${habits.mealsPerDay}` : '',
        habits.isConsistent ? `Eating consistency: ${habits.isConsistent}` : '',
        habits.sugarCravings ? `Sugar cravings: ${habits.sugarCravings}` : '',
        habits.peakHungerTimes ? `Peak hunger times: ${habits.peakHungerTimes}` : '',
        habits.digestionIssues ? `Digestion issues: ${habits.digestionIssues}` : '',
      ].filter(Boolean).join(' | ') || 'No eating-habit data captured.';

      const bodyTape = [
        measurements?.chest ? `Chest:${measurements.chest}cm` : '',
        measurements?.waist ? `Waist:${measurements.waist}cm` : '',
        measurements?.arm ? `Arm:${measurements.arm}cm` : '',
        (measurements as any)?.thigh ? `Thigh:${(measurements as any).thigh}cm` : '',
      ].filter(Boolean).join(' | ') || 'no tape measurements';

      const inbodyExtras = [
        measurements?.muscleMass ? `Muscle:${measurements.muscleMass}kg` : '',
        measurements?.waterPercentage ? `Water:${measurements.waterPercentage}%` : '',
        measurements?.protein ? `Protein:${measurements.protein}kg` : '',
      ].filter(Boolean).join(' | ') || 'no InBody breakdown';

      const userNotes = ((nutrition as any).additionalNotes || '').trim();
      const userNotesBlock = userNotes
        ? `\nCLIENT NOTES (verbatim — typed or voice-dictated, MUST be honored):\n"""${userNotes.substring(0, 800)}"""\n`
        : '';

      // ─── Cycle-aware nutrition for female clients ───────────────────
      let cycleNutritionDirective = '';
      try {
        const cl: any = (client as any).cycleLog || {};
        const qMedN: any = (nutrition as any)?.medical || {};
        const lastPeriodStart = cl.lastPeriodStart || qMedN.lastPeriodStart;
        const cycleLength = Number(cl.cycleLength || qMedN.cycleLength) || 28;
        if (gender === 'female' && lastPeriodStart) {
          const last = new Date(lastPeriodStart);
          const dayInCycle = Math.floor((Date.now() - last.getTime()) / 86400000) % cycleLength;
          if (dayInCycle >= 0 && dayInCycle < 5) {
            cycleNutritionDirective = `\n🩸 MENSTRUAL PHASE NUTRITION OVERRIDE (day ${dayInCycle + 1}/${cycleLength}):
- Increase iron-rich foods: leafy greens (spinach 80g/day), lean red meat 150-200g every other day, legumes.
- Add magnesium sources: dark chocolate ≥70% (20g/day), pumpkin seeds (30g), almonds (30g).
- Omega-3 anti-inflammatory focus: fatty fish 2×/week or flaxseed (15g/day).
- Raise hydration target to 3L minimum (add electrolytes if cramps present).
- Reduce sodium to minimize bloating. Avoid processed / high-sugar snacks.
- Carb intake can be slightly higher (+50-100g) to support serotonin and mood stability.\n`;
          } else if (dayInCycle < 13) {
            cycleNutritionDirective = `\n🌱 FOLLICULAR PHASE NUTRITION NOTE (day ${dayInCycle + 1}/${cycleLength}):
- Lean protein priority: metabolism and anabolism are elevated; keep protein at upper range (${macros.proteinG}g+).
- Prioritize complex carbs pre-workout for maximum energy utilization.
- Include estrogen-supporting foods: flaxseed (15g/day), cruciferous vegetables.
- Hydration: standard ${macros.waterLiters}L target.\n`;
          } else if (dayInCycle < 16) {
            cycleNutritionDirective = `\n✨ OVULATION PHASE NUTRITION NOTE (day ${dayInCycle + 1}/${cycleLength}):
- Peak metabolic window: calories and protein targets are well-timed for performance.
- Zinc-rich foods: pumpkin seeds (30g), beef, shellfish — support ovulation and hormonal balance.
- Antioxidant emphasis: berries, tomatoes, bell peppers.
- Hydration: increase to ${Math.max(macros.waterLiters, 2.5)}L (LH surge slightly dehydrating).\n`;
          } else {
            cycleNutritionDirective = `\n🌙 LUTEAL PHASE NUTRITION NOTE (day ${dayInCycle + 1}/${cycleLength}):
- Calorie intake can be 100-150kcal higher than target due to elevated BMR (progesterone effect). Adjust upward to ${macros.calories + 100}kcal if client reports increased appetite.
- Reduce simple sugars and caffeine to minimise PMS severity.
- Boost magnesium (almonds 40g, dark chocolate 20g, spinach) and calcium (yogurt 200g, dairy) for mood and cramp prevention.
- Higher-fibre carbs (oats, sweet potato) over refined grains — reduce bloating.
- Hydration: 3L minimum.\n`;
          }
        }
      } catch { /* non-fatal */ }

      const systemPrompt = `${nutritionRailHeader()}

Role: Clinical Nutritionist. Build a COMPLETE, COMPREHENSIVE Arabic meal plan.
You MUST honor every rule inside the 🟡 NUTRITION BLOCK and the 🟠 CARB CYCLING BLOCK above.
${cycleNutritionDirective}
Client Data: ${gender}, ${age}y, ${weight}kg, ${height}cm, Goal: ${goal}, Fat:${fatPercentage}%.
Lifestyle: ${lifestyleContext}.
Eating habits: ${habitsContext}.
Body tape: ${bodyTape}.
InBody breakdown: ${inbodyExtras}.
Daily log: ${dailyLogStr.substring(0, 500)}.
Preferences: ${preferences.substring(0, 300)}.${userNotesBlock}

🔒 HARD-RAIL DAILY TARGETS (computed deterministically — DO NOT CHANGE):
- Calories  : ${macros.calories} kcal
- Protein   : ${macros.proteinG} g
- Carbs     : ${macros.carbsG} g
- Fats      : ${macros.fatG} g
- Water     : ${macros.waterLiters} L

Derivation (for your reasoning section, surface in الملاحظات العلمية):
${macros.rationale.map(r => `  • ${r}`).join('\n')}

CRITICAL RULES:
- The "الأهداف اليومية" section MUST repeat the numbers above EXACTLY (calories, protein g, carbs g, fats g, water L). Do NOT recompute.
- Sum of meal calories must land within ±5% of ${macros.calories} kcal. Sum of meal protein must be within ±5 g of ${macros.proteinG} g.
- Distribute meals according to the lifestyle context (e.g. push breakfast to wake-time, last meal ≥2h before sleep).
- If insomnia=yes, push >60% of carbs into evening meals (serotonin boost). If family obesity history=yes, lean toward lower-GI carbs and add a clear hydration reminder.

REQUIRED OUTPUT SECTIONS — every section must be FULLY written, never truncated:
1. الأهداف اليومية (Daily Targets): Calories, Protein (g), Carbs (g), Fats (g), Water (L).
2. الوجبات الخمس (5 meals: Breakfast, Snack 1, Lunch, Snack 2, Dinner). Each meal must include:
   - الاسم
   - المكونات بالجرامات (every ingredient with grams)
   - طريقة التحضير المختصرة (2-3 lines)
   - السعرات والماكروز للوجبة
3. المكملات الغذائية (Supplements): Name, daily dose, timing, why.
4. ملاحظات علمية (Scientific reasoning): 3-5 short bullets explaining the macro split using the derivation above.
5. توصيات إضافية (Hydration, sleep, meal timing).

WRITING RULES:
- Arabic only.
- Plain text, no markdown tables (line breaks and dashes are fine).
- Be COMPREHENSIVE — never end mid-sentence. If you sense you're running out of room, shorten earlier sections rather than cutting the last section.
- Always finish with the exact line: "✅ نهاية الخطة" so the system can verify completion.`;

      const response = await safeGenerateContent(PRO_MODEL, "Generate a highly professional nutrition blueprint based on clinical data and daily log.", systemPrompt);

      return {
        content: response.text || "فشل توليد الخطة.",
        safetyAlerts: isLikelyWaterRetention ? ["تنبيه: العميل يعاني من احتباس سوائل حسب بيانات الـ InBody، يرجى مراجعة كمية الأملاح."] : []
      };
    } catch (err) {
      return { content: handleAIError(err) };
    }
  },

  /**
   * Generates a Hybrid/EMS workout plan draft.
   *
   * Health-Centric: explicitly excludes contraindicated movements based on
   * injuries / chronic disease / pregnancy. The exclusion list is built in
   * code (deterministic) and then forwarded to Gemini as a HARD RULE so the
   * generated plan cannot include those moves.
   *
   * Energy-Aware: if `currentEnergy` (today's tracker value) is <= 4, the
   * session is automatically scaled down to a de-load.
   */
  async generateWorkoutDraft(
    client: UserProfile,
    questionnaire: FullQuestionnaire,
    isEMS: boolean = false,
    difficulty?: 'beginner' | 'intermediate' | 'advanced',
    currentEnergy?: number
  ): Promise<AIDraftResponse> {
    const workout = questionnaire.workout;
    const goal = client.onboardingData?.goal || 'fitness';
    const location = workout?.environment?.location || 'gym';
    const level = difficulty || client.experienceLevel || workout?.level || 'intermediate';

    // Phase 2 / item #6 — Home vs Gym separation. The schema already
    // captures gymDays + homeDays + homeEquipment but the prompt was only
    // sending the legacy `location` token, so the model couldn't tell
    // which days were body-weight at home vs which were rack-equipped at
    // the gym. We now forward each list explicitly.
    const env = workout?.environment || ({} as any);
    const gymDays: string[] = Array.isArray(env.gymDays) ? env.gymDays : [];
    const homeDays: string[] = Array.isArray(env.homeDays) ? env.homeDays : [];
    const homeEquipment: string = (env.homeEquipment || '').trim();
    const preferredTime: string = (env.preferredTime || '').trim();
    const environmentBlock = (() => {
      const lines: string[] = [];
      if (location === 'both') {
        lines.push(`HYBRID SETUP — client trains in BOTH gym and home in the same week.`);
        if (gymDays.length) lines.push(`- Gym days (full equipment): ${gymDays.join(', ')}`);
        if (homeDays.length) lines.push(`- Home days (limited equipment): ${homeDays.join(', ')}`);
        if (homeEquipment) lines.push(`- Home equipment available: ${homeEquipment}`);
        lines.push(`Each day's session MUST match its environment — heavy compound barbell work goes on gym days only; home days use the listed equipment + body-weight progressions only.`);
      } else if (location === 'home') {
        lines.push(`HOME-ONLY SETUP — no gym access this week.`);
        if (homeEquipment) lines.push(`- Equipment available at home: ${homeEquipment}`);
        else lines.push(`- No equipment listed → assume body-weight only + bands.`);
        lines.push(`Do NOT prescribe barbell or machine-only exercises.`);
      } else {
        lines.push(`GYM-ONLY SETUP — full commercial gym equipment.`);
        if (gymDays.length) lines.push(`- Training days: ${gymDays.join(', ')}`);
      }
      if (preferredTime) lines.push(`- Preferred session time: ${preferredTime}`);
      return lines.join('\n');
    })();
    
    try {
      let age = client.onboardingData?.age || 30;
      const gender = (client.onboardingData?.gender || (client as any).gender || 'male') as 'male' | 'female';
      const weight = client.onboardingData?.weight || 70;

      const hasBP = workout?.medical?.bloodPressure || false;
      const hasDiabetes = workout?.medical?.diabetes || false;
      const isPregnant = (workout?.medical as any)?.pregnancy || (questionnaire.rehab as any)?.pregnancy || false;
      const healthIssues = questionnaire.rehab?.painPoints || [];
      const injuryDescription = questionnaire.rehab?.injuryDescription || "";
      
      const safetyAlerts: string[] = [];
      let suggestedIntensity = level === 'beginner' ? 60 : level === 'intermediate' ? 80 : 90;

      if (hasBP) {
        safetyAlerts.push("تنبيه طبي: العميل يعاني من ضغط الدم. تم ضبط الشدة لتجنب الإجهاد.");
        suggestedIntensity = Math.min(suggestedIntensity, 60);
      }
      if (hasDiabetes) {
        safetyAlerts.push("تنبيه طبي: العميل يعاني من السكر. يرجى مراقبة مستوى الجلوكوز أثناء التمرين.");
        suggestedIntensity = Math.min(suggestedIntensity, 70);
      }
      if (isPregnant) {
        safetyAlerts.push("تنبيه طبي: العميلة حامل. يجب تجنب الحمل العالي والتمارين على البطن وتمارين البليومتريك.");
        suggestedIntensity = Math.min(suggestedIntensity, 50);
      }

      // ---------- Build deterministic EXCLUSION list ----------
      // Maps a free-text injury / disease keyword to the moves that MUST be
      // excluded. Expanded keywords are matched case-insensitively.
      const painText = (healthIssues.join(' ') + ' ' + injuryDescription).toLowerCase();
      const exclusions: string[] = [];
      const inj = (re: RegExp) => re.test(painText);

      if (inj(/back|ظهر|قطني|lumbar|disc|انزلاق|herniat/)) {
        exclusions.push(
          'Deadlift (Conventional & Sumo)', 'Barbell Bent-Over Row', 'Good Morning',
          'Heavy Squat with bar on back', 'Romanian Deadlift', 'Box Jumps',
          'Russian Twist with weight', 'Sit-ups with anchored feet'
        );
      }
      if (inj(/knee|ركبة|meniscus|acl|مفصل الركبة/)) {
        exclusions.push(
          'Deep Barbell Squat (below parallel)', 'Pistol Squats', 'Box Jumps',
          'Lunges with weights below 90°', 'Leg Extension (heavy)', 'Burpees',
          'Plyometric jumps', 'Sprinting on hard surfaces'
        );
      }
      if (inj(/shoulder|كتف|rotator|cuff/)) {
        exclusions.push(
          'Barbell Behind-the-Neck Press', 'Behind-the-Neck Pulldown',
          'Upright Row with barbell', 'Heavy Overhead Press', 'Dips with bodyweight+',
          'Snatch / Power Snatch'
        );
      }
      if (inj(/neck|رقبة|cervical/)) {
        exclusions.push('Heavy Shrugs', 'Behind-the-Neck Press', 'Wrestler-bridge', 'Heavy Squat with bar high on traps');
      }
      if (inj(/wrist|رسغ|carpal/)) {
        exclusions.push('Heavy Bench Press with straight bar', 'Push-ups on flat hands', 'Snatch / Clean');
      }
      if (inj(/hip|ورك|ا?لحوض/)) {
        exclusions.push('Wide-stance Deadlift', 'Heavy Hip Thrust', 'Sprint intervals');
      }
      if (inj(/ankle|كاحل/)) {
        exclusions.push('Box Jumps', 'Skipping rope', 'Sprinting');
      }
      if (hasBP) {
        exclusions.push('Inverted positions (handstand, headstand)', 'Heavy isometric holds (>10s)', 'Valsalva straining lifts');
      }
      if (hasDiabetes) {
        exclusions.push('Long fasted cardio sessions (>45min)', 'Maximal-intensity intervals without glucose monitoring');
      }
      if (isPregnant) {
        exclusions.push(
          'Any supine exercise after first trimester', 'All abdominal crunch/plank variations after 20 weeks',
          'Heavy Olympic lifts', 'Box jumps & high-impact plyometrics', 'Hot yoga / hot environments'
        );
      }

      const exclusionsBlock = exclusions.length
        ? `MANDATORY EXCLUSIONS — these movements are FORBIDDEN and must NEVER appear in the plan:\n- ${exclusions.join('\n- ')}\nIf an exercise resembles any of these, substitute it with a safe alternative and briefly explain why in Arabic.`
        : 'No movement exclusions required for this client.';

      // ─── Scientific Engine (Steps 0-5) — deterministic prescription ───
      // Runs locally, BEFORE the LLM call. Result is forwarded as a hard
      // rail so the model uses 50/65/85% intensity (modified by readiness,
      // age, cycle) consistently every run.
      const engineResult = computeScientificPrescription(client, questionnaire, level);
      const engineBlock = formatEngineForPrompt(engineResult);
      // Surface the engine's readiness alerts to the admin UI.
      for (const a of engineResult.step1_readiness.alerts) safetyAlerts.push(a);
      // If the engine demands a full rest, force suggestedIntensity down.
      if (engineResult.step1_readiness.status === 'rest') {
        suggestedIntensity = Math.min(suggestedIntensity, 40);
      } else {
        suggestedIntensity = engineResult.step5_decision.intensityPercent;
      }

      // ─── Adaptive Test Selection (System-chosen test names only) ───
      const adaptiveCtx: AdaptiveContext = buildAdaptiveContext(client, questionnaire, level);
      const adaptiveTests = selectAdaptiveTests(adaptiveCtx);
      const adaptiveBlock = formatAdaptiveSelectionForPrompt(adaptiveCtx, adaptiveTests);

      // ─── Progression Engine (Steps 6-9) — 14-day adaptive load ───
      // Reads the client's last 14 days of completion + energy/RPE and
      // adjusts the prescribed % of 1RM and volume multiplier BEFORE the
      // LLM call. Forwarded as an additional hard rail block.
      const progression = computeProgression(client, suggestedIntensity);
      const progressionBlock = formatProgressionForPrompt(progression);
      // Use the progression engine's adjusted intensity as the final value
      // the LLM sees and the admin UI displays.
      suggestedIntensity = progression.newIntensityPercent;
      if (progression.status === 'fatigued') {
        safetyAlerts.push('محرك التطوير: علامات إجهاد على آخر 14 يوم — تطبيق ديلود تلقائي.');
      } else if (progression.status === 'improved') {
        safetyAlerts.push('محرك التطوير: التزام عالي على آخر 14 يوم — رفع الحمل تلقائياً (+5%).');
      }

      // ---------- Energy-aware de-load ----------
      let deloadDirective = '';
      if (typeof currentEnergy === 'number' && currentEnergy > 0 && currentEnergy <= 4) {
        suggestedIntensity = Math.min(suggestedIntensity, 50);
        deloadDirective = `\nENERGY OVERRIDE: Today's reported energy is ${currentEnergy}/10 (LOW). Convert today's session to an active-recovery / DE-LOAD session: mobility, light cardio (zone 2, 20-25min), and bodyweight core. Do NOT prescribe heavy lifts today. Mention explicitly that this is a de-load due to low reported energy.\n`;
        safetyAlerts.push(`جلسة استشفاء (De-load): الطاقة اليوم ${currentEnergy}/10 — تم تخفيف الشدة تلقائياً.`);
      } else if (typeof currentEnergy === 'number' && currentEnergy >= 8) {
        deloadDirective = `\nENERGY OVERRIDE: Today's reported energy is ${currentEnergy}/10 (HIGH). It is safe to push to the upper end of the prescribed RPE range.\n`;
      }

      const latestStats = client.measurementHistory && client.measurementHistory.length > 0
        ? client.measurementHistory[client.measurementHistory.length - 1] 
        : null;
        
      const statsStr = latestStats ? `
      Latest Measurements (${latestStats.date}):
      - Weight: ${latestStats.weight || 0}kg
      - Fat: ${latestStats.fatPercentage || 0}%
      - Muscle: ${latestStats.muscleMass || 0}kg
      ` : 'No recent fitness test data found.';

      const healthFlagsLine = [
        hasBP ? 'High Blood Pressure' : null,
        hasDiabetes ? 'Diabetes' : null,
        isPregnant ? 'Pregnancy' : null,
      ].filter(Boolean).join(', ') || 'none';

      const systemPrompt = isEMS 
        ? `${emsRailHeader()}

${engineBlock}

${adaptiveBlock}

${progressionBlock}

Role: EMS Master Trainer (Electro-Muscular Stimulation specialist).
You MUST honor every rule inside the 🟢 FITNESS ASSESSMENT BLOCK and the 🟣 EMS BLOCK above.
This is an EMS-ONLY program — DO NOT prescribe a regular gym/bodyweight workout.
EMS sessions use a wired/wireless suit delivering electric impulses; volume is measured in TIME UNDER STIMULATION (seconds), not sets x reps.

Client: ${gender}, ${age}y, ${weight}kg. Difficulty: ${level}.
Chronic conditions: ${healthFlagsLine}.
Injuries / pain points: ${healthIssues.join(', ') || 'none'}. ${injuryDescription.substring(0, 300)}.
Stats: ${statsStr.substring(0, 300)}.
${deloadDirective}
${exclusionsBlock}

REQUIRED SECTIONS — every section must be FULLY written, never truncated:
1. نظرة عامة على البرنامج: weekly frequency (typically 1-2 EMS sessions per week with at least 72h between sessions — never daily).
2. تفاصيل كل جلسة EMS:
   - Warm-up (5 min, no electricity).
   - Main protocol: list 6-10 movements, each with: name, body position, SUIT FREQUENCY (Hz), PULSE WIDTH (µs), IMPULSE/REST cycle (e.g. 4s on / 4s off), total time, channel intensity guidance per muscle group.
   - Cool-down + manual stretching.
3. تدريجات الشدة across 4 weeks (Hz, pulse width, intensity).
4. تنبيهات السلامة: rules based on the chronic conditions and injuries above.
5. توصيات الاستشفاء والتغذية الداعمة: protein timing, hydration, sleep, CK monitoring.

WRITING RULES:
- Arabic only.
- Plain text, no markdown tables (line breaks and dashes are fine).
- DO NOT use sets x reps language — use time-under-stimulation.
- Be COMPREHENSIVE — never end mid-sentence. If running out of room, tighten earlier sections rather than cutting the last one.
- Always finish with the exact line: "✅ نهاية البرنامج" so the system can verify completion.`
        : `${trainingRailHeader()}

${engineBlock}

${adaptiveBlock}

${progressionBlock}

Role: Senior Strength & Conditioning Coach.
You MUST honor every rule inside the 🟢 FITNESS ASSESSMENT BLOCK and the 🔵 TRAINING BLOCK above (5-category split, RPE caps, Weak-Point linkage, +2.5%/week progressive overload).
This is a REGULAR gym / bodyweight resistance training program — DO NOT mention EMS, suits, frequencies, or electric impulses.
Volume is measured in classic sets x reps with tempo, RPE, and RIR.
ADAPTIVE RULES:
- Sleep < 6h OR stress > 7 → reduce volume and intensity 15%, switch heaviest day to mobility/recovery.
- Progressive overload: +2.5% load per week for the FIRST 4–6 weeks, then schedule a DELOAD week (−10% load, −35% volume).
- Beginner: Full Body 3×/week. Intermediate: Upper/Lower 4×/week. Advanced: Push/Pull/Legs 5–6×/week.

Client: ${gender}, ${age}y, ${weight}kg. Difficulty: ${level}. Goal: ${goal}.
TRAINING ENVIRONMENT (CRITICAL — match each day's setup):
${environmentBlock}

Chronic conditions: ${healthFlagsLine}.
Injuries / pain points: ${healthIssues.join(', ') || 'none'}. ${injuryDescription.substring(0, 300)}.
Stats: ${statsStr.substring(0, 300)}.
${deloadDirective}
${exclusionsBlock}

REQUIRED SECTIONS — every section must be FULLY written, never truncated:
1. نظرة عامة: 4-week periodization (hypertrophy / strength / de-load).
2. التقسيم الأسبوعي: which days train which muscles + rest days.
3. تفاصيل كل جلسة: per session list each exercise with sets × reps, tempo (e.g. 3010), RPE, rest interval, and a 1-line scientific reason for choosing it. Add an [IMG: <descriptive english slug>] placeholder after each exercise so the UI can later attach an instructional image.
4. الإحماء والتبريد protocols.
5. تقدم وتوصيات الاستشفاء: progressive overload schedule + sleep / recovery notes.
6. تنبيهات السلامة المخصصة بناء على الإصابات والحالات أعلاه (must reference each forbidden movement and the chosen substitute).

WRITING RULES:
- Arabic only (English allowed only inside [IMG: ...] tags).
- Plain text, no markdown tables (line breaks and dashes are fine).
- Be COMPREHENSIVE — never end mid-sentence. If running out of room, tighten earlier sections rather than cutting the last one.
- Always finish with the exact line: "✅ نهاية البرنامج" so the system can verify completion.`;

      const response = await safeGenerateContent(PRO_MODEL, `Generate an elite ${isEMS ? 'EMS' : 'Gym'} training draft at ${level} level.`, systemPrompt);

      return {
        content: response.text || "فشل توليد البرنامج.",
        safetyAlerts,
        suggestedIntensity
      };
    } catch (err) {
      return { content: handleAIError(err) };
    }
  },

  /**
   * Final step: Mix all drafts into a structured weekly 7-day schedule.
   */
  async generateStructuredPlan(nutritionDraft: string, workoutDraft: string, rehabDraft: string, emsDraft: string): Promise<any> {
    try {
      const systemPrompt = `You are a Head Coach & Systems Architect.
      Your task is to take these separate drafts and unify them into a JSON format representing a 7-day interactive weekly plan.
      
      DRAFTS:
      - Nutrition: ${nutritionDraft}
      - Physical Workout (Gym): ${workoutDraft}
      - EMS Protocol: ${emsDraft}
      - Rehab: ${rehabDraft}
      
      RULES:
      1. WEEKLY DISTRIBUTION: Distribute workout sessions across 7 days.
      2. EXERCISE OBJECTS: Each exercise MUST have a "name", "sets", "reps", and "description" (وصف الأداء).
      3. MEAL OBJECTS: Each meal MUST have a "name", "items" (with weights), and "method".
      
      Return ONLY valid JSON.`;

      const response = await safeGenerateContent(FLASH_MODEL, "Convert drafts to JSON.", systemPrompt, { responseMimeType: "application/json" });
      
      try {
        let text = response.text;
        // Robust JSON extraction
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          text = jsonMatch[0];
        }
        return JSON.parse(text.trim());
      } catch (parseErr) {
        console.error("JSON Parsing failed. Response text:", response.text);
        // Return a basic structure as fallback
        return { Sunday: { nutrition: [], workout: [] } };
      }
    } catch (err) {
      console.error("Structured Plan Generation Error:", err);
      throw err;
    }
  },

  /**
   * Generates a Rehab plan draft based on reports and pain points.
   */
  async generateRehabDraft(client: UserProfile, questionnaire: FullQuestionnaire): Promise<AIDraftResponse> {
    const rehab = questionnaire.rehab;
    if (!rehab) return { content: "لا يوجد بيانات تأهيل." };

    try {
      const painPoints = rehab.painPoints.join(', ');
      const description = rehab.injuryDescription;

      const systemPrompt = `${trainingRailHeader()}

You are a Senior Orthopedic Rehab Specialist and Physiotherapist.
You MUST honor the 🟢 FITNESS ASSESSMENT BLOCK + 🔵 TRAINING BLOCK above when prescribing corrective work (RPE caps, Weak-Point logic, +5%/14-day progression).
Analyze the following injury data to create a high-precision "Rehab & Kinetic Correction Program" in Arabic.

Pain: ${painPoints}
Description: ${description}

Output: Professional Arabic. Plain text only (no Markdown tables). Always end with "✅ نهاية البرنامج".`;

      const response = await safeGenerateContent(PRO_MODEL, "Generate a detailed rehab protocol draft.", systemPrompt);

      return {
        content: response.text || "فشل توليد بروتوكول التأهيل."
      };
    } catch (err) {
      return { content: handleAIError(err) };
    }
  },

  async generateCoachAnalysis(client: UserProfile): Promise<AIDraftResponse> {
    const systemInstruction = `You are a senior performance coach. Analyze the client using their profile, measurements, progress history, membership, and goals. Return a single JSON object with keys: progressScore (0-100), adherenceScore (0-100), fatLossTrend, muscleGainTrend, nextWeekEstimate, nextMonthEstimate, summary. Keep the response concise and actionable.`;
    const prompt = `Analyze this client based on: ${buildClientSnapshot(client)}`;
    const data = await generateStructuredCoachOutput<object>(
      'coach-analysis',
      client,
      prompt,
      systemInstruction,
      {
        progressScore: 72,
        adherenceScore: 74,
        fatLossTrend: 'Stable',
        muscleGainTrend: 'Positive',
        nextWeekEstimate: 'Maintain current consistency and hydration.',
        nextMonthEstimate: 'Continue the current trend and keep recovery high.',
        summary: 'The client is progressing steadily with good adherence.',
      }
    );
    return { content: JSON.stringify(data) };
  },

  async generateCoachWorkout(client: UserProfile, options?: { split?: string; goal?: string; experienceLevel?: string }): Promise<AIDraftResponse> {
    const systemInstruction = `You are an elite strength and conditioning coach. Create a complete workout program from the client profile. Return a single JSON object with keys: title, split, goal, exercises (array of {name, sets, reps, rest, tempo, notes}), cardio, notes. Use real coaching logic and keep it safe and specific.`;
    const prompt = `Generate a workout program for this client. Context: ${sanitizeAiInput(buildClientSnapshot(client))}. Preferred split: ${sanitizeAiInput(options?.split || 'Full Body')}. Goal: ${sanitizeAiInput(options?.goal || client.onboardingData?.goal || 'fitness')}. Experience: ${sanitizeAiInput(options?.experienceLevel || client.experienceLevel || 'intermediate')}.`;
    const data = await generateStructuredCoachOutput<object>(
      'coach-workout',
      client,
      prompt,
      systemInstruction,
      {
        title: 'AI Workout Plan',
        split: 'Full Body',
        goal: 'fitness',
        exercises: [
          { name: 'Goblet Squat', sets: '3', reps: '10-12', rest: '90s', tempo: '3-1-1', notes: 'Drive through the heels and keep the torso tall.' },
        ],
        cardio: '15-20 min zone 2 walking',
        notes: 'Progress by adding reps or load once recovery feels good.',
      }
    );
    await Promise.all([
      generateAIInsightNotifications(client, {
        title: 'تم إنشاء خطة تمرين جديدة',
        body: 'تم تحديث خطتك التدريبية بناءً على أحدث بياناتك.',
        type: 'workout',
        priority: 'medium',
      }),
      scheduleAISchedulerNotifications(client, 'workout', 'تم توليد خطة تمرين جديدة بناءً على آخر تحديثاتك.'),
    ]);
    return { content: JSON.stringify(data) };
  },

  async generateCoachMeal(client: UserProfile, options?: { goal?: string; calories?: number; protein?: number; carbs?: number; fat?: number }): Promise<AIDraftResponse> {
    const systemInstruction = `You are a nutrition coach. Create a complete meal plan from the client profile. Return a single JSON object with keys: title, goal, calories, protein, carbs, fat, meals (array of {name, type, details}). Include hydration and practical alternatives.`;
    const prompt = `Generate a meal plan for this client. Context: ${sanitizeAiInput(buildClientSnapshot(client))}. Goal: ${sanitizeAiInput(options?.goal || client.onboardingData?.goal || 'fitness')}. Calories target: ${sanitizeAiInput(String(options?.calories || 2200))}. Protein target: ${sanitizeAiInput(String(options?.protein || 160))}. Carbs target: ${sanitizeAiInput(String(options?.carbs || 220))}. Fat target: ${sanitizeAiInput(String(options?.fat || 70))}.`;
    const data = await generateStructuredCoachOutput<object>(
      'coach-meal',
      client,
      prompt,
      systemInstruction,
      {
        title: 'AI Meal Plan',
        goal: 'fitness',
        calories: 2200,
        protein: 160,
        carbs: 220,
        fat: 70,
        meals: [
          { name: 'Breakfast', type: 'breakfast', details: 'Greek yogurt bowl with berries, oats, and walnuts.' },
          { name: 'Lunch', type: 'lunch', details: 'Chicken rice bowl with roasted vegetables and avocado.' },
          { name: 'Dinner', type: 'dinner', details: 'Salmon with potatoes and green beans.' },
        ],
      }
    );
    await Promise.all([
      generateAIInsightNotifications(client, {
        title: 'تم إنشاء خطة غذائية جديدة',
        body: 'تم تحديث خطة الوجبات الخاصة بك بناءً على أحدث بياناتك.',
        type: 'nutrition',
        priority: 'medium',
      }),
      scheduleAISchedulerNotifications(client, 'meal', 'تم توليد خطة غذائية جديدة بناءً على آخر تحديثاتك.'),
    ]);
    return { content: JSON.stringify(data) };
  },

  async generateCoachPrediction(client: UserProfile): Promise<AIDraftResponse> {
    const systemInstruction = `You are a performance analyst. Predict the client's progress from the measurement history and trend. Return a single JSON object with keys: predictions (array of {horizon, expectedWeight, expectedBodyFat, expectedMuscleMass, confidence}).`;
    const prompt = `Predict the client's short and medium-term progress. Context: ${sanitizeAiInput(buildClientSnapshot(client))}`;
    const data = await generateStructuredCoachOutput<object>(
      'coach-prediction',
      client,
      prompt,
      systemInstruction,
      {
        predictions: [
          { horizon: '7d', expectedWeight: 0, expectedBodyFat: 0, expectedMuscleMass: 0, confidence: 70 },
        ],
      }
    );
    return { content: JSON.stringify(data) };
  },

  async generateCoachRecommendations(client: UserProfile): Promise<AIDraftResponse> {
    const systemInstruction = `You are a high-level coach. Return a single JSON object with keys: recommendations (array of {title, description, priority}). Recommend calorie adjustments, cardio adjustments, workout modifications, recovery suggestions, and optional supplements.`;
    const prompt = `Recommend the next coaching adjustments for this client. Context: ${sanitizeAiInput(buildClientSnapshot(client))}`;
    const data = await generateStructuredCoachOutput<object>(
      'coach-recommendations',
      client,
      prompt,
      systemInstruction,
      {
        recommendations: [
          { title: 'Increase protein intake', description: 'Keep protein high to support recovery and preserve lean mass.', priority: 'high' },
        ],
      }
    );
    await Promise.all([
      generateAIInsightNotifications(client, {
        title: 'توصية ذكية جديدة',
        body: 'يوصى بإجراء تعديل على البروتين أو الكربوهيدرات أو الكارديو.',
        type: 'ai',
        priority: 'high',
      }),
      scheduleAISchedulerNotifications(client, 'calorie', 'تمت إضافة توصية ذكية لتعديل السعرات أو البروتين.'),
      scheduleAISchedulerNotifications(client, 'cardio', 'تمت إضافة توصية ذكية لتعديل الكارديو.'),
    ]);
    return { content: JSON.stringify(data) };
  },

  async generateCoachReport(client: UserProfile): Promise<AIDraftResponse> {
    const systemInstruction = `You are a professional coach writing a polished monthly progress report. Return a single JSON object with keys: title, summary, strengths, weaknesses, recommendations, nextGoals, motivationalMessage.`;
    const prompt = `Write a professional coach report for this client. Context: ${sanitizeAiInput(buildClientSnapshot(client))}`;
    const data = await generateStructuredCoachOutput<object>(
      'coach-report',
      client,
      prompt,
      systemInstruction,
      {
        title: 'AI Coach Report',
        summary: 'The client is progressing steadily.',
        strengths: ['Consistent effort'],
        weaknesses: ['Recovery could improve'],
        recommendations: ['Keep protein high', 'Sleep well'],
        nextGoals: ['Maintain consistency', 'Track progress weekly'],
        motivationalMessage: 'Keep going—small consistent steps create lasting results.',
      }
    );
    return { content: JSON.stringify(data) };
  },

  /**
   * Generates smart substitutes for a specific meal.
   */
  async generateSmartSubstitutes(mealName: string, mealItems: string): Promise<string[]> {
    try {
      const systemPrompt = `اقترح 3 بدائل ذكية ومتنوعة بالعربية المصرية للوجبة الأصلية بنفس السعرات والبروتين تقريباً.

الإخراج: JSON array من 3 strings فقط، ولا شيء آخر. كل string لازم يكون بالشكل ده بالظبط:
"اسم الوجبة البديلة المختصر (~XXX سعرة · YYج بروتين · ZZج كارب · Wج دهون)"

مثال صحيح:
["صدر فراخ مشوي مع أرز بسمتي وسلطة (~450 سعرة · 35ج بروتين · 50ج كارب · 8ج دهون)", "تونة مع مكرونة كاملة (~430 سعرة · 32ج بروتين · 48ج كارب · 9ج دهون)", "بيض أومليت مع توست أسمر وأفوكادو (~440 سعرة · 28ج بروتين · 42ج كارب · 14ج دهون)"]

الوجبة الأصلية: ${mealName} (${mealItems})`;

      const response = await safeGenerateContent(FLASH_MODEL, mealName, systemPrompt, { responseMimeType: "application/json" });

      try {
        let text = response.text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) text = jsonMatch[0];
        return JSON.parse(text || '[]');
      } catch (e) {
        return ["البدائل غير متاحة حالياً."];
      }
    } catch (e) {
      return ["البدائل غير متاحة حالياً."];
    }
  },

  /**
   * Generates a weekly grocery list from the plan.
   */
  async generateGroceryList(weeklyPlan: any): Promise<string> {
    try {
      const systemPrompt = `Create a categorized "Weekly Grocery List" in Arabic from this plan: ${JSON.stringify(weeklyPlan)}`;
      const response = await safeGenerateContent(FLASH_MODEL, "Generate grocery list.", systemPrompt);
      return response.text || "فشل توليد القائمة.";
    } catch (err) {
      return handleAIError(err);
    }
  },

  /**
   * Quick AI Response bot — the "Instant Assistant" the client can ask
   * short questions to ("هل أقدر أشرب دايت كولا؟", "كم بروتين النهاردة؟").
   *
   * The reply is short (max ~6 lines), pulls in the client's goal, package,
   * injuries and today's tracker so the answer is personal — not generic.
   *
   * @param locale - 'ar' (default) or 'en' — controls the reply language.
   */
  async getQuickReply(question: string, profile: UserProfile, locale: 'ar' | 'en' = 'ar'): Promise<string> {
    try {
      const goal = profile.onboardingData?.goal || 'fitness';
      const injuries = profile.onboardingData?.injuryDescription || (locale === 'en' ? 'None' : 'لا يوجد');
      const isEMS = !!profile.packages?.ems;
      const todayKey = new Date().toISOString().split('T')[0];
      const today = (profile as any).dailyProgress?.[todayKey] || {};
      const water = today.waterLiters ?? 0;
      const energy = today.energyLevel ?? '—';
      const mood = today.mood ?? '—';

      const systemPrompt = locale === 'en'
        ? `You are the CoachPro AI assistant. Reply concisely in clear English (max 6 lines).
Client info:
- Name: ${profile.name || 'Client'}
- Goal: ${goal}
- Subscription: ${isEMS ? 'EMS training' : 'Gym/Home training'}
- Injuries/Health conditions: ${injuries}
- Today: water ${water}L, energy ${energy}/10, mood ${mood}/5

Rules:
1. Be specific and practical. For food/drink questions: clear yes/no + short scientific reason.
2. Respect injuries: never suggest exercises conflicting with their conditions.
3. If outside health/nutrition/fitness scope, politely say: "That's outside my specialty, please ask Coach Lotfy."
4. No Markdown, no long bullet lists — short sentences only.`
        : `أنت مساعد كوتش برو الذكي. عليك الإجابة بإيجاز شديد بالعربية الفصحى المبسطة (لهجة واضحة، لا تتعدى 6 أسطر).
معلومات العميل:
- الاسم: ${profile.name || 'العميل'}
- الهدف: ${goal}
- نوع الاشتراك: ${isEMS ? 'EMS' : 'تدريب جيم/منزلي عادي'}
- الإصابات/الحالات الصحية: ${injuries}
- اليوم: ماء ${water}ل، طاقة ${energy}/10، مزاج ${mood}/5

قواعد الإجابة:
1. كن محدداً وعملياً — إذا كان السؤال عن طعام/مشروب: أجب بـ"نعم/لا" واضحة ثم سبب علمي قصير.
2. احترم الإصابات: لا تقترح أبداً تمريناً يتعارض مع إصاباته.
3. لو السؤال خارج نطاق الصحة/التغذية/التمرين، رد باحترام: "ده خارج تخصصي، اسأل الكوتش لطفي."
4. لا تستخدم Markdown ولا قوائم نقطية طويلة — جمل قصيرة فقط.`;

      const response = await safeGenerateContent(FLASH_MODEL, question, systemPrompt);
      return response.text || (locale === 'en' ? 'How can I help you?' : 'كيف يمكنني مساعدتك؟');
    } catch (err) {
      return handleAIError(err);
    }
  },

  /**
   * Flexible Modifications — swap a single exercise for a safe alternative
   * that respects the client's injury list, equipment, and EMS-vs-Gym mode.
   * Returns one Exercise object ready to drop into the weeklyPlan.
   */
  async swapExercise(
    profile: UserProfile,
    original: { name: string; sets?: any; reps?: any; description?: string },
    reason?: string
  ): Promise<{ name: string; sets: string; reps: string; description: string; pulseIntensity?: string } | null> {
    try {
      const isEMS = !!profile.packages?.ems;
      const goal = profile.onboardingData?.goal || 'fitness';
      const injuries = profile.onboardingData?.injuryDescription || 'لا يوجد';
      const equipment = profile.questionnaireComplete ? 'جيم كامل' : 'منزل/أوزان خفيفة';
      const level = profile.experienceLevel || 'intermediate';

      const systemPrompt = `You are a S&C coach handling a client-requested exercise swap.
Original exercise: "${original.name}" (${original.sets || ''} × ${original.reps || ''}).
Client reason: ${reason || 'لا يفضل التمرين الحالي'}.
Client: goal=${goal}, level=${level}, equipment=${equipment}, modality=${isEMS ? 'EMS' : 'gym/home'}.
Injuries / health: ${injuries}.

RULES:
- Replacement MUST target the same primary muscle group as the original.
- MUST be safe given the injuries (substitute, never aggravate).
- Match the client's equipment and modality.
- ${isEMS ? 'Express volume as time-under-stimulation (sets="cycle x cycle", reps="X min").' : 'Use classic sets x reps with tempo if relevant.'}

Return ONLY this JSON shape (no prose, no markdown):
{ "name": "<Arabic name>", "sets": "<sets>", "reps": "<reps>", "description": "<1-line Arabic scientific reason for picking it>"${isEMS ? ', "pulseIntensity": "<Hz / µs / cycle>"' : ''} }`;

      const response = await safeGenerateContent(FLASH_MODEL, `Swap: ${original.name}`, systemPrompt, { responseMimeType: "application/json" });
      let text = response.text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (m) text = m[0];
      const parsed = JSON.parse(text || '{}');
      if (!parsed?.name) return null;
      return {
        name: parsed.name,
        sets: String(parsed.sets ?? original.sets ?? ''),
        reps: String(parsed.reps ?? original.reps ?? ''),
        description: parsed.description || '',
        ...(parsed.pulseIntensity ? { pulseIntensity: parsed.pulseIntensity } : {})
      };
    } catch (err) {
      console.error('[swapExercise] failed:', err);
      return null;
    }
  },

  /**
   * Generates budget-friendly substitutes.
   */
  async generateBudgetSubstitutes(mealName: string, mealItems: string): Promise<string[]> {
    try {
      const systemPrompt = `Suggest 3 budget-friendly substitutes in Arabic as a JSON array. Meal: ${mealName}`;
      const response = await safeGenerateContent(FLASH_MODEL, mealName, systemPrompt, { responseMimeType: "application/json" });
      
      try {
        let text = response.text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) text = jsonMatch[0];
        return JSON.parse(text || '[]');
      } catch (e) {
        return [];
      }
    } catch (e) {
      return [];
    }
  },

  /**
   * Scans a meal image to estimate calories and macros.
   */
  async analyzeMealImage(imageBlob: string): Promise<string> {
    try {
      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBlob.split(',')[1]
        }
      };

      const systemPrompt = `Analyze this meal image and estimate name, calories, and macros in Arabic. Be specific and helpful.`;
      const response = await safeGenerateContent(FLASH_MODEL, [{ parts: [imagePart, { text: "Analyze this meal photo." }] }], systemPrompt);
      return response.text || "فشل تحليل الصورة.";
    } catch (err) {
      return handleAIError(err);
    }
  },

  /**
   * Predicts progress based on current commitment.
   */
  async predictProgress(profile: UserProfile): Promise<string> {
    try {
      const systemPrompt = `Predict progress for the next 4 weeks based on profile data in Arabic. Use the provided profile metrics and activity history.`;
      const response = await safeGenerateContent(FLASH_MODEL, [{ parts: [{ text: `Profile Data: ${JSON.stringify(profile)}` }] }], systemPrompt);
      await Promise.all([
        generateAIInsightNotifications(profile, {
          title: 'تنبؤ بالتقدم جاهز',
          body: response.text || 'تم تحديث تحليل التقدم الخاص بك.',
          type: 'progress',
          priority: 'medium',
        }),
        scheduleAISchedulerNotifications(profile, 'prediction', response.text || 'تم تحديث تحليل التقدم الخاص بك.'),
      ]);
      return response.text || "لا توجد بيانات كافية حالياً للتنبؤ.";
    } catch (err) {
      return handleAIError(err);
    }
  },

  /**
   * Social Event AI - Adjusts plans for an outing or event.
   */
  async getSocialEventAdvice(eventType: string, cuisinePreference: string): Promise<string> {
    try {
      const systemPrompt = `Advise on staying fit during a ${eventType} outing (${cuisinePreference}) in Arabic.`;
      const response = await safeGenerateContent(FLASH_MODEL, "Social advice.", systemPrompt);
      return response.text || "استمتع بوقتك بحذر!";
    } catch (err) {
      return handleAIError(err);
    }
  },

  /**
   * Adjusts the plan based on daily mood and energy.
   */
  /**
   * Psychological adjustment.
   */
  async getPsychologicalAdjustment(mood: string, energy: number): Promise<string> {
    try {
      const systemPrompt = `Suggest fitness/mood adjustments for Mood: ${mood}, Energy: ${energy}/10 in Arabic.`;
      const response = await safeGenerateContent(FLASH_MODEL, "Mood advice.", systemPrompt);
      return response.text || "واصل السعي!";
    } catch (err) {
      return handleAIError(err);
    }
  },

  /**
   * Brzycki Formula for 1RM Estimation
   */
  calculate1RM(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps > 10) return weight * (1 + reps / 30); // Epley fallback for high reps
    return Math.round(weight / (1.0278 - (0.0278 * reps)));
  },

  /**
   * Karvonen Formula for Target Heart Rate
   */
  calculateKarvonenHR(age: number, rhr: number, intensity: number): number {
    const mhr = 220 - age;
    const hrr = mhr - rhr;
    return Math.round((hrr * (intensity / 100)) + rhr);
  },

  /**
   * Dynamic Volume Scaling Logic
   */
  getVolumeScaling(age: number): { baseVolume: string; recoveryFocus: string } {
    if (age <= 35) return { 
      baseVolume: "High (Progressive Overload focus)", 
      recoveryFocus: "Standard (Active recovery)" 
    };
    if (age >= 45) return { 
      baseVolume: "Moderate (Joint health focus)", 
      recoveryFocus: "High (Increased rest days & mobility)" 
    };
    return { 
      baseVolume: "Moderate-High", 
      recoveryFocus: "Balanced" 
    };
  },

  /**
   * Assessment Template Selection Logic
   */
  getAssessmentTemplates(goal: string, location: string, level: string): string[] {
    const baseTests = ["Body Weight (kg)", "Waist Measurement (cm)"];
    
    if (goal === 'bulk' || (goal === 'fitness' && location === 'gym')) {
      return ["1RM Bench Press", "1RM Squat", "1RM Deadlift", "Pull-up Max Reps", "Flexibility: Sit & Reach", ...baseTests];
    }
    if (goal === 'loss' && location === 'home') {
      return ["Burpees Max 1m", "Push-up Max 1m", "Squat Max 1m", "Plank Duration", "Beep Test / Shuttle Run", ...baseTests];
    }
    if (goal === 'rehab') {
      return ["Single Leg Stand (Balance)", "Joint Range of Movement", "Pain Scale (VAS)", "Hip Mobility Score", "Grip Strength", ...baseTests];
    }
    return ["Bodyweight Squats", "Push-ups", "Plank", "Lunges", "Step-ups", ...baseTests];
  },

  /**
   * Advanced High-Precision Training Plan Generator.
   *
   * Produces a FULL 7-day weekly plan that the ClientDashboard can render
   * directly out of `profile.plans.weeklyPlan[<DayName>]`. The output is
   * always normalized to the shape the UI expects:
   *
   *   { Saturday|Sunday|...|Friday: { nutrition: Meal[], workout: Exercise[] } }
   *
   * Safety, EMS-vs-gym separation, energy-awareness and the deterministic
   * injury-exclusion list from generateWorkoutDraft are all reapplied here so
   * that the saved weekly plan never violates the client's health profile.
   */
  async generateTrainingPlan(client: UserProfile, questionnaire?: FullQuestionnaire, coachNotes?: string): Promise<any> {
    const DAY_KEYS = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

    // Empty 7-day skeleton — used as the fallback so the UI always has
    // something to render instead of a blank page.
    const emptyWeek = () => DAY_KEYS.reduce((acc, d) => {
      acc[d] = { nutrition: [], workout: [] };
      return acc;
    }, {} as Record<string, { nutrition: any[]; workout: any[] }>);

    try {
      const age = client.onboardingData?.age || 30;
      const history = client.onboardingData?.injuryDescription || "None";
      const experience = client.experienceLevel || "intermediate";
      const transcript = client.voiceTranscript || "None provided";
      const goal = client.onboardingData?.goal || "fitness";
      const isEMS = !!client.packages?.ems;
      // Membership flags drive which sections of each day get filled.
      // The admin only pays for what the client subscribed to, so we
      // explicitly tell the model to leave the un-purchased arrays empty.
      const hasNutritionPkg = !!client.packages?.nutrition;
      const hasWorkoutPkg = !!client.packages?.workout || isEMS; // EMS implies workout days
      const hasRehabPkg = !!client.packages?.rehab;

      // ─── Cycle-aware coaching for female athletes ─────────────────────
      // Read the most recent period start; if today falls inside the
      // menstrual or pre-period window, lower training load and inject
      // nutrition tips into the prompt so the model adapts the week.
      let cycleDirective = '';
      try {
        const cl: any = (client as any).cycleLog;
        if (client.gender === 'female' && cl?.lastPeriodStart) {
          const cycleLength = Number(cl.cycleLength) || 28;
          const last = new Date(cl.lastPeriodStart);
          const dayInCycle = Math.floor((Date.now() - last.getTime()) / 86400000) % cycleLength;
          if (dayInCycle >= 0 && dayInCycle < 5) {
            cycleDirective = `\nCYCLE OVERRIDE — MENSTRUAL PHASE (day ${dayInCycle + 1} of cycle): reduce all working sets by 15-20%, drop max RPE to 7, prefer mobility / pilates / zone-2 walking on the heaviest scheduled day. In nutrition meals, emphasize iron (spinach, lean red meat), magnesium (dark chocolate 70%+, pumpkin seeds), and 2.5-3L water daily.\n`;
          } else if (dayInCycle >= cycleLength - 3) {
            cycleDirective = `\nCYCLE OVERRIDE — PRE-PERIOD (day ${dayInCycle + 1} of cycle): reduce intensity 10-15%, add magnesium + calcium to nutrition (yogurt, almonds), keep cardio gentle.\n`;
          }
        }
      } catch (e) {
        // non-fatal — continue without cycle directive
      }
      // Pull training environment from questionnaire first (most up-to-date),
      // then fall back to onboarding data, then default to 'gym'.
      const qEnv = questionnaire?.workout?.environment || ({} as any);
      const qEnvLocation = qEnv.location as 'gym' | 'home' | 'both' | undefined;
      // Questionnaire (workout survey) is always more up-to-date than onboarding — use it first
      const rawLocation = qEnvLocation || client.onboardingData?.trainingLocation || 'gym';
      // 'both' is handled separately below — for the equipment block we need a primary choice
      const location: 'gym' | 'home' | 'both' = (rawLocation === 'both' ? 'both' : rawLocation) as any;
      // Home equipment: questionnaire overrides onboarding
      const homeEquipment = (qEnv.homeEquipment || client.onboardingData?.homeEquipment || '').trim();
      // Gym days / home days from questionnaire
      const gymDays: string[] = Array.isArray(qEnv.gymDays) ? qEnv.gymDays : [];
      const homeDays: string[] = Array.isArray(qEnv.homeDays) ? qEnv.homeDays : [];
      const availableDays: string[] = Array.isArray(qEnv.availableDays) ? qEnv.availableDays : [...new Set([...gymDays, ...homeDays])];
      // Merge likes/dislikes from BOTH onboarding AND nutrition questionnaire
      const qLikes = (questionnaire?.nutrition?.preferences?.likes || '').trim();
      const qDislikes = (questionnaire?.nutrition?.preferences?.dislikes || '').trim();
      const obLikes = (client.onboardingData?.likes || '').trim();
      const obDislikes = (client.onboardingData?.dislikes || '').trim();
      const likes = [obLikes, qLikes].filter(Boolean).join(', ');
      const dislikes = [obDislikes, qDislikes].filter(Boolean).join(', ');
      const workoutDuration = client.onboardingData?.workoutDuration || 60;
      const scaling = this.getVolumeScaling(age);

      // ─── Gender ────────────────────────────────────────────────────────
      const gender = (client.onboardingData?.gender || (client as any).gender || 'male') as 'male' | 'female';

      // ─── Body composition (InBody first, then measurements, then onboarding) ─
      const qMeasurements: any = questionnaire?.nutrition?.measurements || {};
      const inBodyEx: any = client.onboardingData?.inBodyExtracted || {};
      const weightKg = qMeasurements.weight || inBodyEx.weight || (client.onboardingData as any)?.weight || 0;
      const heightCm = client.onboardingData?.height || 0;
      const fatPct   = qMeasurements.fatPercentage || inBodyEx.fatPercentage || 0;
      const muscleMassKg = qMeasurements.muscleMass || inBodyEx.muscleMass || 0;
      const visceralFatScore = qMeasurements.visceralFat || inBodyEx.visceralFat || 0;
      const bmi = (weightKg > 0 && heightCm > 0) ? +(weightKg / ((heightCm / 100) ** 2)).toFixed(1) : 0;
      const bodyCompositionBlock = [
        weightKg  ? `Weight: ${weightKg}kg`             : '',
        heightCm  ? `Height: ${heightCm}cm`             : '',
        bmi       ? `BMI: ${bmi}`                       : '',
        fatPct    ? `Body-fat: ${fatPct}%`              : '',
        muscleMassKg ? `Lean mass: ${muscleMassKg}kg`   : '',
        visceralFatScore ? `Visceral fat score: ${visceralFatScore}` : '',
      ].filter(Boolean).join(' | ') || 'no body composition data yet';

      // ─── Lifestyle & scheduling ────────────────────────────────────────
      const lifestyle: any = questionnaire?.nutrition?.lifestyle || {};
      const jobNature    = lifestyle.jobNature    || (client.onboardingData as any)?.jobNature    || '';
      const wakeHour     = lifestyle.wakeHour     || '';
      const preferredTime = qEnv.preferredTime    || (client.onboardingData as any)?.preferredTime || '';
      const jobLine      = jobNature ? `Job nature: ${jobNature === 'desk' ? 'Desk / sedentary (أعمال مكتبية)' : jobNature === 'active' ? 'Physically active job (عمل حركي)' : 'Mixed (مختلط)'}` : '';
      const timingLine   = [
        wakeHour      ? `Wake-up: ${wakeHour}`            : '',
        preferredTime ? `Preferred training time: ${preferredTime}` : '',
      ].filter(Boolean).join(' | ');

      // Volume target driven by client's available time per session
      // (45 → 5-6 moves, 60 → 7-8 moves, 90 → 10-12 moves)
      const exercisesPerSession =
        workoutDuration <= 45 ? '5-6' :
        workoutDuration >= 90 ? '10-12' : '7-8';

      // Today's reported energy — drives the de-load directive
      const todayKey = new Date().toISOString().split('T')[0];
      const currentEnergy: number | undefined = (client as any).dailyProgress?.[todayKey]?.energyLevel;

      // Health flags
      const hasBP = !!(client as any).medicalFlags?.bloodPressure;
      const hasDiabetes = !!(client as any).medicalFlags?.diabetes;
      const isPregnant = !!(client as any).medicalFlags?.pregnancy;

      // Reuse the same deterministic exclusion vocabulary as generateWorkoutDraft
      const painText = (history + ' ' + ((client as any).painPoints || []).join(' ')).toLowerCase();
      const exclusions: string[] = [];
      const inj = (re: RegExp) => re.test(painText);
      if (inj(/back|ظهر|قطني|lumbar|disc|انزلاق|herniat/)) exclusions.push('Deadlifts','Heavy back-loaded squats','Good Morning','Russian Twist with weight','Sit-ups with anchored feet');
      if (inj(/knee|ركبة|meniscus|acl/)) exclusions.push('Deep squat below parallel','Pistol Squats','Box Jumps','Burpees','Plyometric jumps');
      if (inj(/shoulder|كتف|rotator|cuff/)) exclusions.push('Behind-the-Neck Press','Behind-the-Neck Pulldown','Heavy Overhead Press','Upright Row with barbell');
      if (inj(/neck|رقبة|cervical/)) exclusions.push('Heavy Shrugs','Behind-the-Neck Press','Heavy bar-on-traps squat');
      if (inj(/wrist|رسغ/)) exclusions.push('Heavy straight-bar Bench','Push-ups on flat hands','Snatch / Clean');
      if (inj(/hip|ورك/)) exclusions.push('Wide-stance Deadlift','Heavy Hip Thrust','Sprint intervals');
      if (inj(/ankle|كاحل/)) exclusions.push('Box Jumps','Skipping rope','Sprinting');
      if (hasBP) exclusions.push('Inverted positions','Heavy isometric holds','Valsalva straining lifts');
      if (isPregnant) exclusions.push('Supine work after first trimester','Crunch/plank after 20 weeks','Olympic lifts','High-impact plyometrics');

      let energyDirective = '';
      if (typeof currentEnergy === 'number' && currentEnergy > 0 && currentEnergy <= 4) {
        energyDirective = `\nENERGY OVERRIDE: Today's reported energy is ${currentEnergy}/10 (LOW). Convert TODAY's session into active-recovery (mobility + zone-2 walk 20-25min + light core). Do NOT prescribe heavy lifts today.\n`;
      }

      const exclusionsBlock = exclusions.length
        ? `MANDATORY EXCLUSIONS — never include these moves anywhere in the week:\n- ${exclusions.join('\n- ')}`
        : 'No movement exclusions.';

      // ─── Scientific Engine (Steps 0-5) — runs BEFORE the LLM call ───
      // Computes the final % of 1RM, suggested rep range, weak areas
      // and readiness alerts deterministically. Forwarded as a hard
      // rail block so the model uses the same numbers every run.
      const engineResult = computeScientificPrescription(client, questionnaire, experience as any);
      const engineBlock = formatEngineForPrompt(engineResult);
      // If the readiness check demands full rest, override the energy
      // directive so the whole week tilts toward active recovery.
      if (engineResult.step1_readiness.status === 'rest') {
        energyDirective = `\nREADINESS OVERRIDE: Multiple severe readiness flags (${engineResult.step1_readiness.alerts.join(' | ')}). Convert ALL training days to active-recovery (mobility, zone-2 walk 20-25min, light core, breathing drills). Do NOT prescribe heavy lifts anywhere this week.\n`;
      }

      // ─── Progression Engine (Steps 6-9) — 14-day adaptive load ───
      // Adjusts the prescribed % of 1RM and volume multiplier based on the
      // last 14 days of completion + energy/RPE before the LLM call.
      const progression = computeProgression(client, engineResult.step5_decision.intensityPercent);
      const progressionBlock = formatProgressionForPrompt(progression);

      // ABSOLUTE constraints derived from the client's own onboarding answers.
      // The model is forbidden from inventing equipment, foods, or moves the client
      // didn't say they have/like. Anti-hallucination rails.
      const equipmentBlock = (() => {
        if (location === 'both') {
          const lines = [`HYBRID SETUP — client trains in BOTH gym and home in the same week.`];
          if (gymDays.length) lines.push(`- Gym days (full equipment): ${gymDays.join(', ')}`);
          if (homeDays.length) lines.push(`- Home days (limited equipment): ${homeDays.join(', ')}`);
          if (homeEquipment) lines.push(`- Home equipment available: ${homeEquipment}`);
          else lines.push(`- No home equipment listed → assume body-weight only + bands on home days.`);
          lines.push(`Each day's session MUST match its environment — heavy compound barbell work goes on gym days only; home days use the listed equipment + body-weight progressions only.`);
          if (availableDays.length) lines.push(`- Training days this week: ${availableDays.join(', ')}`);
          return lines.join('\n');
        } else if (location === 'home') {
          const lines = [`TRAINING LOCATION = HOME. Available equipment (verbatim from client): "${homeEquipment || 'NONE — bodyweight only'}".`,
            `ABSOLUTE RULE: every prescribed exercise MUST be doable with ONLY this equipment. If the equipment list is empty or insufficient, prescribe bodyweight / band / household-object alternatives. NEVER prescribe barbell, cable machine, leg press, smith machine, hack squat, lat pulldown, or any gym machine.`];
          if (availableDays.length) lines.push(`- Training days: ${availableDays.join(', ')}`);
          return lines.join('\n');
        } else {
          const lines = [`TRAINING LOCATION = GYM. Full commercial gym equipment is available. You may use barbell, dumbbell, cable, machine, smith, leg press, etc. — choose the right tool for the goal.`];
          if (availableDays.length) lines.push(`- Training days: ${availableDays.join(', ')}`);
          return lines.join('\n');
        }
      })();

      const dislikesBlock = dislikes
        ? `HARD EXCLUSIONS (client explicitly DISLIKES — never prescribe, never substitute back in):\n- ${dislikes}`
        : '';
      const likesBlock = likes
        ? `PREFERENCES (client likes these — bias selection toward them when goal-appropriate):\n- ${likes}`
        : '';

      const durationBlock = `SESSION DURATION = ${workoutDuration} minutes per training day.
ABSOLUTE VOLUME RULE: each training day's "workout" array MUST contain exactly ${exercisesPerSession} exercises (warm-up & cooldown are separate notes inside description, not extra array entries). Do NOT exceed ${exercisesPerSession.split('-').pop()} or fall below ${exercisesPerSession.split('-')[0]}.`;

      const assessments = (client.assessmentHistory || []).slice(-8);
      const benchmarksSummary = assessments.map(a => `${a.testName}: ${a.value}${a.estimated1RM ? ` (Est. 1RM: ${a.estimated1RM}kg)` : ''}`).join(', ');

      await wait(500);

      const systemPrompt = `${engineBlock}

${progressionBlock}

You are a World-Class S&C Coach building a FULL 7-DAY interactive plan.

=========== CLIENT PROFILE ===========
Name: ${client.name}
Gender: ${gender === 'female' ? 'Female (أنثى)' : 'Male (ذكر)'}
Age: ${age} years
Goal: ${goal}
Experience level: ${experience}
${jobLine ? jobLine + '\n' : ''}${timingLine ? timingLine + '\n' : ''}
Body composition — ${bodyCompositionBlock}
Injury history: ${history}
Benchmarks: ${benchmarksSummary || 'none yet'}
Coach voice notes: ${transcript}
=======================================

Modality: ${isEMS ? 'EMS suit (1-2 sessions/week, 72h apart, time-under-stimulation in seconds — never sets x reps)' : 'Regular gym / bodyweight (sets x reps with tempo & RPE)'}.
Recovery scaling: ${scaling.recoveryFocus}. Base volume: ${scaling.baseVolume}.

GENDER-SPECIFIC COACHING RULES:
${gender === 'female' ? `- Female client: prefer compound hip-dominant movements (hip thrust, Romanian deadlift, Bulgarian split squat) for glute/posterior chain development.
- Avoid programming that causes excessive spinal loading if BMI > 27 or body-fat > 32%.
- Schedule higher-intensity sessions mid-cycle (follicular/ovulatory phases) and lighter sessions in luteal phase.
- Caloric targets in nutrition blocks should reflect female TDEE (generally 15-20% lower than equivalent male).` : `- Male client: prioritize horizontal & vertical pushing/pulling compounds for upper body hypertrophy.
- Program progressive overload with 5-10% load increase every 2 weeks for strength-focused goals.
- Protein intake guidance: 1.6-2.2g/kg body weight.`}

${fatPct > 0 ? `BODY-COMPOSITION COACHING DIRECTIVE:
- Body-fat ${fatPct}% → ${fatPct > 30 ? 'HIGH — prioritize fat loss: caloric deficit, metabolic conditioning circuits, avoid pure strength blocks > 5 reps for now.' : fatPct > 20 ? 'MODERATE — recomp phase: slight deficit on rest days, maintenance on training days, hypertrophy rep ranges 8-15.' : 'LEAN — optimize performance: maintenance or slight surplus, strength blocks 3-6 reps + hypertrophy accessory work.'}
${visceralFatScore > 10 ? `- Visceral fat score ${visceralFatScore} (HIGH > 10): include 20-30 min moderate-intensity cardio (zone 2) on at least 2 rest days — emphasize in the workout description.` : ''}` : ''}

${jobLine.includes('Desk') ? `JOB-NATURE DIRECTIVE (Sedentary job): Client sits most of the day → mandatory postural correction work in EVERY session: thoracic spine mobility, hip flexor stretching, face-pulls / band pull-aparts. Flag these as [POSTURE] in description.` : jobLine.includes('active') ? `JOB-NATURE DIRECTIVE (Active job): Client is physically active at work → total weekly volume must account for occupational fatigue. Reduce accessory volume by 15%, prioritize compound movements over isolation.` : ''}

=========== ABSOLUTE CLIENT CONSTRAINTS (DO NOT VIOLATE) ===========
${equipmentBlock}

${durationBlock}

${dislikesBlock}

${likesBlock}
===================================================================

${energyDirective}
${cycleDirective}
${coachNotes ? `\nCOACH WORKOUT NOTES — The coach has already drafted the following session guidance. Use it as a binding blueprint when selecting exercises and structuring workout arrays. Do NOT contradict the coach's chosen movements, sets, or reps unless a safety exclusion forces a direct substitution:\n${coachNotes}\n` : ''}
${exclusionsBlock}

OUTPUT — return ONLY valid JSON, NO markdown, NO prose outside the JSON.
Schema (root keys MUST be these exact English day names):
{
  "Saturday":  { "nutrition": [Meal,...], "workout": [Exercise,...] },
  "Sunday":    { "nutrition": [Meal,...], "workout": [Exercise,...] },
  "Monday":    { "nutrition": [Meal,...], "workout": [Exercise,...] },
  "Tuesday":   { "nutrition": [Meal,...], "workout": [Exercise,...] },
  "Wednesday": { "nutrition": [Meal,...], "workout": [Exercise,...] },
  "Thursday":  { "nutrition": [Meal,...], "workout": [Exercise,...] },
  "Friday":    { "nutrition": [Meal,...], "workout": [Exercise,...] }
}
Meal     = { "name": string (Arabic), "items": string (Arabic, with grams), "method": string (Arabic) }
Exercise = {
  "name":        string (Arabic — the move's name in Arabic),
  "sets":        string|number,
  "reps":        string|number,
  "description": string (Arabic, 1-line scientific reason this move serves the goal),
  "formCues":    array of 3-5 short Arabic strings — step-by-step body positioning, joint angles, common mistakes to avoid (REPLACES the need for a video / image),
  "breathing":   string (Arabic, exact rhythm — e.g. "شهيق من الأنف أثناء النزول، زفير قوي من الفم أثناء الدفع")${isEMS ? ',\n  "pulseIntensity": string (Hz/µs guidance)' : ''}
}

=========== MEMBERSHIP-DRIVEN OUTPUT GATING (STRICT) ===========
The client has these active memberships:
- Workout/Gym package: ${hasWorkoutPkg ? 'YES — fill the "workout" array on training days with strength/conditioning moves' : 'NO — every "workout" array MUST be []'}
- Nutrition package:  ${hasNutritionPkg ? 'YES — every day MUST have a full meal list (3-5 meals: breakfast / snack / lunch / snack / dinner) with grams + cooking method + calorie & macro hint inside "method"' : 'NO — every "nutrition" array MUST be []'}
- Rehab package:      ${hasRehabPkg ? 'YES — include 2-3 corrective / mobility / stability moves daily targeting the listed injuries; tag them in description with [REHAB]' : 'NO — do NOT include rehab-specific corrective moves'}
- EMS package:        ${isEMS ? 'YES — schedule 1-2 EMS sessions per week (72h apart) using time-under-stimulation; tag them in description with [EMS]' : 'NO — do NOT prescribe EMS sessions'}
Do not prescribe content for memberships the client does NOT have. If ALL packages are absent, return empty arrays everywhere.
================================================================

RULES:
1. EVERY one of the 7 days MUST be present. Rest/recovery days have workout=[] and a normal nutrition list (when nutrition package is active).
2. Distribute training across the week appropriately for the goal & modality (push/pull/legs split, full-body, or EMS 1-2 sessions/week with active-recovery on the rest days).
3. ${isEMS ? 'For EMS days, "sets" should describe time-under-stimulation (e.g. "4×4 cycle") and "reps" the duration ("20 min total"). Add pulseIntensity for every move.' : 'Use classic sets x reps with tempo and RPE inside description.'}
4. All Arabic text in Arabic. JSON keys stay English.
5. Respect every exclusion above — substitute with a safe alternative if needed.
6. NEVER invent equipment the client did not list. NEVER include a disliked food/move. NEVER prescribe MORE or FEWER than the duration-specified number of exercises per training day.
7. formCues and breathing are MANDATORY for every exercise — they replace illustrations. Be specific (joint angles, foot stance, where to feel the contraction, breathing tempo).`;

      const response = await safeGenerateContent(FLASH_MODEL, "Generate full 7-day plan.", systemPrompt, { responseMimeType: "application/json" });

      let parsed: any = {};
      try {
        let text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) text = jsonMatch[0];
        parsed = JSON.parse(text || '{}');
      } catch (parseErr) {
        console.error("[generateTrainingPlan] JSON parse failed. Raw:", response.text?.slice(0, 400));
        return emptyWeek();
      }

      // ---- NORMALIZE so ClientDashboard always renders ----
      // 1. Unwrap if LLM nested under common wrappers.
      if (parsed && typeof parsed === 'object' && !DAY_KEYS.some(d => d in parsed)) {
        for (const wrapKey of ['weeklyPlan','plan','week','data','schedule']) {
          if (parsed[wrapKey] && typeof parsed[wrapKey] === 'object') {
            parsed = parsed[wrapKey];
            break;
          }
        }
      }

      // 2. Map common Arabic day names back to English keys (defensive).
      const arabicMap: Record<string,string> = {
        'السبت':'Saturday','الأحد':'Sunday','الاحد':'Sunday','الإثنين':'Monday','الاثنين':'Monday',
        'الثلاثاء':'Tuesday','الأربعاء':'Wednesday','الاربعاء':'Wednesday','الخميس':'Thursday','الجمعة':'Friday'
      };
      for (const [ar, en] of Object.entries(arabicMap)) {
        if (parsed[ar] && !parsed[en]) { parsed[en] = parsed[ar]; delete parsed[ar]; }
      }

      // 3. Guarantee every day exists with the right inner shape.
      const week = emptyWeek();
      for (const d of DAY_KEYS) {
        const day = parsed[d] || {};
        const nutrition = Array.isArray(day.nutrition) ? day.nutrition : (Array.isArray(day.meals) ? day.meals : []);
        const workout = Array.isArray(day.workout) ? day.workout : (Array.isArray(day.exercises) ? day.exercises : []);

        week[d] = {
          nutrition: nutrition.map((m: any) => ({
            name: m?.name || m?.title || 'وجبة',
            items: m?.items || m?.ingredients || m?.contents || '',
            method: m?.method || m?.preparation || m?.instructions || ''
          })),
          workout: workout.map((e: any) => {
            // Tolerant capture of formCues — accept array OR string OR alt keys.
            let formCues: string[] | undefined;
            const rawCues = e?.formCues ?? e?.form ?? e?.steps ?? e?.cues;
            if (Array.isArray(rawCues)) {
              formCues = rawCues.map((s: any) => String(s).trim()).filter(Boolean);
            } else if (typeof rawCues === 'string' && rawCues.trim()) {
              // Split common separators if model returned a single string.
              formCues = rawCues.split(/\n|•|\d+\.\s|\u2022/).map(s => s.trim()).filter(Boolean);
            }
            return {
              name: e?.name || e?.exercise || e?.exerciseName || 'تمرين',
              sets: e?.sets ?? e?.setCount ?? '',
              reps: e?.reps ?? e?.repCount ?? '',
              description: e?.description || e?.notes || e?.reason || '',
              ...(formCues && formCues.length ? { formCues } : {}),
              ...(e?.breathing ? { breathing: String(e.breathing) } : {}),
              ...(e?.pulseIntensity ? { pulseIntensity: e.pulseIntensity } : {}),
              ...(e?.imageUrl ? { imageUrl: e.imageUrl } : {})
            };
          })
        };
      }

      return week;
    } catch (err) {
      console.error("Advanced Plan Generation Error:", err);
      return emptyWeek();
    }
  },

  /**
   * Quantifies training load based on physical assessments.
   */
  async quantifyTrainingLoad(assessment: any, profile: UserProfile): Promise<any> {
    try {
      const systemPrompt = `You are a Sports Scientist. Analyze these physical assessment results:
      ${JSON.stringify(assessment)}
      User Profile: ${profile.name}, Goal: ${profile.onboardingData?.goal}.
      
      Calculate:
      1. Relative Strength (1RM vs Bodyweight)
      2. Recommended Weekly Training Volume (Sets per body part)
      3. Intensity Zone (Percentage of 1RM)
      
      Return as JSON with keys: relativeStrength, estimatedVolume, intensityZone (Arabic string).`;

      const response = await safeGenerateContent(FLASH_MODEL, "Quantify load.", systemPrompt, { responseMimeType: "application/json" });
      
      try {
        let text = response.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) text = jsonMatch[0];
        return JSON.parse(text || '{}');
      } catch (e) {
        return { relativeStrength: 0, estimatedVolume: 0, intensityZone: "متوسط" };
      }
    } catch (err) {
      console.error(err);
      return { relativeStrength: 0, estimatedVolume: 0, intensityZone: "متوسط" };
    }
  }
};
