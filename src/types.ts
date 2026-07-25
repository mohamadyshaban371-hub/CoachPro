export type UserRole = 'admin' | 'client';

/**
 * All wearable / health data sources the app understands.
 *
 * • web_bluetooth — real-time HR via GATT (Chrome/Android only)
 * • manual        — user-typed values; always available as fallback
 * • health_connect— Android Health Connect (requires native Capacitor shell)
 * • healthkit     — Apple HealthKit (requires native iOS Capacitor shell)
 * • export_import — JSON/CSV exported from a provider app and pasted in
 * • fitbit | garmin | oura | whoop | polar | suunto | zepp | coros
 *                 — cloud provider OAuth (server-side; planned for a future
 *                   release — currently available via export_import only)
 * • withings | samsung | huawei — same status as above
 */
export type WearableProviderKey =
  | 'web_bluetooth'
  | 'manual'
  | 'health_connect'
  | 'healthkit'
  | 'export_import'
  | 'fitbit'
  | 'garmin'
  | 'oura'
  | 'whoop'
  | 'polar'
  | 'suunto'
  | 'zepp'
  | 'coros'
  | 'withings'
  | 'samsung'
  | 'huawei';

/** Normalized daily health snapshot — one record per calendar day. */
export interface WatchDaySnapshot {
  // ── Source ──────────────────────────────────────────────────────────────
  /** Primary provider that supplied this record. */
  provider?: WearableProviderKey;
  /** Device / app display name (e.g. "Polar H10", "Oura Ring"). */
  deviceName?: string;
  /** ISO timestamp of the most recent sync that wrote this record. */
  syncedAt?: string;

  // ── Activity ────────────────────────────────────────────────────────────
  steps?: number;
  calories?: number;          // active kcal burned
  activeMinutes?: number;     // minutes in moderate+ activity

  // ── Heart ────────────────────────────────────────────────────────────────
  /** Latest / resting HR reading in BPM. */
  hr?: number;
  /** ISO timestamp of the hr reading. */
  hrUpdatedAt?: string;
  /** Morning / overnight resting HR (more stable than spot readings). */
  hrResting?: number;
  /** Heart Rate Variability in ms (RMSSD). Higher = better recovery. */
  hrv?: number;
  /** SpO₂ % (blood oxygen). */
  spo2?: number;
  /** VO₂ max estimate (ml/kg/min). */
  vo2max?: number;

  // ── Sleep ────────────────────────────────────────────────────────────────
  sleepHours?: number;        // total sleep in hours
  sleepDeep?: number;         // deep-sleep hours
  sleepRem?: number;          // REM hours
  sleepLight?: number;        // light-sleep hours
  sleepAwake?: number;        // time awake during sleep period
  sleepScore?: number;        // 0-100 provider score

  // ── Recovery & Stress ───────────────────────────────────────────────────
  /** 0-100. Computed locally (from sleep/HRV/HR) or supplied by provider. */
  recoveryScore?: number;
  /** 0-100 stress score (from provider if available). */
  stressScore?: number;

  // ── Body ─────────────────────────────────────────────────────────────────
  bodyWeight?: number;        // kg
  bodyFat?: number;           // %

  // ── HR Strain (existing — kept for backward compat) ──────────────────────
  hrStrain?: 'low' | 'normal' | 'high';
  hrStrainAvg?: number;
  hrStrainPct?: number;
  hrSessionEndedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'birthday' | 'inactivity' | 'system' | 'custom' | 'plan_update' | 'questionnaire' | 'assessment_complete' | 'plan_published';
  isRead: boolean;
  createdAt: string;
  /** Optional reference uid of the client who triggered the notification */
  clientUid?: string;
  clientName?: string;
}

export interface PackageConfig {
  workout?: { months: number };
  nutrition?: { months: number };
  rehab?: { months: number };
  ems?: { sessions: number };
}

