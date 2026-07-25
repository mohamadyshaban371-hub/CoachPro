/**
 * smartwatch.ts — Universal wearable / health integration layer.
 *
 * Architecture: provider-pattern with a normalized daily snapshot.
 *
 * Supported sources (tiered by availability):
 *  Tier 1 — Always available (no hardware):
 *    • manual        : User types values from their watch app
 *    • export_import : User pastes JSON/CSV exported from any health app
 *
 *  Tier 2 — Available in Chrome desktop / Chrome Android:
 *    • web_bluetooth : Real-time HR via GATT Heart Rate Service (0x180D)
 *
 *  Tier 3 — Native Capacitor shell required (android/ or ios/ folders):
 *    • health_connect: Android Health Connect (requires native Android shell)
 *    • healthkit     : Apple HealthKit (requires native iOS shell)
 *    NOTE: These shells are NOT present in the current project. The UI
 *          shows a clear "requires native build" notice when detected.
 *
 *  Tier 4 — Cloud OAuth (planned; not implemented in this release):
 *    • fitbit | garmin | oura | whoop | polar | suunto | zepp | coros
 *    • withings | samsung | huawei
 *    In this release, these providers are accessible via export_import only.
 *
 * All data is normalized into WatchDaySnapshot before being written to
 *   users/{uid}/dailyLogs/{YYYY-MM-DD}/watch
 * so the AI engine, progression engine, and EMS protocol all read the
 * same shape regardless of the source.
 */

// Web Bluetooth API type stubs (experimental — not in standard DOM lib)
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;
type Bluetooth = any;

import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { WatchDaySnapshot, WearableProviderKey } from '../types';

// Re-export types so existing imports keep working
export type { WatchDaySnapshot };
/** @deprecated Use WatchDaySnapshot from types.ts */
export type WatchSnapshot = WatchDaySnapshot;

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCapability {
  key: WearableProviderKey;
  nameAr: string;
  nameEn: string;
  /** Data fields this provider can supply */
  metrics: (keyof WatchDaySnapshot)[];
  /** How the user connects / imports data */
  connectionType: 'bluetooth' | 'native_bridge' | 'export_import' | 'oauth' | 'manual';
  /** Browser / platform requirement */
  requirement: 'always' | 'chrome_desktop_android' | 'native_android' | 'native_ios' | 'server_oauth';
  /** Short Arabic description for the UI */
  descriptionAr: string;
  /** URL or instructions to export data from this provider */
  exportGuideUrl?: string;
}

