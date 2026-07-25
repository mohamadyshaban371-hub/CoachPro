import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  ImageOff,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
  Calendar,
  Scale,
  Activity,
  Droplets,
  Flame,
  Ruler,
} from 'lucide-react';
import { UserProfile, MeasurementHistory } from '../types';

interface FalconEyeProps {
  profile: UserProfile;
}

type PhotoKey = 'front' | 'side' | 'inBody';

interface MetricSpec {
  key: keyof MeasurementHistory;
  label: string;
  unit: string;
  icon: React.ReactNode;
  goodDirection: 'down' | 'up' | 'neutral';
}

const PRIMARY_METRICS: MetricSpec[] = [
  { key: 'weight',          label: 'الوزن',         unit: 'كجم', icon: <Scale size={14} />,    goodDirection: 'down' },
  { key: 'fatPercentage',   label: 'نسبة الدهون',   unit: '%',   icon: <Flame size={14} />,    goodDirection: 'down' },
  { key: 'muscleMass',      label: 'الكتلة العضلية', unit: 'كجم', icon: <Activity size={14} />, goodDirection: 'up'   },
  { key: 'waterPercentage', label: 'نسبة الماء',     unit: '%',   icon: <Droplets size={14} />, goodDirection: 'up'   },
  { key: 'protein',         label: 'البروتين',       unit: 'كجم', icon: <Activity size={14} />, goodDirection: 'up'   },
];

const SECONDARY_METRICS: MetricSpec[] = [
  { key: 'chest', label: 'الصدر',  unit: 'سم', icon: <Ruler size={14} />, goodDirection: 'neutral' },
  { key: 'waist', label: 'الخصر',  unit: 'سم', icon: <Ruler size={14} />, goodDirection: 'down'    },
  { key: 'hips',  label: 'الأرداف', unit: 'سم', icon: <Ruler size={14} />, goodDirection: 'neutral' },
  { key: 'arm',   label: 'الذراع',  unit: 'سم', icon: <Ruler size={14} />, goodDirection: 'up'      },
];

const PHOTO_TABS: { key: PhotoKey; label: string }[] = [
  { key: 'front',  label: 'أمامية'    },
  { key: 'side',   label: 'جانبية'    },
  { key: 'inBody', label: 'InBody' },
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function getNumber(entry: MeasurementHistory | undefined, key: keyof MeasurementHistory): number | undefined {
  if (!entry) return undefined;
  const v = entry[key];
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return undefined;
}

function MetricCell({
  spec,
  before,
  after,
}: {
  spec: MetricSpec;
  before: MeasurementHistory | undefined;
  after: MeasurementHistory | undefined;
}) {
  const b = getNumber(before, spec.key);
  const a = getNumber(after, spec.key);
  const hasBoth = b !== undefined && a !== undefined && (b !== 0 || a !== 0);
  const delta = hasBoth ? (a! - b!) : null;
  const pct = hasBoth && b !== 0 ? ((a! - b!) / b!) * 100 : null;

  let toneClass = 'text-slate-400 bg-slate-800/40 border-white/5';
  let Icon: React.ReactNode = <Minus size={12} />;
  if (delta !== null && delta !== 0 && spec.goodDirection !== 'neutral') {
    const improved =
      (spec.goodDirection === 'down' && delta < 0) ||
      (spec.goodDirection === 'up' && delta > 0);
    toneClass = improved
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20'
      : 'text-rose-300 bg-rose-500/10 border-rose-400/20';
    Icon = delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  } else if (delta !== null && delta !== 0) {
    Icon = delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  }

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-3 flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="text-blue-400">{spec.icon}</span>
        <span className="font-medium">{spec.label}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-slate-500 text-[11px]">قبل</div>
        <div className="text-slate-300 text-sm font-bold tabular-nums">
          {b !== undefined ? `${b.toLocaleString('ar-EG')} ${spec.unit}` : '—'}
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-slate-500 text-[11px]">بعد</div>
        <div className="text-white text-base font-extrabold tabular-nums">
          {a !== undefined ? `${a.toLocaleString('ar-EG')} ${spec.unit}` : '—'}
        </div>
      </div>
      <div className={`mt-1 self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold tabular-nums ${toneClass}`}>
        {Icon}
        {hasBoth ? (
          <>
            {delta! > 0 ? '+' : ''}
            {delta!.toFixed(spec.unit === '%' ? 1 : 1)}
            {spec.unit && <span className="opacity-70"> {spec.unit}</span>}
            {pct !== null && Math.abs(pct) >= 0.1 && (
              <span className="opacity-60">({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
            )}
          </>
        ) : (
          'لا توجد بيانات كافية'
        )}
      </div>
    </div>
  );
}

function HistoryPicker({
  label,
  entries,
  selectedIdx,
  onChange,
  accent,
}: {
  label: string;
  entries: MeasurementHistory[];
  selectedIdx: number;
  onChange: (idx: number) => void;
  accent: 'blue' | 'amber';
}) {
  const accentRing = accent === 'blue' ? 'focus:ring-blue-500/40' : 'focus:ring-amber-500/40';
  const accentDot = accent === 'blue' ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <label className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${accentDot}`} />
        {label}
      </span>
      <div className="relative">
        <select
          value={selectedIdx}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`appearance-none w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2.5 pe-9 text-sm text-white font-medium outline-none focus:ring-2 ${accentRing} transition`}
        >
          {entries.map((e, i) => (
            <option key={`${e.date}-${i}`} value={i} className="bg-slate-900 text-white">
              {formatDate(e.date)} · {e.weight ? `${e.weight}كجم` : 'بدون وزن'}
            </option>
          ))}
        </select>
        <Calendar size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <ChevronDown size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </label>
  );
}

function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState<number>(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const setFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rel = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, rel)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = () => setDragging(false);

  const hasBefore = !!beforeUrl;
  const hasAfter = !!afterUrl;

  if (!hasBefore && !hasAfter) {
    return (
      <div className="aspect-[4/5] sm:aspect-[3/4] w-full rounded-3xl border border-dashed border-white/10 bg-slate-900/40 flex flex-col items-center justify-center gap-2 text-slate-500">
        <ImageOff size={28} />
        <p className="text-xs">لا توجد صور لهذا الزاوية في كلا التاريخين</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/5] sm:aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Bottom layer = AFTER */}
      {hasAfter ? (
        <img
          src={afterUrl}
          alt="بعد"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
          صورة "بعد" غير متوفرة
        </div>
      )}

      {/* Top layer = BEFORE, clipped from the right */}
      {hasBefore ? (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img
            src={beforeUrl}
            alt="قبل"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs bg-slate-900/60"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          صورة "قبل" غير متوفرة
        </div>
      )}

      {/* Date pills */}
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[11px] text-amber-300 font-bold border border-amber-400/20">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[11px] text-blue-300 font-bold border border-blue-400/20">
        {afterLabel}
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-white/0 via-white/80 to-white/0 shadow-[0_0_20px_rgba(255,255,255,0.5)] pointer-events-none"
        style={{ left: `${pos}%` }}
      />

      {/* Drag handle */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-white/95 border border-white shadow-2xl flex items-center justify-center transition-transform ${dragging ? 'scale-110' : ''}`}
        style={{ left: `${pos}%` }}
      >
        <div className="flex items-center gap-0.5 text-slate-900">
          <ChevronDown size={14} className="rotate-90" />
          <ChevronDown size={14} className="-rotate-90" />
        </div>
      </div>

      {/* Hint */}
      {!dragging && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] text-slate-300 border border-white/10">
          اسحب الفاصل لمقارنة الصورتين
        </div>
      )}
    </div>
  );
}