export interface UserProfile {
  uid: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  /** Public avatar shown on the Champions Feed and Profile page.
   *  Stored as a Firebase Storage download URL. Optional until the user
   *  uploads one (their initial is rendered as a fallback). */
  profilePicUrl?: string;
  /** Free-text bio shown on the Profile page. Optional. */
  bio?: string;
  gender: 'male' | 'female';
  packages: PackageConfig;
  onboardingComplete: boolean;
  questionnaireComplete?: boolean;
  /** Admin-controlled flag: Physical Assessment tab is visible to client only after admin enables it */
  physicalAssessmentEnabled?: boolean;
  isActivated: boolean;
  createdAt: string;
  lastLoginAt?: string;
  coins?: number;
  onboardingData?: OnboardingData;
  assessmentRequests?: AssessmentRequest[];
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  voiceTranscript?: string;
  expiryDate?: string;
  measurementHistory?: MeasurementHistory[];
  /** ISO timestamp written every time the client submits new measurements —
   *  drives the 14-day mandatory-update gate and admin alerts. */
  lastMeasurementSubmittedAt?: string;
  assessmentHistory?: PhysicalAssessment[];
  plans?: {
    workout?: string;
    nutrition?: string;
    rehab?: string;
    ems?: string;
    pdfUrl?: string;
    weeklyPlan?: WeeklyPlan;
    weeklyPlanDraft?: WeeklyPlan;
    weeklyPlanPublishedAt?: string;
    /** Full phased rehab protocol — published by admin */
    rehabProgram?: RehabProgram;
    rehabProgramPublishedAt?: string;
    /** Full EMS weekly program — published by admin */
    emsProgram?: EMSProgram;
    emsProgramPublishedAt?: string;
  };
  /**
   * Female athletes only — last logged period start + typical cycle length.
   * Used by the AI plan engine to reduce RPE during the menstrual phase
   * and surface phase-specific nutrition tips on the dashboard.
   */
  cycleLog?: {
    lastPeriodStart?: string; // ISO date
    cycleLength?: number;     // days, default 28
    updatedAt?: string;
  };
  /** AI-generated client briefing from voice + InBody + medical (admin only). */
  brainSummary?: {
    text: string;
    generatedAt: string;
  };
  dailyProgress?: {
    [date: string]: {
      mealsCompleted: number[];
      exercisesCompleted: number[];
      totalMeals: number;
      totalExercises: number;
      moodScore?: number;
      energyLevel?: number;
      waterLiters?: number;
    };
  };
  dailyLogs?: {
    [date: string]: {
      waterLiters?: number;
      completedWorkout?: boolean;
      notes?: string;
      /** Normalized wearable / health snapshot for the day.
       *  Backward-compatible: old fields (steps, sleepHours, hr, …) are kept.
       *  New fields are additive — never remove existing ones. */
      watch?: WatchDaySnapshot;
    };
  };
  nutritionSurveyData?: NutritionSurveyData;
}

export interface AssessmentRequest {
  id: string;
  date: string;
  templateName: string;
  testNames: string[];
  testsDetails?: { name: string; description: string; measurement: string }[];
  /** 'fitness' = EMS/Workout adaptive tests | 'rehab' = injury assessment tests */
  assessmentType?: 'fitness' | 'rehab';
  status: 'pending' | 'completed';
  completedAt?: string;
  results?: { [testName: string]: string | number };
}

export interface PhysicalAssessment {
  date: string;
  testName: string;
  value: string | number;
  unit?: string;
  estimated1RM?: number; // Calculated via Brzycki Formula
  karvonenIntensity?: string; // Calculated via Karvonen Formula
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: any;
}

export interface MeasurementHistory {
  date: string;
  weight: number;
  fatPercentage: number;
  muscleMass: number;
  waterPercentage: number;
  protein: number;
  // Body Measurements (cm)
  chest?: number;
  waist?: number;
  hips?: number;
  arm?: number;
  // Fitness Tests
  pushUps?: number;
  squats?: number;
  plank?: number; // in seconds
  // Extra InBody Vision-OCR fields (auto-filled, optional — used by AI engine
  // to fine-tune calorie targets and visceral-fat warnings).
  visceralFat?: number;
  bmr?: number;
  inbodyScore?: number;
  photos: {
    front: string;
    side: string;
    inBody: string;
  };
}