export const PROVIDER_REGISTRY: ProviderCapability[] = [
  {
    key: 'manual',
    nameAr: 'إدخال يدوي',
    nameEn: 'Manual Entry',
    metrics: ['steps', 'sleepHours', 'hr', 'hrResting', 'hrv', 'spo2', 'calories',
      'sleepDeep', 'sleepRem', 'bodyWeight', 'bodyFat', 'recoveryScore', 'stressScore'],
    connectionType: 'manual',
    requirement: 'always',
    descriptionAr: 'أدخل بياناتك يدويًا من تطبيق ساعتك — دائمًا متاح.',
  },
  {
    key: 'export_import',
    nameAr: 'استيراد من الساعة',
    nameEn: 'Health Export Import',
    metrics: ['steps', 'sleepHours', 'hr', 'hrResting', 'hrv', 'spo2', 'calories',
      'activeMinutes', 'sleepDeep', 'sleepRem', 'sleepLight', 'sleepScore',
      'recoveryScore', 'stressScore', 'bodyWeight', 'bodyFat', 'vo2max'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'صدّر بياناتك من تطبيق Garmin Connect / Fitbit / Oura / Health Connect ثم الصقها هنا.',
    exportGuideUrl: 'https://support.garmin.com/en-US/?faq=W1TvTPW8JZ6LfJSfK512Q8',
  },
  {
    key: 'web_bluetooth',
    nameAr: 'Bluetooth مباشر',
    nameEn: 'Web Bluetooth (Live HR)',
    metrics: ['hr', 'hrUpdatedAt', 'hrStrain', 'hrStrainAvg', 'hrStrainPct', 'deviceName'],
    connectionType: 'bluetooth',
    requirement: 'chrome_desktop_android',
    descriptionAr: 'اتصال مباشر بساعتك أو حزام الصدر لقراءة النبض فوريًا. يعمل على Chrome فقط.',
  },
  {
    key: 'health_connect',
    nameAr: 'Health Connect (أندرويد)',
    nameEn: 'Android Health Connect',
    metrics: ['steps', 'sleepHours', 'hr', 'hrResting', 'hrv', 'spo2', 'calories',
      'activeMinutes', 'sleepDeep', 'sleepRem', 'sleepLight', 'sleepScore',
      'recoveryScore', 'bodyWeight', 'bodyFat', 'vo2max'],
    connectionType: 'native_bridge',
    requirement: 'native_android',
    descriptionAr: 'يقرأ بيانات Health Connect تلقائيًا — يحتاج نسخة أندرويد مثبَّتة من التطبيق.',
  },
  {
    key: 'healthkit',
    nameAr: 'Apple Health (iOS)',
    nameEn: 'Apple HealthKit',
    metrics: ['steps', 'sleepHours', 'hr', 'hrResting', 'hrv', 'spo2', 'calories',
      'activeMinutes', 'sleepDeep', 'sleepRem', 'sleepLight', 'sleepScore',
      'bodyWeight', 'bodyFat', 'vo2max'],
    connectionType: 'native_bridge',
    requirement: 'native_ios',
    descriptionAr: 'يقرأ بيانات Apple Health تلقائيًا — يحتاج نسخة iOS مثبَّتة من التطبيق.',
  },
  // Cloud providers — export_import only in this release
  {
    key: 'garmin',
    nameAr: 'Garmin Connect',
    nameEn: 'Garmin',
    metrics: ['steps', 'hr', 'hrResting', 'hrv', 'spo2', 'calories', 'sleepHours',
      'sleepDeep', 'sleepRem', 'sleepScore', 'recoveryScore', 'stressScore', 'vo2max'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'صدّر يومك من Garmin Connect → Activities → Export CSV/JSON ثم الصقه.',
    exportGuideUrl: 'https://connect.garmin.com',
  },
  {
    key: 'fitbit',
    nameAr: 'Fitbit',
    nameEn: 'Fitbit',
    metrics: ['steps', 'hr', 'hrResting', 'sleepHours', 'sleepDeep', 'sleepRem', 'calories', 'spo2'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'صدّر من تطبيق Fitbit → Account → Export Data.',
    exportGuideUrl: 'https://fitbit.com',
  },
  {
    key: 'oura',
    nameAr: 'Oura Ring',
    nameEn: 'Oura',
    metrics: ['hr', 'hrResting', 'hrv', 'spo2', 'sleepHours', 'sleepDeep', 'sleepRem',
      'sleepLight', 'sleepScore', 'recoveryScore', 'stressScore', 'calories'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق Oura → Profile → Export Data.',
    exportGuideUrl: 'https://ouraring.com',
  },
  {
    key: 'whoop',
    nameAr: 'WHOOP',
    nameEn: 'WHOOP',
    metrics: ['hr', 'hrResting', 'hrv', 'sleepHours', 'sleepDeep', 'sleepRem',
      'recoveryScore', 'stressScore', 'calories'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق WHOOP → Profile → Download My Data.',
    exportGuideUrl: 'https://app.whoop.com',
  },
  {
    key: 'polar',
    nameAr: 'Polar Flow',
    nameEn: 'Polar',
    metrics: ['hr', 'hrResting', 'hrv', 'sleepHours', 'calories', 'spo2', 'vo2max'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من Polar Flow → Training → Export Training.',
    exportGuideUrl: 'https://flow.polar.com',
  },
  {
    key: 'suunto',
    nameAr: 'Suunto',
    nameEn: 'Suunto',
    metrics: ['hr', 'hrResting', 'calories', 'sleepHours', 'vo2max'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق Suunto → Activities → Export.',
    exportGuideUrl: 'https://app.suunto.com',
  },
  {
    key: 'zepp',
    nameAr: 'Zepp / Amazfit',
    nameEn: 'Zepp',
    metrics: ['steps', 'hr', 'hrResting', 'sleepHours', 'spo2', 'stressScore', 'calories'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق Zepp → Profile → Privacy Center → Export Data.',
    exportGuideUrl: 'https://www.zepp.com',
  },
  {
    key: 'coros',
    nameAr: 'COROS',
    nameEn: 'COROS',
    metrics: ['hr', 'hrResting', 'hrv', 'sleepHours', 'calories', 'vo2max'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق COROS → Activity → Export.',
    exportGuideUrl: 'https://coros.com',
  },
  {
    key: 'withings',
    nameAr: 'Withings',
    nameEn: 'Withings',
    metrics: ['hr', 'hrResting', 'sleepHours', 'sleepDeep', 'sleepRem', 'bodyWeight', 'bodyFat', 'spo2'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق Health Mate → Profile → Export Data.',
    exportGuideUrl: 'https://healthmate.withings.com',
  },
  {
    key: 'samsung',
    nameAr: 'Samsung Health',
    nameEn: 'Samsung Health',
    metrics: ['steps', 'hr', 'hrResting', 'sleepHours', 'sleepDeep', 'sleepRem',
      'spo2', 'calories', 'stressScore'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من Samsung Health → Profile → Download Personal Data.',
    exportGuideUrl: 'https://health.samsung.com',
  },
  {
    key: 'huawei',
    nameAr: 'Huawei Health',
    nameEn: 'Huawei Health',
    metrics: ['steps', 'hr', 'hrResting', 'sleepHours', 'spo2', 'stressScore', 'calories'],
    connectionType: 'export_import',
    requirement: 'always',
    descriptionAr: 'من تطبيق Huawei Health → Me → Privacy → Request data export.',
    exportGuideUrl: 'https://consumer.huawei.com/en/mobileservices/health',
  },
];

/** Look up a provider by key */
export function getProviderInfo(key: WearableProviderKey): ProviderCapability | undefined {
  return PROVIDER_REGISTRY.find((p) => p.key === key);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

export function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform?.() &&
    (window as any).Capacitor?.getPlatform?.() === 'android';
}

export function isNativeIos(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform?.() &&
    (window as any).Capacitor?.getPlatform?.() === 'ios';
}

/** Returns which providers are usable in the current runtime environment. */
export function getAvailableProviders(): ProviderCapability[] {
  return PROVIDER_REGISTRY.filter((p) => {
    if (p.requirement === 'always') return true;
    if (p.requirement === 'chrome_desktop_android') return isWebBluetoothAvailable();
    if (p.requirement === 'native_android') return isNativeAndroid();
    if (p.requirement === 'native_ios') return isNativeIos();
    return false; // server_oauth — not yet implemented
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in the device's local timezone. */
export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a partial snapshot onto users/{uid}.dailyLogs[today].watch.
 * Uses dot-path merges so sibling fields (waterLiters, completedWorkout, …)
 * are never overwritten.
 */
export async function saveWatchSnapshot(
  uid: string,
  patch: Partial<WatchDaySnapshot>,
  dateKey?: string,
): Promise<void> {
  const key = dateKey ?? todayKey();
  const update: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    update[`dailyLogs.${key}.watch.${k}`] = v;
  }
  if (Object.keys(update).length === 0) return;
  await updateDoc(doc(db, 'users', uid), update);
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY SCORE DERIVATION
// Computed locally when the provider doesn't supply one directly.
// Inputs: sleep, HRV, resting HR trend. Result 0-100.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a 0-100 recovery score from available biometrics.
 * Returns undefined when there is insufficient data (< 2 signals).
 */
export function deriveRecoveryScore(snap: Partial<WatchDaySnapshot>): number | undefined {
  const signals: number[] = [];

  // Sleep component (0-40 pts)
  if (snap.sleepHours !== undefined && snap.sleepHours > 0) {
    // 8h = full score; linear below
    const sleepScore = Math.min(40, (snap.sleepHours / 8) * 40);
    signals.push(sleepScore);
  }

  // HRV component (0-35 pts) — higher HRV = better parasympathetic recovery
  if (snap.hrv !== undefined && snap.hrv > 0) {
    // Population average ~50-60ms; 80ms+ = excellent
    const hrvScore = Math.min(35, (snap.hrv / 80) * 35);
    signals.push(hrvScore);
  }

  // Resting HR component (0-25 pts) — lower resting HR = better recovery
  if (snap.hrResting !== undefined && snap.hrResting > 0) {
    // 50 bpm = excellent; 80+ = poor
    const hrScore = Math.max(0, Math.min(25, ((80 - snap.hrResting) / 30) * 25));
    signals.push(hrScore);
  }

  if (signals.length < 2) return undefined; // not enough data

  // Normalize: sum the signals proportionally to full 100
  const maxPossible = signals.length === 3 ? 100 : signals.length === 2
    ? (snap.sleepHours !== undefined && snap.hrv !== undefined ? 75 :
       snap.sleepHours !== undefined ? 65 : 60)
    : 100;

  const raw = signals.reduce((a, b) => a + b, 0);
  return Math.round(Math.min(100, (raw / maxPossible) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT / IMPORT — parse pasted JSON from health apps
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedHealthExport {
  snapshot: Partial<WatchDaySnapshot>;
  /** Fields successfully mapped */
  mappedFields: string[];
  /** Raw keys that couldn't be mapped */
  unmappedKeys: string[];
  /** Provider detected from the JSON shape */
  detectedProvider?: WearableProviderKey;
}

/**
 * Attempt to parse a JSON string exported from any supported health app
 * into a normalized WatchDaySnapshot. Liberal interpretation — maps
 * well-known field names from Garmin, Oura, WHOOP, Fitbit, Samsung, etc.
 *
 * Returns a ParsedHealthExport; the caller decides whether the confidence
 * is high enough to save.
 */
export function parseHealthExport(jsonString: string): ParsedHealthExport {
  const snapshot: Partial<WatchDaySnapshot> = {};
  const mappedFields: string[] = [];
  let raw: any;

  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { snapshot, mappedFields, unmappedKeys: [], detectedProvider: undefined };
  }

  // Normalize: if the root is an array, take the first element
  if (Array.isArray(raw)) raw = raw[0] ?? {};

  const unmappedKeys: string[] = [];
  let detectedProvider: WearableProviderKey | undefined;

  // ── Provider detection ─────────────────────────────────────────────────────
  if ('bodyBattery' in raw || 'stressLevel' in raw) detectedProvider = 'garmin';
  else if ('readinessScore' in raw || 'recoveryIndex' in raw) detectedProvider = 'oura';
  else if ('recovery_score' in raw || 'whoopScore' in raw) detectedProvider = 'whoop';
  else if ('activitiesHeart' in raw || 'activitiesSleep' in raw) detectedProvider = 'fitbit';
  else if ('activityType' in raw && 'averageHR' in raw) detectedProvider = 'polar';
  else if ('sleepScore' in raw && 'SleepScore' in raw) detectedProvider = 'withings';
  else if ('sleepEfficiency' in raw && 'samsungHealth' in (raw.source ?? '').toLowerCase())
    detectedProvider = 'samsung';

  // ── Field mapping — most common field names across providers ───────────────
  type SnapKey = keyof WatchDaySnapshot;
  const tryMap = (val: any, key: SnapKey) => {
    const n = Number(val);
    if (!Number.isNaN(n) && n >= 0) {
      (snapshot as any)[key] = n;
      mappedFields.push(key);
      return true;
    }
    return false;
  };

  const aliases: Record<SnapKey, string[]> = {
    steps:         ['steps', 'totalSteps', 'stepsTotal', 'step_count', 'Steps'],
    hr:            ['heartRate', 'avgHeartRate', 'averageHR', 'heart_rate', 'hr', 'currentBPM'],
    hrResting:     ['restingHeartRate', 'restingHR', 'resting_heart_rate', 'restingBPM',
                    'averageRestingHeartRate'],
    hrv:           ['hrv', 'rmssd', 'RMSSD', 'hrv_rmssd', 'heartRateVariability', 'hrvScore'],
    spo2:          ['spo2', 'SpO2', 'spO2', 'bloodOxygen', 'avgSpO2'],
    vo2max:        ['vo2max', 'VO2Max', 'vo2Max', 'fitnessAge', 'maxAerobicSpeed'],
    calories:      ['calories', 'activeCalories', 'totalCalories', 'caloriesBurned',
                    'activeEnergyBurned', 'calorie'],
    activeMinutes: ['activeMinutes', 'totalActivities', 'activityTime', 'moderateActivityMinutes'],
    sleepHours:    ['sleepHours', 'totalSleepDuration', 'totalSleep', 'sleep_duration',
                    'sleepDuration', 'sleepInHours'],
    sleepDeep:     ['deepSleep', 'deepSleepDuration', 'deep_sleep', 'remSleepDuration'],
    sleepRem:      ['remSleep', 'rem_sleep', 'remDuration', 'REMSleepDuration'],
    sleepLight:    ['lightSleep', 'light_sleep', 'lightSleepDuration', 'nremSleep'],
    sleepAwake:    ['awakeTime', 'wakeTime', 'awake_duration'],
    sleepScore:    ['sleepScore', 'SleepScore', 'sleep_score', 'sleepQuality'],
    recoveryScore: ['recoveryScore', 'recovery_score', 'readinessScore', 'recoveryIndex',
                    'bodyBattery', 'whoopScore'],
    stressScore:   ['stressLevel', 'stressScore', 'stress_level', 'averageStressLevel'],
    bodyWeight:    ['weight', 'bodyWeight', 'mass', 'weightKg'],
    bodyFat:       ['bodyFat', 'fatPercent', 'body_fat_percent', 'fatPercentage'],
    // Non-numeric / not auto-mapped from export:
    provider: [],
    deviceName: [],
    syncedAt: [],
    hrUpdatedAt: [],
    hrStrain: [],
    hrStrainAvg: [],
    hrStrainPct: [],
    hrSessionEndedAt: [],
  };

  for (const [key, names] of Object.entries(aliases) as [SnapKey, string[]][]) {
    if (names.length === 0) continue;
    for (const name of names) {
      if (name in raw) {
        if (!tryMap(raw[name], key)) unmappedKeys.push(name);
        break;
      }
    }
  }

  // Convert sleep seconds/minutes to hours if the value looks suspiciously large
  if (snapshot.sleepHours !== undefined && snapshot.sleepHours > 24) {
    snapshot.sleepHours = Math.round((snapshot.sleepHours / 60) * 10) / 10; // minutes→hours
    if (snapshot.sleepHours > 24) snapshot.sleepHours = snapshot.sleepHours / 60; // seconds→hours
  }
  if (snapshot.sleepDeep !== undefined && snapshot.sleepDeep > 24)
    snapshot.sleepDeep = Math.round((snapshot.sleepDeep / 60) * 100) / 100;
  if (snapshot.sleepRem !== undefined && snapshot.sleepRem > 24)
    snapshot.sleepRem = Math.round((snapshot.sleepRem / 60) * 100) / 100;

  if (detectedProvider) snapshot.provider = detectedProvider;

  // Derive recovery score if not already mapped
  if (!snapshot.recoveryScore) {
    const derived = deriveRecoveryScore(snapshot);
    if (derived !== undefined) {
      snapshot.recoveryScore = derived;
      mappedFields.push('recoveryScore');
    }
  }

  return { snapshot, mappedFields, unmappedKeys, detectedProvider };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB BLUETOOTH — GATT Heart Rate Service
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a Heart Rate Measurement (0x2A37) DataView per the Bluetooth spec. */
function parseHeartRateMeasurement(value: DataView): number {
  const flags = value.getUint8(0);
  const is16Bit = (flags & 0x01) === 0x01;
  return is16Bit ? value.getUint16(1, /* littleEndian */ true) : value.getUint8(1);
}

export interface HeartRateConnection {
  device: BluetoothDevice;
  /** Stops notifications and disconnects GATT. Safe to call multiple times. */
  disconnect: () => void;
}

/**
 * Pair with a heart-rate sensor and stream BPM through `onSample`.
 * Resolves once GATT is live; callback fires on every new sample.
 */
export async function connectHeartRate(
  onSample: (bpm: number) => void,
  onDisconnect?: () => void,
): Promise<HeartRateConnection> {
  if (!isWebBluetoothAvailable()) {
    throw new Error('متصفحك لا يدعم Web Bluetooth. استخدم Chrome على ويندوز/أندرويد.');
  }
  const bt = (navigator as any).bluetooth as Bluetooth;

  const device = await bt.requestDevice({
    filters: [{ services: ['heart_rate'] }],
    optionalServices: ['battery_service'],
  });

  if (!device.gatt) throw new Error('الجهاز لا يدعم GATT.');

  const handleDisconnected = () => onDisconnect?.();
  device.addEventListener('gattserverdisconnected', handleDisconnected);

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');

  const handleNotification = (ev: Event) => {
    const target = ev.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    try {
      const bpm = parseHeartRateMeasurement(target.value);
      if (bpm > 0 && bpm < 250) onSample(bpm);
    } catch (err) {
      console.warn('[smartwatch] HR parse error:', err);
    }
  };
  characteristic.addEventListener('characteristicvaluechanged', handleNotification);
  await characteristic.startNotifications();

  return {
    device,
    disconnect: () => {
      try {
        characteristic.removeEventListener('characteristicvaluechanged', handleNotification);
        device.removeEventListener('gattserverdisconnected', handleDisconnected);
        characteristic.stopNotifications().catch(() => {});
        device.gatt?.disconnect();
      } catch (err) {
        console.warn('[smartwatch] disconnect error:', err);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HR STRAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface HrSample {
  bpm: number;
  at: string; // ISO timestamp
}

/** Estimated maximum HR via Tanaka formula (more accurate than 220-age). */
export function maxHrForAge(age: number): number {
  if (!age || age <= 0) return 190;
  return Math.round(208 - 0.7 * age);
}

export type HrStrain = 'low' | 'normal' | 'high';

/**
 * Reads a list of in-workout HR samples and returns whether the session
 * was 'high' strain (avg ≥ 85% of max HR). Below 60% = 'low'.
 */
export function computeHrStrain(
  samples: HrSample[] | undefined,
  age: number,
): { strain: HrStrain; avgBpm: number; pctOfMax: number } {
  if (!samples || samples.length < 5) {
    return { strain: 'normal', avgBpm: 0, pctOfMax: 0 };
  }
  const max = maxHrForAge(age);
  const avg = Math.round(samples.reduce((s, x) => s + x.bpm, 0) / samples.length);
  const pct = Math.round((avg / max) * 100);
  let strain: HrStrain = 'normal';
  if (pct >= 85) strain = 'high';
  else if (pct < 60) strain = 'low';
  return { strain, avgBpm: avg, pctOfMax: pct };
}

/**
 * Throttle-aware HR sample recorder.
 * Called by the panel with BPM throttle; persists only the latest reading.
 */
export async function recordHrSample(uid: string, bpm: number): Promise<void> {
  const key = todayKey();
  const sample: HrSample = { bpm, at: new Date().toISOString() };
  await updateDoc(doc(db, 'users', uid), {
    [`dailyLogs.${key}.watch.lastHrSample`]: sample,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK BUILDERS — per-metric Arabic messages for the UI
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyFeedback {
  tone: 'good' | 'warn' | 'low';
  message: string;
}

export function buildStepsFeedback(steps?: number, target = 8000): DailyFeedback {
  if (!steps || steps <= 0)
    return { tone: 'low', message: 'لسه ما سجلتش خطواتك النهاردة. حرّك جسمك!' };
  if (steps >= target)
    return { tone: 'good', message: `ممتاز! وصلت لهدف ${target.toLocaleString('ar-EG')} خطوة.` };
  const pct = Math.round((steps / target) * 100);
  return {
    tone: 'warn',
    message: `${pct}% من هدفك — باقي ${(target - steps).toLocaleString('ar-EG')} خطوة.`,
  };
}

export function buildSleepFeedback(hours?: number): DailyFeedback {
  if (hours === undefined || hours <= 0)
    return { tone: 'low', message: 'سجّل ساعات نومك — النوم نصف الطريق للنتيجة.' };
  if (hours < 6)
    return { tone: 'low', message: `${hours}س نوم قليلة جداً — هتأثر على الأداء والاستشفاء.` };
  if (hours < 7)
    return { tone: 'warn', message: `${hours}س نوم تحت الموصى به (7-9س). حاول تنام بدري.` };
  if (hours <= 9)
    return { tone: 'good', message: `${hours}س نوم ممتازة — جسمك جاهز للتمرين.` };
  return { tone: 'warn', message: `${hours}س نوم زيادة — قد تشير لإرهاق أو مرض.` };
}

export function buildHrFeedback(hr?: number, restingHr = 60): DailyFeedback {
  if (!hr || hr <= 0)
    return { tone: 'low', message: 'مفيش قراءة قلب حالية. وصّل ساعتك للقياس المباشر.' };
  if (hr < restingHr - 5)
    return { tone: 'good', message: `${hr} bpm — ضربات قلب منخفضة (راحة عميقة).` };
  if (hr <= restingHr + 15)
    return { tone: 'good', message: `${hr} bpm — معدل طبيعي مريح.` };
  if (hr <= restingHr + 40)
    return { tone: 'warn', message: `${hr} bpm — مرتفع. خد نفس عميق وارتاح.` };
  return { tone: 'low', message: `${hr} bpm — مرتفع جداً. لو مش بتتمرن، توقف وارتاح.` };
}

export function buildRecoveryFeedback(score?: number): DailyFeedback {
  if (score === undefined)
    return { tone: 'low', message: 'درجة الاستشفاء غير متاحة — سجّل نوم ونبض لحسابها.' };
  if (score >= 75) return { tone: 'good', message: `${score}/100 — استشفاء ممتاز. جاهز للتمرين الثقيل.` };
  if (score >= 50) return { tone: 'warn', message: `${score}/100 — استشفاء متوسط. خفّف الشدة 10-15%.` };
  return { tone: 'low', message: `${score}/100 — استشفاء منخفض. ارتاح أو اكتفِ بكارديو خفيف.` };
}

export function buildHrvFeedback(hrv?: number): DailyFeedback {
  if (hrv === undefined || hrv <= 0)
    return { tone: 'low', message: 'HRV غير متاح. يحتاج ساعة تدعم RMSSD (Oura / Garmin / Polar).' };
  if (hrv >= 60) return { tone: 'good', message: `${hrv}ms — HRV ممتاز. الجهاز العصبي في أفضل حالاته.` };
  if (hrv >= 40) return { tone: 'warn', message: `${hrv}ms — HRV متوسط. نوم وإدارة إجهاد أفضل.` };
  return { tone: 'low', message: `${hrv}ms — HRV منخفض. إشارة إجهاد — تجنّب التمرين الثقيل.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE COACHING ADVISORY
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptiveAdvice {
  severity: 'info' | 'warn' | 'alert';
  title: string;
  message: string;
  code: string;
}

/**
 * Builds an adaptive coaching advisory from the full normalized snapshot.
 * Priority: extreme recovery < poor sleep < low HRV < high HR strain.
 * Returns null when no advisory is warranted.
 */
export function buildAdaptiveCoachingAdvice(
  snap: Partial<WatchDaySnapshot>
): AdaptiveAdvice | null {
  const day = todayKey();
  const sleep = snap.sleepHours;
  const hrv = snap.hrv;
  const recovery = snap.recoveryScore;

  // 1. Extreme fatigue block
  if (
    (recovery !== undefined && recovery < 30) ||
    (sleep !== undefined && sleep < 5 && (hrv === undefined || hrv < 30))
  ) {
    return {
      severity: 'alert',
      title: 'إجهاد شديد — لا تمرين اليوم',
      message:
        'الاستشفاء في الحد الحرج. اكتفِ بالمشي الخفيف أو التمدد. التمرين الثقيل النهاردة سيؤخر تعافيك.',
      code: `extreme-fatigue-${day}`,
    };
  }

  // 2. Poor sleep alert
  if (sleep !== undefined && sleep < 5) {
    return {
      severity: 'alert',
      title: 'النوم تحت الحد الأدنى',
      message:
        'الراحة منخفضة النهاردة. اتجنّب رفع الأوزان التقيلة وركّز على كارديو خفيف (مشي/دراجة 20-30 دقيقة) لحماية الجهاز العصبي.',
      code: `sleep-low-${day}`,
    };
  }

  // 3. Moderate sleep warning
  if (sleep !== undefined && sleep < 6.5) {
    return {
      severity: 'warn',
      title: 'الراحة أقل من المثالي',
      message: 'النوم أقل من 6.5 ساعة. خفّف الأحمال 10-15% النهاردة واتعوّض في الجلسة الجاية.',
      code: `sleep-warn-${day}`,
    };
  }

  // 4. Low HRV advisory
  if (hrv !== undefined && hrv < 35) {
    return {
      severity: 'warn',
      title: 'HRV منخفض — اجهاد عصبي',
      message: `HRV ${hrv}ms — الجهاز العصبي محتاج راحة. خفّف الشدة وركّز على التكنيك لا الأوزان.`,
      code: `hrv-low-${day}`,
    };
  }

  // 5. Low recovery score
  if (recovery !== undefined && recovery < 50) {
    return {
      severity: 'warn',
      title: 'درجة استشفاء منخفضة',
      message: `درجة الاستشفاء ${recovery}/100. جلسة متوسطة الشدة أو استرجاعية أفضل النهاردة.`,
      code: `recovery-low-${day}`,
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATION (advisory de-dup by code)
// ─────────────────────────────────────────────────────────────────────────────

export async function pushAdvisoryNotification(
  uid: string,
  advice: AdaptiveAdvice,
): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    title: advice.title,
    body: advice.message,
    type: 'advisory',
    code: advice.code,
    severity: advice.severity,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN COMPLIANCE SCORE (backward-compatible)
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceBreakdown {
  /** 0–100. */
  score: number;
  activeDays: number;
  goalDays: number;
  avgSleepHours: number;
  avgRecovery: number | null;
  lastSyncedAt?: string;
}

export function computeComplianceScore(
  dailyLogs: Record<string, any> | undefined,
  days = 7,
  stepGoal = 6000,
): ComplianceBreakdown {
  const today = new Date();
  let scored = 0;
  const max = days * 12; // expanded: 4 pts steps + 4 pts sleep + 4 pts HR/recovery
  let activeDays = 0;
  let goalDays = 0;
  let sleepSum = 0;
  let sleepCount = 0;
  let recoverySum = 0;
  let recoveryCount = 0;
  let lastSyncedAt: string | undefined;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    const watch: WatchDaySnapshot | undefined = dailyLogs?.[key]?.watch;
    if (!watch) continue;

    const hasAny =
      watch.steps !== undefined ||
      watch.sleepHours !== undefined ||
      watch.hr !== undefined ||
      watch.recoveryScore !== undefined;
    if (hasAny) activeDays += 1;

    const latestSync = [watch.syncedAt, watch.hrUpdatedAt].filter(Boolean).sort().pop();
    if (latestSync && (!lastSyncedAt || latestSync > lastSyncedAt)) lastSyncedAt = latestSync;

    if (watch.steps !== undefined && watch.steps > 0) {
      if (watch.steps >= stepGoal) { scored += 4; goalDays += 1; } else scored += 2;
    }
    if (watch.sleepHours !== undefined && watch.sleepHours > 0) {
      sleepSum += watch.sleepHours;
      sleepCount += 1;
      if (watch.sleepHours >= 7) scored += 4;
      else if (watch.sleepHours >= 5) scored += 2;
    }
    const recoverySig = watch.recoveryScore ?? (watch.hr !== undefined && watch.hr > 0 ? 50 : undefined);
    if (recoverySig !== undefined) {
      if (watch.recoveryScore !== undefined) {
        recoverySum += watch.recoveryScore;
        recoveryCount += 1;
      }
      scored += recoverySig >= 70 ? 4 : recoverySig >= 50 ? 2 : 1;
    }
  }

  return {
    score: Math.round((scored / max) * 100),
    activeDays,
    goalDays,
    avgSleepHours: sleepCount > 0 ? Math.round((sleepSum / sleepCount) * 10) / 10 : 0,
    avgRecovery: recoveryCount > 0 ? Math.round(recoverySum / recoveryCount) : null,
    lastSyncedAt,
  };
}

export function complianceTone(score: number): { color: string; label: string } {
  if (score >= 75) return { color: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30', label: 'ملتزم' };
  if (score >= 50) return { color: 'text-amber-300 bg-amber-500/10 border-amber-400/30', label: 'متوسط' };
  if (score >= 25) return { color: 'text-orange-300 bg-orange-500/10 border-orange-400/30', label: 'ضعيف' };
  return { color: 'text-rose-300 bg-rose-500/10 border-rose-400/30', label: 'غير ملتزم' };
}
