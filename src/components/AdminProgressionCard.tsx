import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Repeat, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { computeProgression } from '../services/aiMasterEngine';
import type { UserProfile } from '../types';

interface Props {
  client: UserProfile;
  /** The current cycle's prescribed % of 1RM (from ScientificEngineCard) */
  currentIntensityPercent: number;
}

/**
 * AdminProgressionCard — read-only visualization of the 14-day adaptive
 * progression engine (Steps 6→9). Shows the coach what the next cycle's
 * prescribed load + volume will be BEFORE publishing the new plan.
 */
export default function AdminProgressionCard({ client, currentIntensityPercent }: Props) {
  const progression = useMemo(
    () => computeProgression(client, currentIntensityPercent),
    [client, currentIntensityPercent]
  );

  const statusBadge = {
    improved: {
      label: 'تحسن واضح — Progressive Overload',
      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
      icon: TrendingUp,
      tone: 'emerald' as const,
    },
    fatigued: {
      label: 'إجهاد — De-load Cycle',
      cls: 'bg-red-500/15 text-red-300 border-red-400/30',
      icon: TrendingDown,
      tone: 'red' as const,
    },
    neutral: {
      label: 'استقرار — Maintenance',
      cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
      icon: Minus,
      tone: 'slate' as const,
    },
  }[progression.status];
  const StatusIcon = statusBadge.icon;

  const intensityDelta = progression.newIntensityPercent - progression.previousIntensityPercent;
  const volumeDeltaPct = Math.round((progression.volumeMultiplier - 1) * 100);

  return (
    <div className="bg-gradient-to-br from-cyan-500/5 via-indigo-500/5 to-purple-500/5 border border-cyan-400/20 rounded-3xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
            <Repeat size={22} className="text-cyan-300" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">محرك التطوير التكيفي (14 يوم)</h3>
            <p className="text-[11px] text-slate-400">
              الخطوات 6→9 — يحلل التزام العميل تلقائياً ويعدل الحمل قبل الدورة الجديدة.
            </p>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 whitespace-nowrap ${statusBadge.cls}`}>
          <StatusIcon size={14} /> {statusBadge.label}
        </span>
      </div>

      {/* WINDOW METRICS */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
          <Activity size={14} /> الخطوة 6+7 — تحليل آخر 14 يوم
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <Metric label="أيام مجدولة" value={`${progression.window.scheduledDays}`} />
          <Metric
            label="نسبة الإكمال"
            value={`${Math.round(progression.window.completionRate * 100)}%`}
            flag={progression.window.completionRate < 0.5}
          />
          <Metric
            label="أيام مفقودة"
            value={`${progression.window.missedDays}`}
            flag={progression.window.missedDays >= 4}
          />
          <Metric
            label="متوسط الطاقة"
            value={progression.window.avgEnergy !== null ? `${progression.window.avgEnergy}/10` : '—'}
            flag={progression.window.avgEnergy !== null && progression.window.avgEnergy <= 4}
          />
        </div>
        {progression.window.avgRPE !== null && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <Metric
              label="متوسط RPE"
              value={`${progression.window.avgRPE}/10`}
              flag={progression.window.avgRPE >= 9}
            />
            <Metric
              label="أيام إكمال كامل"
              value={`${progression.window.fullySessionDays}`}
            />
          </div>
        )}
        <div className="mt-3 space-y-1">
          {progression.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-cyan-200">
              {progression.status === 'fatigued' ? (
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-red-300" />
              ) : (
                <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
              )}
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DECISION — NEW LOAD + VOLUME */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-purple-300 mb-3 flex items-center gap-1.5">
          <Repeat size={14} /> الخطوة 8+9 — وصفة الدورة الجديدة
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Box
            tone={statusBadge.tone}
            label="الشدة الجديدة (% من 1RM)"
            value={`${progression.newIntensityPercent}%`}
            sub={`السابق: ${progression.previousIntensityPercent}% (${intensityDelta >= 0 ? '+' : ''}${intensityDelta}%)`}
          />
          <Box
            tone={statusBadge.tone}
            label="معامل الحجم (المجموعات)"
            value={`×${progression.volumeMultiplier.toFixed(2)}`}
            sub={`${volumeDeltaPct >= 0 ? '+' : ''}${volumeDeltaPct}% من حجم الدورة السابقة`}
          />
        </div>
        <p className="mt-3 text-[11px] text-slate-300 leading-relaxed bg-slate-800/40 border border-white/5 rounded-xl p-3">
          {progression.prescription.rationale}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div className={`rounded-xl py-2 px-1 border ${flag ? 'bg-red-500/10 border-red-400/30' : 'bg-slate-800/40 border-white/5'}`}>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-sm font-black ${flag ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function Box({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'red' | 'slate';
}) {
  const cls = {
    emerald: 'from-emerald-500/15 to-cyan-500/15 border-emerald-400/30 text-emerald-300',
    red: 'from-red-500/15 to-pink-500/15 border-red-400/30 text-red-300',
    slate: 'from-slate-500/10 to-slate-700/10 border-slate-400/20 text-slate-200',
  }[tone];
  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-xl p-3 text-center`}>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-3xl font-black leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}