export interface OnboardingData {
  height: number;
  weight: number;
  birthDate: string;
  age?: number;
  gender: 'male' | 'female';
  hasInjury: boolean;
  goal: 'shape' | 'loss' | 'bulk' | 'fitness' | 'rehab';
  voiceMemoUrl?: string;
  /** Inline base64 data-URL of the onboarding voice note (playable in <audio>). */
  voiceNote?: string;
  /** MIME of the inline voice note (e.g. audio/webm). */
  voiceNoteMime?: string;
  /** Auto-generated transcript of the voice note (Gemini). */
  voiceTranscript?: string;
  images?: string[];
  notes?: string;
  painPoints?: string[]; // IDs of body parts
  painIntensity?: number;
  injuryDescription?: string;
  /** Total time the client can dedicate per workout, in minutes — drives volume scaling. */
  workoutDuration?: 45 | 60 | 90;
  /** Where the client trains (used as ABSOLUTE constraint in plan generation). */
  trainingLocation?: 'gym' | 'home';
  /** Equipment available at home (free-text, used as constraint when location=home). */
  homeEquipment?: string;
  /** Foods / exercises the client likes (constraint, "must include where possible"). */
  likes?: string;
  /** Foods / exercises the client dislikes (HARD exclusion). */
  dislikes?: string;
  /** Manual InBody fallback when the photo is unreadable. All optional. */
  manualInBody?: {
    weight?: number;
    fatPercentage?: number;
    muscleMass?: number;
    waterPercentage?: number;
    protein?: number;
  };
  /** Initial InBody scan photo collected during onboarding (base64 data URL).
   *  Kept separate from `images` so the coach can distinguish the InBody
   *  printout from progress photos. */
  inBodyPhoto?: string;
  /** Auto-extracted InBody numbers from the onboarding photo (Vision OCR).
   *  Filled in client-side by Onboarding.analyzeInBodyPhoto on upload.
   *  All values default to 0 if a field couldn't be read. */
  inBodyExtracted?: {
    weight: number;
    fatPercentage: number;
    muscleMass: number;
    waterPercentage: number;
    protein: number;
  };
  hasAgreedToWaiver: boolean;
  submittedAt: string;
}

export interface GeneralMedicalHistory {
  bloodPressure: boolean;
  bloodPressureDetails?: string;
  diabetes: boolean;
  diabetesDetails?: string;
  surgeries: boolean;
  surgeryDetails?: string;
  pregnancyNursing?: boolean; // Only for females
  lastPeriodStart?: string;   // Only for females — ISO date string (YYYY-MM-DD)
  cycleLength?: number;       // Only for females — cycle length in days (21–40)
}

export interface DailyLogEntry {
  time: string;
  activity: string;
}

/**
 * Lifestyle block — captured in the nutrition survey so the deterministic
 * macro calculator (lib/macroCalculator.ts) can pick the right activity
 * multiplier and so the coach knows what circadian / family-history
 * constraints to design around.
 */
export interface NutritionLifestyleData {
  /** Average sleep duration in hours (e.g. 7) */
  sleepHours: number;
  /** Wake-up clock time, HH:MM */
  wakeHour: string;
  /** Length of the daily work shift in hours */
  workShiftHours: number;
  /** Type of job — drives baseline energy expenditure */
  jobNature: 'desk' | 'active' | 'mixed' | '';
  /** Persistent insomnia / poor sleep quality */
  insomnia: boolean;
  /** Family history of obesity / metabolic disease */
  familyObesityHistory: boolean;
  /** Self-reported daily activity level outside the gym */
  dailyActivityLevel: 'sedentary' | 'light' | 'moderate' | 'high' | '';
  /** Number of training sessions per week */
  workoutFrequencyPerWeek: number;
}

export interface NutritionSurveyData {
  timeline: {
    wakeup: string;
    work: string;
    workout: string;
    sleep: string;
    notes: string;
  };
  dailyLog: DailyLogEntry[];
  /** Mandatory new block (April-2026 spec). Empty values are valid until
   *  the user fills them — the survey UI gates submission on them. */
  lifestyle: NutritionLifestyleData;
  habits: {
    mealsPerDay: number;
    isConsistent: 'yes' | 'no' | 'sometimes';
    sugarCravings: 'yes' | 'no' | 'sometimes';
    peakHungerTimes: string;
    digestionIssues: string;
  };
  preferences: {
    likes: string;
    dislikes: string;
    allergies: string[];
  };
  supplements: {
    waterLiters: number;
    currentSupplements: string;
  };
  measurements: {
    chest: number;
    waist: number;
    arm: number;
    thigh: number;
    weight: number;
    fatPercentage: number;
    muscleMass: number;
    waterPercentage: number;
    protein: number;
  };
  photos: {
    front: string;
    side: string;
    inBody: string;
  };
  medical?: GeneralMedicalHistory;
  /**
   * Free-text notes the client can type or dictate (April-2026 spec).
   * `notesVoiceTranscript` keeps the raw whisper-transcribed text separate
   * from `notes` so the coach can audit what was originally said vs what
   * the client edited afterwards. Both are forwarded to the AI nutrition
   * draft so meal-plan caveats / preferences / context are honored.
   */
  additionalNotes?: string;
  notesVoiceTranscript?: string;
}

