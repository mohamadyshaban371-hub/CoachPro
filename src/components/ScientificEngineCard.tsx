import React, { useMemo } from 'react';
import { Beaker, Activity, AlertTriangle, CheckCircle2, TrendingUp, Target } from 'lucide-react';
import { computeScientificPrescription } from '../services/aiMasterEngine';
import type { UserProfile, FullQuestionnaire } from '../types';

interface Props {
  client: UserProfile;
  questionnaire?: FullQuestionnaire | null;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Read-only visualization of the deterministic Scientific Engine
 * (Steps 0–5). Shows the coach exactly what numbers will be sent
 * to the LLM as hard rails.
 */
export default function ScientificEngineCard({ client, questionnaire, difficulty }: Props) {
  const result = useMemo(
    () => computeScientificPrescription(client, questionnaire || undefined, difficulty),
    [client, questionnaire, difficulty]
  );

  const { step0_input, step1_readiness, step2_tests, step5_decision } = result;

  const statusBadge = {
    normal: { label: 'جاهز للتمرين', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', icon: CheckCircle2 },
    reduce: { label: 'تخفيف الشدة', cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30', icon: AlertTriangle },
    rest:   { label: 'يوم استشفاء', cls: 'bg-red-500/15 text-red-300 border-red-400/30', icon: AlertTriangle },
  }[step1_readiness.status];
  const StatusIcon = statusBadge.icon;

  return (
    <div className="bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5 border border-blue-400/20 rounded-3xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
            <Beaker size={22} className="text-blue-300" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">المحرك العلمي للوصفة التدريبية</h3>
            <p className="text-[11px] text-slate-400">
              يُحسب تلقائياً من البيانات قبل إرسال الخطة للذكاء الاصطناعي.
            </p>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 whitespace-nowrap ${statusBadge.cls}`}>
          <StatusIcon size={14} /> {statusBadge.label}
        </span>
      </div>

      {/* STEP 0 — INPUT SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Pill label="العمر" value={`${step0_input.age} سنة`} />
        <Pill label="المستوى" value={
          step0_input.level === 'beginner' ? 'مبتدئ' :
          step0_input.level === 'intermediate' ? 'متوسط' : 'متقدم'
        } />
        <Pill label="الهدف" value={step0_input.goal} />
        <Pill label="المكان" value={step0_input.location === 'gym' ? 'جيم' : 'منزل'} />
      </div>

      {/* STEP 1 — READINESS */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-blue-300 mb-3 flex items-center gap-1.5 justify-between">
          <span className="flex items-center gap-1.5"><Activity size={14} /> الخطوة 1 — فحص الجاهزية</span>
          {!questionnaire?.workout?.readiness ? (
            <span className="text-[9px] font-bold text-amber-400/80 bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 rounded-lg">
              ⚠ بيانات تقديرية — لم يُملأ الاستبيان
            </span>
          ) : (
            <span className="text-[9px] font-bold text-emerald-400/80 bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 rounded-lg">
              ✓ بيانات حقيقية من الاستبيان
            </span>
          )}
        </h4>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="الضغط" value={`${step0_input.readiness?.stress ?? 4}/10`} flag={(step0_input.readiness?.stress ?? 4) > 8} />
          <Metric label="النوم" value={`${step0_input.readiness?.sleepHours ?? 7}س`} flag={(step0_input.readiness?.sleepHours ?? 7) < 5} />
          <Metric label="الألم" value={`${step0_input.readiness?.pain ?? 0}/10`} flag={(step0_input.readiness?.pain ?? 0) > 6} />
        </div>
        {step1_readiness.alerts.length > 0 && (
          <div className="mt-3 space-y-1">
            {step1_readiness.alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-amber-300">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STEP 5 — DECISION */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-purple-300 mb-3 flex items-center gap-1.5">
          <Target size={14} /> الخطوة 5 — قرار محرك الشدة
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-gradient-to-br from-purple-500/15 to-blue-500/15 border border-purple-400/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400">الشدة الموصوفة</p>
            <p className="text-3xl font-black text-purple-300">{step5_decision.intensityPercent}<span className="text-base">%</span></p>
            <p className="text-[10px] text-slate-500">من الأقصى (1RM)</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/15 to-blue-500/15 border border-emerald-400/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-400">نطاق التكرارات</p>
            <p className="text-base font-black text-emerald-300 leading-tight pt-1">{step5_decision.repRange}</p>
          </div>
        </div>
        <div className="text-[10px] space-y-1 text-slate-400 font-mono leading-relaxed">
          {step5_decision.appliedModifiers.map((m, i) => (
            <div key={i} className="flex justify-between gap-2 border-b border-white/5 pb-1 last:border-0 last:pb-0">
              <span>{m.name}</span>
              <span className="text-white/80">{m.effect}</span>
            </div>
          ))}
        </div>
        {step5_decision.weakAreas.length > 0 && (
          <div className="mt-3 p-2 bg-orange-500/10 border border-orange-400/20 rounded-xl">
            <p className="text-[11px] text-orange-300 font-bold flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} /> قاعدة نقطة الضعف
            </p>
            <p className="text-[10px] text-slate-300">
              يُعطى الأولوية في الخطة لتقوية: {step5_decision.weakAreas.map(id =>
                step2_tests.find(t => t.id === id)?.nameAr || id
              ).join('، ')}
            </p>
          </div>
        )}
      </div>

      {/* STEP 2 + 3 — SELECTED TESTS */}
      <details className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <summary className="text-xs font-bold text-cyan-300 cursor-pointer flex items-center gap-1.5">
          <Beaker size={14} /> الخطوات 2 + 3 — الاختبارات المختارة ({step2_tests.length})
        </summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {step2_tests.map(t => (
            <div key={t.id} className="bg-slate-800/50 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-white">{t.nameAr}</p>
                <span className="text-[9px] text-slate-500">{t.measurement}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">{t.instructionsAr}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 border border-white/5 rounded-xl py-2 px-1">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xs font-bold text-white truncate">{value}</p>
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