export default function FalconEye({ profile }: FalconEyeProps) {
  const history: MeasurementHistory[] = useMemo(() => {
    const h = profile.measurementHistory ?? [];
    return [...h].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [profile.measurementHistory]);

  const enoughData = history.length >= 2;

  const [beforeIdx, setBeforeIdx] = useState<number>(0);
  const [afterIdx, setAfterIdx] = useState<number>(history.length > 0 ? history.length - 1 : 0);
  const [photoTab, setPhotoTab] = useState<PhotoKey>('front');

  const before = history[beforeIdx];
  const after = history[afterIdx];

  const beforeUrl = before?.photos?.[photoTab] || '';
  const afterUrl = after?.photos?.[photoTab] || '';

  if (!enoughData) {
    return (
      <div className="space-y-6">
        {/* Header even in empty state */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <Eye size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">عين الصقر</h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Falcon Eye · Progress Tracker</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-950 p-8 sm:p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/5 flex items-center justify-center mb-4">
            <Eye size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">لسه محتاج قياسين على الأقل</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            عين الصقر بتقارن قياساتك وصورك بين تاريخين. سجّل قياس جديد دلوقتي وبعد فترة ارجع تاني هنا عشان تشوف الفرق بصرياً.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/5 text-[11px] text-slate-400">
            <Activity size={12} className="text-blue-400" />
            عدد القياسات الحالية: {history.length}
          </div>
        </div>
      </div>
    );
  }

  // Guard against picking same entry on both sides
  const safeBeforeIdx = beforeIdx === afterIdx
    ? (afterIdx > 0 ? afterIdx - 1 : 0)
    : beforeIdx;
  const safeAfter = after;
  const safeBefore = history[safeBeforeIdx];

  const safeBeforeUrl = safeBefore?.photos?.[photoTab] || '';
  const safeAfterUrl = safeAfter?.photos?.[photoTab] || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <Eye size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">عين الصقر</h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Falcon Eye · Progress Tracker</p>
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-[11px] text-blue-300 font-bold">
          <Activity size={12} />
          {history.length} قياسات
        </div>
      </div>

      {/* Date pickers */}
      <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <HistoryPicker
            label="قبل (Before)"
            entries={history}
            selectedIdx={safeBeforeIdx}
            onChange={setBeforeIdx}
            accent="amber"
          />
          <HistoryPicker
            label="بعد (After)"
            entries={history}
            selectedIdx={afterIdx}
            onChange={setAfterIdx}
            accent="blue"
          />
        </div>
      </div>

      {/* Photo angle tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {PHOTO_TABS.map((tab) => {
          const active = photoTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setPhotoTab(tab.key)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-bold border transition ${
                active
                  ? 'bg-blue-600 text-white border-blue-400/30 shadow-lg shadow-blue-500/30'
                  : 'bg-slate-900/50 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* The slider itself */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${safeBeforeIdx}-${afterIdx}-${photoTab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <CompareSlider
            beforeUrl={safeBeforeUrl}
            afterUrl={safeAfterUrl}
            beforeLabel={`قبل · ${formatDate(safeBefore.date)}`}
            afterLabel={`بعد · ${formatDate(safeAfter.date)}`}
          />
        </motion.div>
      </AnimatePresence>

      {/* Primary metrics */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">المؤشرات الأساسية</h3>
          <span className="text-[11px] text-slate-500">من InBody / القياسات</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {PRIMARY_METRICS.map((m) => (
            <MetricCell key={m.key as string} spec={m} before={safeBefore} after={safeAfter} />
          ))}
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">قياسات الجسم (سم)</h3>
          <span className="text-[11px] text-slate-500">شريط القياس</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SECONDARY_METRICS.map((m) => (
            <MetricCell key={m.key as string} spec={m} before={safeBefore} after={safeAfter} />
          ))}
        </div>
      </div>
    </div>
  );
}
