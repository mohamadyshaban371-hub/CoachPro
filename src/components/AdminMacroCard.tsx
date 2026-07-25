import React, { useMemo } from 'react';
import { Flame, Beef, Wheat, Droplets, Apple, Calculator } from 'lucide-react';
import { computeMacrosFromProfile } from '../services/aiMasterEngine';
import type { UserProfile, FullQuestionnaire } from '../types';

interface Props {
  client: UserProfile;
  questionnaire?: FullQuestionnaire | null;
}

/**
 * AdminMacroCard — read-only deterministic visualization of the calorie /
 * macro / hydration targets the AI is FORCED to hit. Mirrors what
 * `aiMasterEngine.generateNutritionDraft` injects into Gemini as hard
 * rails, so the coach can audit the numbers BEFORE publishing the plan.
 *
 * Returns null gracefully if the client hasn't completed the nutrition
 * survey yet (no weight / height to compute from).
 */
export default function AdminMacroCard({ client, questionnaire }: Props) {
  const macros = useMemo(
    () => computeMacrosFromProfile(client, questionnaire || undefined),
    [client, questionnaire]
  );

  if (!macros) {
    return (
      <div className="bg-amber-500/5 border border-amber-400/20 rounded-3xl p-6 text-center">
        <p className="text-sm text-amber-300 font-bold">
          لا يمكن حساب الماكروز بعد — العميل لم يُكمل قياسات الوزن / الطول.
        </p>
      </div>
    );
  }

  const proteinKcal = macros.proteinG * 4;
  const fatKcal = macros.fatG * 9;
  const carbsKcal = macros.carbsG * 4;
  const total = Math.max(1, proteinKcal + fatKcal + carbsKcal);
  const proteinPct = Math.round((proteinKcal / total) * 100);
  const fatPct = Math.round((fatKcal / total) * 100);
  const carbsPct = Math.max(0, 100 - proteinPct - fatPct);

  return (
    <div className="bg-gradient-to-br from-pink-500/5 via-orange-500/5 to-amber-500/5 border border-pink-400/20 rounded-3xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-pink-500/15 border border-pink-400/30 flex items-center justify-center">
            <Calculator size={22} className="text-pink-300" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">حاسبة الماكروز الحتمية</h3>
            <p className="text-[11px] text-slate-400">
              يُحسب من Mifflin-St Jeor + معامل النشاط ويُرسل للذكاء الاصطناعي كقاعدة صارمة.
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-pink-500/15 text-pink-300 border-pink-400/30">
          {macros.calories} kcal
        </span>
      </div>

      {/* PRIMARY 4 NUMBERS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Big icon={<Flame size={18} />} color="orange" label="السعرات" value={`${macros.calories}`} unit="kcal" />
        <Big icon={<Beef size={18} />} color="red" label="بروتين" value={`${macros.proteinG}`} unit={`g · ${proteinPct}%`} />
        <Big icon={<Wheat size={18} />} color="amber" label="كربوهيدرات" value={`${macros.carbsG}`} unit={`g · ${carbsPct}%`} />
        <Big icon={<Apple size={18} />} color="emerald" label="دهون" value={`${macros.fatG}`} unit={`g · ${fatPct}%`} />
      </div>

      {/* HYDRATION + BMR/TDEE */}
      <div className="grid grid-cols-3 gap-3">
        <Mini icon={<Droplets size={14} className="text-blue-300" />} label="ماء" value={`${macros.waterLiters} L`} />
        <Mini label="BMR" value={`${macros.bmr} kcal`} />
        <Mini label="TDEE" value={`${macros.tdee} kcal`} />
      </div>

      {/* MACRO SPLIT BAR */}
      <div className="space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">توزيع الماكروز</p>
        <div className="flex h-3 rounded-full overflow-hidden border border-white/5">
          <div className="bg-red-500/80" style={{ width: `${proteinPct}%` }} title={`Protein ${proteinPct}%`} />
          <div className="bg-amber-500/80" style={{ width: `${carbsPct}%` }} title={`Carbs ${carbsPct}%`} />
          <div className="bg-emerald-500/80" style={{ width: `${fatPct}%` }} title={`Fat ${fatPct}%`} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>P {proteinPct}%</span>
          <span>C {carbsPct}%</span>
          <span>F {fatPct}%</span>
        </div>
      </div>

      {/* STEP-BY-STEP DERIVATION */}
      <details className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <summary className="text-xs font-bold text-pink-300 cursor-pointer">
          خطوات الحساب التفصيلية ({macros.rationale.length})
        </summary>
        <div className="mt-3 text-[10px] space-y-1 text-slate-400 font-mono leading-relaxed">
          {macros.rationale.map((r, i) => (
            <div key={i} className="border-b border-white/5 pb-1 last:border-0 last:pb-0">
              {r}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Big({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: 'red' | 'orange' | 'amber' | 'emerald';
}) {
  const cls = {
    red: 'from-red-500/15 to-pink-500/15 border-red-400/30 text-red-300',
    orange: 'from-orange-500/15 to-amber-500/15 border-orange-400/30 text-orange-300',
    amber: 'from-amber-500/15 to-yellow-500/15 border-amber-400/30 text-amber-300',
    emerald: 'from-emerald-500/15 to-green-500/15 border-emerald-400/30 text-emerald-300',
  }[color];
  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-2xl p-3 text-center`}>
      <div className="flex items-center justify-center gap-1.5 mb-1 opacity-80">{icon}</div>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-2xl font-black leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500">{unit}</p>
    </div>
  );
}

function Mini({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 border border-white/5 rounded-xl py-2 px-2 text-center">
      <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm font-bold text-white truncate">{value}</p>
    </div>
  );
}