export interface WorkoutSurveyData {
  health: {
    bloodPressure: boolean;
    diabetes: boolean;
  };
  medical?: GeneralMedicalHistory;
  level: 'beginner' | 'intermediate' | 'advanced';
  injuryUpdate: {
    additionalPain: string;
  };
  environment: {
    /** 'gym' | 'home' | 'both' — supports training in two locations */
    location: 'gym' | 'home' | 'both';
    homeEquipment: string;
    /** Days when training in the gym */
    gymDays: string[];
    /** Days when training at home */
    homeDays: string[];
    /** Legacy combined field kept for backward compat */
    availableDays: string[];
    preferredTime: string;
  };
  goals: string[];
  /**
   * STEP 0 (Scientific Engine) — Readiness inputs. Re-collected each
   * survey submission so the engine's STEP 1 readiness check fires on
   * fresh data. Optional during migration; the engine treats undefined
   * as "normal" (intensityFactor = 1.0).
   */
  readiness?: {
    /** 1–10, perceived stress today */
    stress?: number;
    /** hours slept last night */
    sleepHours?: number;
    /** 1–10, current physical pain */
    pain?: number;
  };
}

export interface RehabInjury {
  id: string;
  date: string;
  intervention: 'surgery' | 'physio' | 'none';
  painDescription: 'sharp' | 'heavy' | 'throbbing' | 'other';
  previousSteps: string;
  media: {
    mri?: string[];
    xray?: string[];
    pdf?: string[];
    recentPhoto?: string;
  };
}

export interface RehabSurveyData {
  hasInjuries: boolean;
  painPoints: string[];
  painIntensity: number;
  injuryDescription: string;
  injuries: RehabInjury[];
}

export interface EMSSurveyData {
  safety: {
    pacemaker: boolean;
    epilepsy: boolean;
    pregnancy: boolean;
    metalImplants: boolean;
  };
  medical?: GeneralMedicalHistory;
  painPoints: {
    location: string;
    intensity: number;
  }[];
}

export interface FullQuestionnaire {
  userId: string;
  nutrition?: NutritionSurveyData;
  workout?: WorkoutSurveyData;
  rehab?: RehabSurveyData;
  ems?: EMSSurveyData;
  submittedAt: string;
}

export interface Meal {
  name: string;
  items: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  method?: string;
}

export interface Exercise {
  name: string;
  sets?: string;
  reps?: string;
  weight?: string;
  description?: string;
  imageUrl?: string;
  pulseIntensity?: string;
  pulseProtocol?: 'Strength' | 'Metabolic' | 'Relax';
  bodyPosition?: string;
  /** Arabic, ordered execution / form cues (replaces image illustrations). */
  formCues?: string[];
  /** Arabic breathing rhythm cue (e.g. "شهيق أثناء النزول، زفير أثناء الدفع"). */
  breathing?: string;
}

export interface DayPlan {
  nutrition: Meal[];
  workout: Exercise[];
}

export interface WeeklyPlan {
  Saturday?: DayPlan;
  Sunday?: DayPlan;
  Monday?: DayPlan;
  Tuesday?: DayPlan;
  Wednesday?: DayPlan;
  Thursday?: DayPlan;
  Friday?: DayPlan;
}

export interface AIDraftResponse {
  content: string;
  safetyAlerts?: string[];
  suggestedIntensity?: number;
}

// ─── Membership & EMS System ───────────────────────────────────────────────

