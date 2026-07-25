import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Bluetooth,
  BluetoothOff,
  Footprints,
  Heart,
  Moon,
  Loader2,
  Save,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Upload,
  Zap,
  Wind,
  Scale,
  Droplets,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  BarChart2,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  WatchDaySnapshot,
  todayKey,
  saveWatchSnapshot,
  connectHeartRate,
  isWebBluetoothAvailable,
  isNativeAndroid,
  isNativeIos,
  buildStepsFeedback,
  buildSleepFeedback,
  buildHrFeedback,
  buildRecoveryFeedback,
  buildHrvFeedback,
  buildAdaptiveCoachingAdvice,
  pushAdvisoryNotification,
  computeHrStrain,
  maxHrForAge,
  deriveRecoveryScore,
  parseHealthExport,
  getAvailableProviders,
  PROVIDER_REGISTRY,
  HeartRateConnection,
  HrSample,
  DailyFeedback,
} from '../lib/smartwatch';
import { resolveClientAge } from '../services/aiMasterEngine';

interface Props {
  profile: UserProfile;
}

const TONE_STYLES: Record<DailyFeedback['tone'], string> = {
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  low: 'text-rose-300',
};

const TONE_DOT: Record<DailyFeedback['tone'], string> = {
  good: 'bg-emerald-400',
  warn: 'bg-amber-400',
  low: 'bg-rose-400',
};

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY RING — SVG gauge showing 0-100
// ─────────────────────────────────────────────────────────────────────────────
function RecoveryRing({ score }: { score: number }) {
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
  return (
    <svg width={80} height={80} viewBox="0 0 80 80" className="rotate-[-90deg]">
      <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle
        cx={40} cy={40} r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  unit: string;
  feedback: DailyFeedback;
  live?: boolean;
}

function StatCard({ icon, accent, label, value, unit, feedback, live }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-slate-950/40 border border-white/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${accent}`}>
          {icon} {label}
        </div>
        {live && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-white tabular-nums">{value}</span>
        <span className="text-[10px] text-slate-500 font-bold uppercase">{unit}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[feedback.tone]}`} />
        <p className={`text-[11px] leading-relaxed ${TONE_STYLES[feedback.tone]}`}>
          {feedback.message}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND CHART — 7-day sparkline
// ─────────────────────────────────────────────────────────────────────────────
interface TrendChartProps {
  dailyLogs: UserProfile['dailyLogs'];
  field: keyof WatchDaySnapshot;
  label: string;
  unit: string;
  color: string;
  days?: number;
}

function TrendChart({ dailyLogs, field, label, unit, color, days = 7 }: TrendChartProps) {
  const points = useMemo(() => {
    const arr: (number | null)[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const val = (dailyLogs?.[key] as any)?.watch?.[field];
      arr.push(typeof val === 'number' && val > 0 ? val : null);
    }
    return arr;
  }, [dailyLogs, field, days]);

  const valid = points.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="rounded-2xl bg-slate-950/40 border border-white/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 size={13} className="text-slate-500" />
          <span className="text-[11px] text-slate-400 font-bold">{label}</span>
        </div>
        <p className="text-[10px] text-slate-600">لا توجد بيانات كافية للرسم البياني.</p>
      </div>
    );
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const W = 180;
  const H = 44;
  const stepX = W / (days - 1);

  const pathD = points.reduce((d, v, i) => {
    if (v === null) return d;
    const x = i * stepX;
    const y = H - ((v - min) / range) * H;
    return d === '' ? `M ${x} ${y}` : `${d} L ${x} ${y}`;
  }, '');

  return (
    <div className="rounded-2xl bg-slate-950/40 border border-white/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-400 font-bold">{label} (7 أيام)</span>
        <span className={`text-[11px] font-black ${color}`}>
          {valid[valid.length - 1]} <span className="text-[9px] font-normal text-slate-500">{unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 4}`} className="w-full h-10 overflow-visible">
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} className={color} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) =>
          v !== null ? (
            <circle key={i} cx={i * stepX} cy={H - ((v - min) / range) * H} r={3} className={color} fill="currentColor" />
          ) : null
        )}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function SmartwatchPanel({ profile }: Props) {
  const today = todayKey();
  const stored: WatchDaySnapshot = (profile.dailyLogs?.[today] as any)?.watch || {};

  // Use the same centralized age resolver as the AI engine (fixes the 30 vs 25 drift)
  const age = resolveClientAge(profile);
  const maxHr = maxHrForAge(age);

  // ── Tabs ─────────────────────────────────────────────────────────────────
  type PanelTab = 'today' | 'trends' | 'connect';
  const [tab, setTab] = useState<PanelTab>('today');

  // ── Derived recovery score ────────────────────────────────────────────────
  const recoveryScore = stored.recoveryScore ?? deriveRecoveryScore(stored);
  const recoveryFb = useMemo(() => buildRecoveryFeedback(recoveryScore), [recoveryScore]);

  // ── Feedback builders ─────────────────────────────────────────────────────
  const stepsFb = useMemo(() => buildStepsFeedback(stored.steps), [stored.steps]);
  const sleepFb = useMemo(() => buildSleepFeedback(stored.sleepHours), [stored.sleepHours]);
  const [liveHr, setLiveHr] = useState<number | undefined>(stored.hr);
  const hrFb = useMemo(() => buildHrFeedback(liveHr ?? stored.hr), [liveHr, stored.hr]);
  const hrvFb = useMemo(() => buildHrvFeedback(stored.hrv), [stored.hrv]);

  // ── Adaptive advice ───────────────────────────────────────────────────────
  const advice = useMemo(() => buildAdaptiveCoachingAdvice({
    sleepHours: stored.sleepHours,
    hrv: stored.hrv,
    recoveryScore,
    hrStrain: stored.hrStrain,
  }), [stored.sleepHours, stored.hrv, recoveryScore, stored.hrStrain]);

  const lastNotifiedCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!advice) return;
    if (lastNotifiedCodeRef.current === advice.code) return;
    lastNotifiedCodeRef.current = advice.code;
    pushAdvisoryNotification(profile.uid, advice).catch((err) =>
      console.warn('[SmartwatchPanel] notify advice failed:', err)
    );
  }, [advice, profile.uid]);

  // ── Manual entry ──────────────────────────────────────────────────────────
  const [showManual, setShowManual] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manualFields, setManualFields] = useState({
    steps: stored.steps?.toString() || '',
    sleepHours: stored.sleepHours?.toString() || '',
    hr: stored.hr?.toString() || '',
    hrResting: stored.hrResting?.toString() || '',
    hrv: stored.hrv?.toString() || '',
    spo2: stored.spo2?.toString() || '',
    calories: stored.calories?.toString() || '',
    sleepDeep: stored.sleepDeep?.toString() || '',
    sleepRem: stored.sleepRem?.toString() || '',
    bodyWeight: stored.bodyWeight?.toString() || '',
    recoveryScore: stored.recoveryScore?.toString() || '',
  });

  useEffect(() => {
    if (!showManual) {
      setManualFields({
        steps: stored.steps?.toString() || '',
        sleepHours: stored.sleepHours?.toString() || '',
        hr: stored.hr?.toString() || '',
        hrResting: stored.hrResting?.toString() || '',
        hrv: stored.hrv?.toString() || '',
        spo2: stored.spo2?.toString() || '',
        calories: stored.calories?.toString() || '',
        sleepDeep: stored.sleepDeep?.toString() || '',
        sleepRem: stored.sleepRem?.toString() || '',
        bodyWeight: stored.bodyWeight?.toString() || '',
        recoveryScore: stored.recoveryScore?.toString() || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.steps, stored.sleepHours, stored.hr, stored.hrv]);

  const [manualError, setManualError] = useState<string | null>(null);
  const handleSaveManual = async () => {
    const parse = (s: string, min?: number, max?: number): number | undefined => {
      if (s.trim() === '') return undefined;
      const n = Number(s);
      if (Number.isNaN(n)) return NaN;
      if (min !== undefined && n < min) return NaN;
      if (max !== undefined && n > max) return NaN;
      return n;
    };
    const steps      = parse(manualFields.steps, 0);
    const sleepHours = parse(manualFields.sleepHours, 0, 24);
    const hr         = parse(manualFields.hr, 20, 250);
    const hrResting  = parse(manualFields.hrResting, 20, 120);
    const hrv        = parse(manualFields.hrv, 0, 300);
    const spo2       = parse(manualFields.spo2, 50, 100);
    const calories   = parse(manualFields.calories, 0);
    const sleepDeep  = parse(manualFields.sleepDeep, 0, 12);
    const sleepRem   = parse(manualFields.sleepRem, 0, 12);
    const bodyWeight = parse(manualFields.bodyWeight, 20, 300);
    const recScore   = parse(manualFields.recoveryScore, 0, 100);

    const invalids = Object.entries({ steps, sleepHours, hr, hrResting, hrv, spo2, calories, sleepDeep, sleepRem, bodyWeight, recScore })
      .filter(([, v]) => v !== undefined && Number.isNaN(v));
    if (invalids.length) {
      setManualError('قيمة غير صحيحة — تحقق من الأرقام المدخلة.');
      return;
    }

    const patch: Partial<WatchDaySnapshot> = {
      provider: 'manual',
      syncedAt: new Date().toISOString(),
    };
    if (steps !== undefined)      patch.steps = Math.round(steps);
    if (sleepHours !== undefined)  patch.sleepHours = Math.round(sleepHours * 4) / 4;
    if (hr !== undefined)          patch.hr = Math.round(hr);
    if (hrResting !== undefined)   patch.hrResting = Math.round(hrResting);
    if (hrv !== undefined)         patch.hrv = Math.round(hrv);
    if (spo2 !== undefined)        patch.spo2 = Math.round(spo2 * 10) / 10;
    if (calories !== undefined)    patch.calories = Math.round(calories);
    if (sleepDeep !== undefined)   patch.sleepDeep = Math.round(sleepDeep * 4) / 4;
    if (sleepRem !== undefined)    patch.sleepRem = Math.round(sleepRem * 4) / 4;
    if (bodyWeight !== undefined)  patch.bodyWeight = Math.round(bodyWeight * 10) / 10;
    if (recScore !== undefined)    patch.recoveryScore = Math.round(recScore);

    // Auto-derive recovery if not manually set
    if (!patch.recoveryScore) {
      const derived = deriveRecoveryScore(patch);
      if (derived !== undefined) patch.recoveryScore = derived;
    }

    setManualError(null);
    setSavingManual(true);
    try {
      await saveWatchSnapshot(profile.uid, patch);
      setShowManual(false);
    } catch (err: any) {
      setManualError('تعذّر حفظ البيانات. جرب تاني.');
    } finally {
      setSavingManual(false);
    }
  };

  // ── Export import ─────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{
    mappedFields: string[];
    detectedProvider?: string;
    snapshot: Partial<WatchDaySnapshot>;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [savingImport, setSavingImport] = useState(false);

  const handleParseImport = () => {
    setImportError(null);
    setImportResult(null);
    if (!importText.trim()) { setImportError('الصق JSON أو CSV من تطبيق ساعتك أولاً.'); return; }
    const result = parseHealthExport(importText);
    if (result.mappedFields.length === 0) {
      setImportError('لم يتعرف النظام على أي حقل. تأكد من أن المحتوى JSON صحيح.');
      return;
    }
    setImportResult(result);
  };

  const handleSaveImport = async () => {
    if (!importResult) return;
    setSavingImport(true);
    try {
      const patch: Partial<WatchDaySnapshot> = {
        ...importResult.snapshot,
        provider: importResult.detectedProvider as any ?? 'export_import',
        syncedAt: new Date().toISOString(),
      };
      await saveWatchSnapshot(profile.uid, patch);
      setShowImport(false);
      setImportText('');
      setImportResult(null);
    } catch {
      setImportError('تعذّر حفظ البيانات. جرب تاني.');
    } finally {
      setSavingImport(false);
    }
  };

  // ── Web Bluetooth ─────────────────────────────────────────────────────────
  const [hrConnecting, setHrConnecting] = useState(false);
  const [hrConnected, setHrConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | undefined>(stored.deviceName);
  const [btError, setBtError] = useState<string | null>(null);
  const connRef = useRef<HeartRateConnection | null>(null);
  const lastSavedHrRef = useRef<number>(0);
  const lastHrSaveTimeRef = useRef<number>(0);
  const sessionSamplesRef = useRef<HrSample[]>([]);
  const [sessionStrain, setSessionStrain] = useState<{
    strain: 'low' | 'normal' | 'high';
    avgBpm: number;
    pctOfMax: number;
  } | null>(null);
  const persistedStrain = stored.hrStrain;

  useEffect(() => {
    return () => { connRef.current?.disconnect(); connRef.current = null; };
  }, []);

  const handleConnectHr = async () => {
    setBtError(null);
    setHrConnecting(true);
    try {
      sessionSamplesRef.current = [];
      const conn = await connectHeartRate(
        (bpm) => {
          setLiveHr(bpm);
          const arr = sessionSamplesRef.current;
          arr.push({ bpm, at: new Date().toISOString() });
          if (arr.length > 600) arr.shift();
          if (arr.length >= 5) setSessionStrain(computeHrStrain(arr, age));
          // Throttle: min ±3 BPM change AND min 60s between writes
          const now = Date.now();
          if (
            Math.abs(bpm - lastSavedHrRef.current) >= 3 &&
            now - lastHrSaveTimeRef.current >= 60_000
          ) {
            lastSavedHrRef.current = bpm;
            lastHrSaveTimeRef.current = now;
            saveWatchSnapshot(profile.uid, {
              hr: bpm,
              hrUpdatedAt: new Date().toISOString(),
              provider: 'web_bluetooth',
            }).catch((e) => console.warn('[SmartwatchPanel] hr save failed:', e));
          }
        },
        () => { setHrConnected(false); connRef.current = null; }
      );
      connRef.current = conn;
      setHrConnected(true);
      const name = conn.device.name || 'Heart Rate Sensor';
      setDeviceName(name);
      saveWatchSnapshot(profile.uid, { deviceName: name, provider: 'web_bluetooth' }).catch(() => {});
    } catch (err: any) {
      if (err?.name !== 'NotFoundError' && err?.name !== 'AbortError') {
        setBtError(err?.message || 'تعذّر الاتصال بحساس النبض.');
      }
    } finally {
      setHrConnecting(false);
    }
  };

  const handleDisconnectHr = () => {
    connRef.current?.disconnect();
    connRef.current = null;
    setHrConnected(false);
    const samples = sessionSamplesRef.current;
    if (samples.length >= 5) {
      const summary = computeHrStrain(samples, age);
      saveWatchSnapshot(profile.uid, {
        hrStrain: summary.strain,
        hrStrainAvg: summary.avgBpm,
        hrStrainPct: summary.pctOfMax,
        hrSessionEndedAt: new Date().toISOString(),
      }).catch((e) => console.warn('[SmartwatchPanel] strain save failed:', e));
    }
  };

  const btSupported = isWebBluetoothAvailable();
  const nativeAndroid = isNativeAndroid();
  const nativeIos = isNativeIos();

  // ── UI helpers ────────────────────────────────────────────────────────────
  const [showMoreStats, setShowMoreStats] = useState(false);
  const providerLabel = stored.provider
    ? PROVIDER_REGISTRY.find(p => p.key === stored.provider)?.nameAr ?? stored.provider
    : null;

  return (
    <div className="rounded-[2rem] bg-slate-900 border border-white/5 p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">مزامنة الصحة والنشاط</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {providerLabel ? `مصدر: ${providerLabel}` : 'Wearable · Health Data · AI Coach'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setTab('connect'); }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-white/5 transition flex items-center gap-1"
            title="استيراد من تطبيق الساعة"
          >
            <Upload size={11} /> استيراد
          </button>
          <button
            onClick={() => setShowManual(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-white/5 transition flex items-center gap-1"
          >
            <RefreshCw size={11} /> يدوي
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-slate-950/40 rounded-2xl border border-white/5">
        {(['today', 'trends', 'connect'] as PanelTab[]).map((t) => {
          const labels: Record<PanelTab, string> = { today: 'اليوم', trends: 'الاتجاهات', connect: 'الاتصال' };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                tab === t ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: TODAY
         ══════════════════════════════════════════════════════════════════ */}
      {tab === 'today' && (
        <div className="space-y-4">
          {/* Adaptive coaching banner */}
          {advice && (
            <div className={`rounded-2xl border p-3 flex gap-3 ${
              advice.severity === 'alert'
                ? 'border-rose-400/40 bg-rose-500/10'
                : 'border-amber-400/40 bg-amber-500/10'
            }`}>
              {advice.severity === 'alert'
                ? <AlertCircle size={18} className="text-rose-300 shrink-0 mt-0.5" />
                : <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
              }
              <div className="min-w-0">
                <p className={`text-[12px] font-bold ${advice.severity === 'alert' ? 'text-rose-200' : 'text-amber-200'}`}>
                  {advice.title} — توصية الكوتش الذكي
                </p>
                <p className={`text-[11px] leading-relaxed mt-1 ${advice.severity === 'alert' ? 'text-rose-100/90' : 'text-amber-100/90'}`}>
                  {advice.message}
                </p>
              </div>
            </div>
          )}

          {/* Recovery ring + score */}
          {recoveryScore !== undefined && (
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-950/40 border border-white/5">
              <div className="relative shrink-0">
                <RecoveryRing score={recoveryScore} />
                <div className="absolute inset-0 flex items-center justify-center rotate-0">
                  <div className="text-center">
                    <span className="text-lg font-black text-white">{recoveryScore}</span>
                    <span className="block text-[9px] text-slate-500 font-bold -mt-0.5">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-300 mb-0.5">درجة الاستشفاء</p>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[recoveryFb.tone]}`} />
                  <p className={`text-[11px] leading-relaxed ${TONE_STYLES[recoveryFb.tone]}`}>{recoveryFb.message}</p>
                </div>
                {stored.hrv !== undefined && (
                  <p className="text-[10px] text-slate-500">HRV: {stored.hrv}ms · {buildHrvFeedback(stored.hrv).message}</p>
                )}
              </div>
            </div>
          )}

          {/* HR strain feedback */}
          {(sessionStrain || persistedStrain) && (() => {
            const s = sessionStrain?.strain ?? persistedStrain!;
            const isHigh = s === 'high';
            const isLow = s === 'low';
            const tone = isHigh
              ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
              : isLow
              ? 'border-blue-400/40 bg-blue-500/10 text-blue-200'
              : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
            const headline = isHigh ? 'إجهاد قلبي مرتفع' : isLow ? 'الجلسة منخفضة الشدة' : 'شدة الجلسة طبيعية';
            const body = isHigh
              ? `متوسط النبض ${sessionStrain?.avgBpm ?? stored.hrStrainAvg ?? '—'} bpm = ${sessionStrain?.pctOfMax ?? stored.hrStrainPct ?? '—'}% من Max HR (${maxHr}). الكوتش سيخفف الأوزان 10-15% الجلسة الجاية.`
              : isLow
              ? 'النبض تحت 60% من Max HR — تقدر تزود الشدة شوية المرة الجاية.'
              : `متوسط النبض ${sessionStrain?.avgBpm ?? stored.hrStrainAvg ?? '—'} bpm — في النطاق المثالي للتدريب.`;
            return (
              <div className={`rounded-2xl border p-3 flex gap-3 ${tone}`}>
                <Heart size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold">{headline} {sessionStrain ? '· مباشر' : '· الجلسة السابقة'}</p>
                  <p className="text-[11px] leading-relaxed mt-1 opacity-90">{body}</p>
                </div>
              </div>
            );
          })()}

          {/* Primary stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<Footprints size={14} />}
              accent="text-emerald-400 bg-emerald-500/10 border-emerald-400/20"
              label="الخطوات"
              value={stored.steps !== undefined ? stored.steps.toLocaleString('ar-EG') : '—'}
              unit="step"
              feedback={stepsFb}
            />
            <StatCard
              icon={<Moon size={14} />}
              accent="text-violet-300 bg-violet-500/10 border-violet-400/20"
              label="النوم"
              value={stored.sleepHours !== undefined ? stored.sleepHours.toString() : '—'}
              unit="hr"
              feedback={sleepFb}
            />
            <StatCard
              icon={<Heart size={14} className={hrConnected ? 'animate-pulse' : ''} />}
              accent="text-rose-300 bg-rose-500/10 border-rose-400/20"
              label="النبض"
              value={(liveHr ?? stored.hr) !== undefined ? String(liveHr ?? stored.hr) : '—'}
              unit="bpm"
              feedback={hrFb}
              live={hrConnected}
            />
          </div>

          {/* Extended stats (collapsed by default) */}
          {(stored.hrv !== undefined || stored.spo2 !== undefined || stored.calories !== undefined || stored.bodyWeight !== undefined) && (
            <div className="space-y-2">
              <button
                onClick={() => setShowMoreStats(!showMoreStats)}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition font-bold"
              >
                {showMoreStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showMoreStats ? 'إخفاء تفاصيل إضافية' : 'مزيد من القياسات'}
              </button>
              <AnimatePresence>
                {showMoreStats && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {stored.hrv !== undefined && (
                        <StatCard icon={<Wind size={12} />} accent="text-sky-300 bg-sky-500/10 border-sky-400/20"
                          label="HRV" value={stored.hrv.toString()} unit="ms" feedback={hrvFb} />
                      )}
                      {stored.spo2 !== undefined && (
                        <StatCard icon={<Droplets size={12} />} accent="text-blue-300 bg-blue-500/10 border-blue-400/20"
                          label="SpO₂" value={stored.spo2.toString()} unit="%"
                          feedback={stored.spo2 >= 95 ? { tone: 'good', message: 'أكسجين طبيعي ممتاز.' }
                            : stored.spo2 >= 92 ? { tone: 'warn', message: 'أكسجين منخفض قليلاً.' }
                            : { tone: 'low', message: 'أكسجين منخفض — راجع طبيبك.' }} />
                      )}
                      {stored.calories !== undefined && (
                        <StatCard icon={<Zap size={12} />} accent="text-orange-300 bg-orange-500/10 border-orange-400/20"
                          label="السعرات" value={stored.calories.toLocaleString()} unit="kcal"
                          feedback={stored.calories >= 300 ? { tone: 'good', message: 'نشاط جيد اليوم.' }
                            : { tone: 'warn', message: 'حاول تزود نشاطك اليومي.' }} />
                      )}
                      {stored.bodyWeight !== undefined && (
                        <StatCard icon={<Scale size={12} />} accent="text-teal-300 bg-teal-500/10 border-teal-400/20"
                          label="الوزن" value={stored.bodyWeight.toString()} unit="kg"
                          feedback={{ tone: 'good', message: 'تم تسجيل الوزن.' }} />
                      )}
                    </div>
                    {(stored.sleepDeep !== undefined || stored.sleepRem !== undefined) && (
                      <div className="mt-2 p-3 rounded-2xl bg-slate-950/40 border border-white/5 space-y-1">
                        <p className="text-[11px] font-bold text-slate-400">تفاصيل النوم</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {stored.sleepDeep !== undefined && (
                            <div>
                              <p className="text-lg font-black text-white">{stored.sleepDeep}</p>
                              <p className="text-[9px] text-slate-500">نوم عميق hr</p>
                            </div>
                          )}
                          {stored.sleepRem !== undefined && (
                            <div>
                              <p className="text-lg font-black text-white">{stored.sleepRem}</p>
                              <p className="text-[9px] text-slate-500">REM hr</p>
                            </div>
                          )}
                          {stored.sleepLight !== undefined && (
                            <div>
                              <p className="text-lg font-black text-white">{stored.sleepLight}</p>
                              <p className="text-[9px] text-slate-500">خفيف hr</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Web Bluetooth HR bar */}
          <div className="rounded-2xl bg-slate-950/40 border border-white/5 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              {hrConnected
                ? <Bluetooth size={16} className="text-blue-400" />
                : <BluetoothOff size={16} className="text-slate-500" />
              }
              <div className="min-w-0">
                <p className="text-[12px] text-slate-200 font-bold truncate">
                  {hrConnected
                    ? `متصل بـ ${deviceName || 'الحساس'}`
                    : btSupported
                    ? 'وصّل ساعتك أو حزام الصدر لقياس مباشر'
                    : 'متصفحك لا يدعم Web Bluetooth'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {btSupported
                    ? 'يدعم أي ساعة / حزام بمعيار Heart Rate Service (Polar, Garmin, Wahoo…)'
                    : 'استخدم Chrome على ويندوز / أندرويد أو أدخل البيانات يدويًا.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hrConnected ? (
                <button onClick={handleDisconnectHr}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/25 transition">
                  فصل الجهاز
                </button>
              ) : (
                <button onClick={handleConnectHr} disabled={!btSupported || hrConnecting}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition flex items-center gap-1.5">
                  {hrConnecting ? <Loader2 size={12} className="animate-spin" /> : <Bluetooth size={12} />}
                  {hrConnecting ? 'جارٍ الاتصال' : 'وصّل الساعة'}
                </button>
              )}
            </div>
          </div>
          {btError && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">{btError}</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: TRENDS (7-day sparklines)
         ══════════════════════════════════════════════════════════════════ */}
      {tab === 'trends' && (
        <div className="space-y-3">
          <TrendChart dailyLogs={profile.dailyLogs} field="recoveryScore" label="درجة الاستشفاء" unit="/100" color="text-emerald-400" />
          <TrendChart dailyLogs={profile.dailyLogs} field="sleepHours" label="النوم" unit="hr" color="text-violet-400" />
          <TrendChart dailyLogs={profile.dailyLogs} field="steps" label="الخطوات" unit="step" color="text-cyan-400" />
          <TrendChart dailyLogs={profile.dailyLogs} field="hrResting" label="نبض الراحة" unit="bpm" color="text-rose-400" />
          <TrendChart dailyLogs={profile.dailyLogs} field="hrv" label="HRV" unit="ms" color="text-sky-400" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: CONNECT (provider catalog)
         ══════════════════════════════════════════════════════════════════ */}
      {tab === 'connect' && (
        <div className="space-y-4">
          {/* Native bridge notice */}
          {!nativeAndroid && !nativeIos && (
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 flex gap-2">
              <Info size={16} className="text-blue-300 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200 leading-relaxed">
                Health Connect (أندرويد) و HealthKit (iOS) تحتاج نسخة مثبَّتة من التطبيق على الجهاز.
                حاليًا يمكنك مزامنة البيانات عبر الاستيراد من تطبيق ساعتك أو الإدخال اليدوي.
              </p>
            </div>
          )}

          {/* Available providers */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">المصادر المتاحة</p>
            {getAvailableProviders().map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/40 border border-white/5">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-white">{p.nameAr}</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{p.descriptionAr}</p>
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                  متاح
                </span>
              </div>
            ))}
          </div>

          {/* All providers catalog */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">كل المزوّدين</p>
            {PROVIDER_REGISTRY.filter((p) => !['manual', 'web_bluetooth', 'health_connect', 'healthkit', 'export_import'].includes(p.key)).map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/40 border border-white/5 opacity-60">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-300">{p.nameAr}</p>
                  <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">
                    متاح عبر الاستيراد: {p.descriptionAr}
                  </p>
                </div>
                <button
                  onClick={() => setShowImport(true)}
                  className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-700 text-slate-300 border border-white/10 hover:bg-slate-600 transition"
                >
                  استيراد
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: MANUAL ENTRY
         ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setShowManual(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-slate-900 border border-white/5 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">سجّل بيانات اليوم يدويًا</h4>
                <button onClick={() => setShowManual(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'steps',         label: 'الخطوات',           unit: 'خطوة',  step: 100, min: 0, max: 100000 },
                  { key: 'sleepHours',    label: 'ساعات النوم',       unit: 'ساعة',  step: 0.25, min: 0, max: 24 },
                  { key: 'hr',            label: 'النبض الآن',        unit: 'bpm',   step: 1, min: 20, max: 250 },
                  { key: 'hrResting',     label: 'نبض الراحة',        unit: 'bpm',   step: 1, min: 20, max: 120 },
                  { key: 'hrv',           label: 'HRV',                unit: 'ms',    step: 1, min: 0, max: 300 },
                  { key: 'spo2',          label: 'SpO₂',              unit: '%',     step: 0.1, min: 50, max: 100 },
                  { key: 'calories',      label: 'السعرات النشطة',    unit: 'kcal',  step: 1, min: 0, max: 5000 },
                  { key: 'sleepDeep',     label: 'نوم عميق',          unit: 'ساعة',  step: 0.1, min: 0, max: 12 },
                  { key: 'sleepRem',      label: 'نوم REM',           unit: 'ساعة',  step: 0.1, min: 0, max: 12 },
                  { key: 'bodyWeight',    label: 'الوزن',             unit: 'kg',    step: 0.1, min: 20, max: 300 },
                  { key: 'recoveryScore', label: 'درجة الاستشفاء',   unit: '/100',  step: 1, min: 0, max: 100 },
                ].map(({ key, label, unit, step, min, max }) => (
                  <label key={key} className="block">
                    <span className="text-[10px] font-bold text-slate-400">{label} <span className="text-slate-600">({unit})</span></span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={step}
                      min={min}
                      max={max}
                      value={(manualFields as any)[key]}
                      onChange={(e) => setManualFields((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={`اختياري`}
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-white/10 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-400/30"
                    />
                  </label>
                ))}
              </div>

              {manualError && (
                <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl p-2">{manualError}</p>
              )}
              <button
                onClick={handleSaveManual}
                disabled={savingManual}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition"
              >
                {savingManual ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: HEALTH EXPORT IMPORT
         ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showImport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setShowImport(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-slate-900 border border-white/5 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-white">استيراد من تطبيق الساعة</h4>
                <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5">
                  <X size={16} />
                </button>
              </div>

              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-3 text-[11px] text-blue-200 leading-relaxed space-y-1">
                <p className="font-bold">كيفية التصدير:</p>
                <p>• <strong>Garmin Connect:</strong> أنشطة ← اليوم ← تصدير JSON</p>
                <p>• <strong>Oura:</strong> الملف الشخصي ← تصدير البيانات ← اختر اليوم</p>
                <p>• <strong>WHOOP:</strong> الملف الشخصي ← تنزيل بياناتي</p>
                <p>• <strong>Fitbit:</strong> Account ← Export Data ← JSON</p>
                <p>• <strong>Samsung Health:</strong> Profile ← Download Personal Data</p>
                <p>• <strong>Polar Flow:</strong> Training ← Export Training ← JSON</p>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-400">الصق محتوى الملف المُصدَّر هنا (JSON)</span>
                <textarea
                  rows={7}
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportResult(null); setImportError(null); }}
                  placeholder='{ "steps": 8234, "restingHeartRate": 58, "sleepHours": 7.5, ... }'
                  dir="ltr"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-400/30 font-mono resize-none"
                />
              </label>

              {importResult && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <p className="text-[12px] font-bold text-emerald-300">
                      تم التعرف على {importResult.mappedFields.length} حقل
                      {importResult.detectedProvider && ` من ${importResult.detectedProvider}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {importResult.mappedFields.map((f) => {
                      const val = (importResult.snapshot as any)[f];
                      return (
                        <div key={f} className="flex justify-between text-[10px]">
                          <span className="text-slate-400">{f}:</span>
                          <span className="text-white font-bold">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {importError && (
                <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl p-2">{importError}</p>
              )}

              <div className="flex gap-2">
                {!importResult ? (
                  <button
                    onClick={handleParseImport}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition"
                  >
                    <TrendingUp size={14} /> تحليل البيانات
                  </button>
                ) : (
                  <button
                    onClick={handleSaveImport}
                    disabled={savingImport}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition"
                  >
                    {savingImport ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ البيانات
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
