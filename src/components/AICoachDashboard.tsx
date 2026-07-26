import React, { useEffect } from 'react';
import { Brain, Sparkles, TrendingUp, Utensils, Dumbbell, ClipboardList, ArrowRight } from 'lucide-react';
import { useAICoach } from '../hooks/useAICoach';
import { UserProfile } from '../types';

interface AICoachDashboardProps {
  profile: UserProfile;
  onExportPdf?: () => void | Promise<void>;
}

export default function AICoachDashboard({ profile, onExportPdf }: AICoachDashboardProps) {
  const { analysis, workout, meal, predictions, recommendations, report, loading, error, refresh, generateReport } = useAICoach(profile);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-600/10 to-slate-900 p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-600/20 p-3 text-cyan-400">
            <Brain size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">AI Coach Engine</h3>
            <p className="text-sm text-slate-400">Smart analysis, workout generation, meal planning, predictions, and coaching reports.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-600/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 text-slate-400">Generating your AI insights…</div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Progress score</p>
                <TrendingUp size={16} className="text-cyan-400" />
              </div>
              <div className="mt-3 text-3xl font-black text-white">{analysis?.progressScore ?? 0}%</div>
              <p className="mt-2 text-sm text-slate-500">{analysis?.summary}</p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Adherence score</p>
                <Sparkles size={16} className="text-emerald-400" />
              </div>
              <div className="mt-3 text-3xl font-black text-white">{analysis?.adherenceScore ?? 0}%</div>
              <p className="mt-2 text-sm text-slate-500">{analysis?.nextWeekEstimate}</p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Insights</p>
                <ClipboardList size={16} className="text-purple-400" />
              </div>
              <div className="mt-3 text-sm text-slate-300 space-y-2">
                <p>Fat loss trend: {analysis?.fatLossTrend}</p>
                <p>Muscle trend: {analysis?.muscleGainTrend}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center gap-2 text-blue-400">
                <Dumbbell size={18} />
                <h4 className="text-lg font-black">Suggested workout</h4>
              </div>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-400">{workout?.title}</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {workout?.exercises.map((exercise, index) => (
                    <li key={`${exercise.name}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                      <div className="font-semibold">{exercise.name}</div>
                      <div className="text-xs text-slate-500">{exercise.sets} sets • {exercise.reps} reps • {exercise.rest}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center gap-2 text-emerald-400">
                <Utensils size={18} />
                <h4 className="text-lg font-black">Suggested meal plan</h4>
              </div>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-400">{meal?.title}</p>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  {meal?.calories} kcal • {meal?.protein}g protein • {meal?.carbs}g carbs • {meal?.fat}g fat
                </div>
                <ul className="space-y-2 text-sm text-slate-300">
                  {meal?.meals.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.details}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <h4 className="text-lg font-black text-white">Predictions</h4>
              <div className="mt-4 space-y-3">
                {predictions?.map((prediction) => (
                  <div key={prediction.horizon} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{prediction.horizon}</span>
                      <span className="text-cyan-400">{prediction.confidence}% confidence</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Expected weight: {prediction.expectedWeight}kg • Body fat: {prediction.expectedBodyFat}%</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
              <h4 className="text-lg font-black text-white">Recommendations</h4>
              <div className="mt-4 space-y-3">
                {recommendations?.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-black text-white">Coach report</h4>
                <p className="text-sm text-slate-400">{report?.summary}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void generateReport()}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
                >
                  Generate report
                </button>
                {onExportPdf && (
                  <button
                    onClick={() => void onExportPdf()}
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/40"
                  >
                    Export PDF
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 text-sm text-slate-300">
              <p className="font-semibold">Motivation</p>
              <p className="mt-1 text-slate-500">{report?.motivationalMessage}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