/** A membership tier created and managed by the admin */
export interface Membership {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Duration type: monthly = 1 month, quarterly = 3 months, package = fixed sessions */
  durationType: 'monthly' | 'quarterly' | 'package';
  /** Number of months (for monthly/quarterly) or sessions (for package) */
  durationValue: number;
  /** Max EMS sessions included (0 = unlimited or N/A) */
  totalSessions: number;
  /** Service type the membership applies to */
  serviceType: 'ems' | 'workout' | 'nutrition' | 'rehab' | 'all';
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/** A payment installment record */
export interface PaymentInstallment {
  id: string;
  amount: number;
  paidAt: string;
  note?: string;
}

/** A client's active membership subscription */
export interface ClientMembership {
  id: string;
  clientId: string;
  membershipId: string;
  membershipName: string;
  /** Total price for this subscription */
  totalPrice: number;
  /** Amount paid so far */
  amountPaid: number;
  /** Remaining = totalPrice - amountPaid */
  amountRemaining: number;
  /** Total EMS sessions in the package */
  totalSessions: number;
  /** Sessions used so far */
  sessionsUsed: number;
  /** Sessions remaining = totalSessions - sessionsUsed */
  sessionsRemaining: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  paymentInstallments: PaymentInstallment[];
  createdAt: string;
  updatedAt: string;
}

/** A single EMS session check-in record */
export interface EMSSession {
  id: string;
  clientId: string;
  clientName: string;
  clientMembershipId: string;
  checkedInAt: string;
  notes?: string;
}

// ─── Progress Update (14-day cycle) ────────────────────────────────────────

/** A single progress update entry (stored in measurementHistory array) */
export interface ProgressEntry {
  id: string;
  date: string;
  weight: number;
  fatPercentage: number;
  muscleMass: number;
  waterPercentage: number;
  protein: number;
  /** Body measurement photos: storage URLs */
  photos?: {
    front?: string;
    side?: string;
    back?: string;
    inBody?: string;
  };
  /** Auto-calculated diffs vs previous entry */
  diffs?: {
    weight: number;
    fatPercentage: number;
    muscleMass: number;
    waterPercentage: number;
  };
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REHAB PROGRAM — Full phased rehabilitation protocol
// ─────────────────────────────────────────────────────────────────────────────

export interface RehabExercise {
  name: string;
  nameEn?: string;
  sets: string;
  reps: string;
  holdSeconds?: number;
  restSeconds?: number;
  description: string;
  formCues: string[];
  painLimit: string;
  targetMuscles: string[];
  equipment: string;
}

export interface RehabSession {
  sessionFocus: string;
  warmup: string;
  exercises: RehabExercise[];
  cooldown: string;
}

export interface RehabPhase {
  phaseNumber: number;
  name: string;
  nameEn?: string;
  weeks: string;
  weeksCount: number;
  goals: string[];
  sessionsPerWeek: number;
  sessionDurationMinutes: number;
  painLimit: number;
  sessions: RehabSession[];
  progressionCriteria: string;
  assessmentTests: string[];
}

export interface AssessmentCheckpoint {
  week: number;
  tests: string[];
  purpose: string;
  passThreshold: string;
}

export interface RehabProgram {
  injurySummary: string;
  totalWeeks: number;
  phases: RehabPhase[];
  assessmentSchedule: AssessmentCheckpoint[];
  returnToSportCriteria: string[];
  warnings: string[];
  generatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMS PROGRAM — Full weekly EMS training protocol
// ─────────────────────────────────────────────────────────────────────────────

export interface EMSExercise {
  name: string;
  nameEn?: string;
  timeUnderStimulation: string;
  restBetweenSets: string;
  totalDurationMinutes: number;
  pulseIntensity: string;
  hzValue: number;
  pulseWidthUs: number;
  clientIntensity: 'خفيفة' | 'متوسطة' | 'عالية';
  targetMuscles: string[];
  position: string;
  description: string;
  formCues: string[];
  breathing: string;
}

export interface EMSSession {
  sessionNumber: number;
  dayLabel: string;
  durationMinutes: number;
  hzBand: 'recovery' | 'endurance' | 'strength';
  hzValue: number;
  pulseWidthUs: number;
  targetRPE: number;
  restAfterSession: string;
  focus: string;
  targetAreas: string[];
  preworkout: string;
  exercises: EMSExercise[];
  postworkout: string;
}

export interface EMSWeek {
  weekNumber: number;
  focus: string;
  sessions: EMSSession[];
}

export interface EMSProgressionStep {
  week: number;
  hz: number;
  rpe: string;
  focus: string;
}

export interface EMSProgram {
  clientSummary: string;
  goal: string;
  totalWeeks: number;
  sessionsPerWeek: number;
  totalSessions: number;
  weeks: EMSWeek[];
  progressionPlan: EMSProgressionStep[];
  safetyReminders: string[];
  contraindications: string[];
  generatedAt?: string;
}
