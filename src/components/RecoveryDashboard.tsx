import React, { useMemo } from 'react';
import { useRecovery } from '../hooks/useRecovery';
import { useAuth } from '../lib/useAuth';
import { Heart, TrendingUp, Zap, Moon, AlertCircle, CheckCircle, AlertTriangle, BarChart3, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface RecoveryDashboardProps {
  clientUid?: string;
  compact?: boolean;
}

export default function RecoveryDashboard({ clientUid: propClientUid, compact = false }: RecoveryDashboardProps) {
  const { user } = useAuth();
  const uid = propClientUid || user?.uid;
  
  const { readiness, recovery, domsScore, records, logFatigue } = useRecovery(uid);

  const trafficLightColor = useMemo(() => {
    if (!readiness) return 'slate';
    const score = readiness.score;
    if (score >= 8) return 'emerald'; // Green - go
    if (score >= 6) return 'amber'; // Yellow - caution
    return 'red'; // Red - stop
  }, [readiness?.score]);

  const trafficLightLabel = useMemo(() => {
    if (!readiness) return 'Unknown';
    const score = readiness.score;
    if (score >= 8) return 'Go';
    if (score >= 6) return 'Caution';
    return 'Rest';
  }, [readiness?.score]);

  if (compact && !readiness) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4 text-center text-sm text-slate-400">
        Loading recovery data...
      </div>
    );
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      emerald: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        icon: 'text-emerald-500',
      },
      amber: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        icon: 'text-amber-500',
      },
      red: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        text: 'text-red-400',
        icon: 'text-red-500',
      },
      slate: {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        text: 'text-slate-400',
        icon: 'text-slate-500',
      },
    };
    return colors[color] || colors.slate;
  };

  const colors = getColorClasses(trafficLightColor);

  if (compact) {
    return (
      <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Recovery Status</p>
            <p className={`mt-1 text-2xl font-bold ${colors.text}`}>{readiness?.score.toFixed(1) || 'N/A'}/10</p>
            <p className="text-xs text-slate-400">{readiness?.category || 'Unknown'}</p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${colors.text}`}>{trafficLightLabel}</p>
            {readiness?.category === 'excellent' ? (
              <CheckCircle className={`mx-auto mt-2 h-6 w-6 ${colors.icon}`} />
            ) : readiness?.category === 'good' ? (
              <Zap className={`mx-auto mt-2 h-6 w-6 ${colors.icon}`} />
            ) : (
              <AlertTriangle className={`mx-auto mt-2 h-6 w-6 ${colors.icon}`} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Heart className="h-6 w-6 text-red-400" />
            Recovery Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-400">Your readiness and recovery metrics</p>
        </div>
      </div>

      {/* Main Traffic Light */}
      {readiness && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`mb-6 rounded-2xl border ${colors.border} ${colors.bg} p-8 text-center`}
        >
          <p className="text-sm uppercase tracking-widest text-slate-500">Training Readiness</p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className={`rounded-full ${colors.bg} p-8 ${colors.border} border-4`}>
              <p className={`text-4xl font-bold ${colors.text}`}>{readiness.score.toFixed(1)}</p>
            </div>
            <div className="text-left">
              <p className={`text-2xl font-bold ${colors.text}`}>{trafficLightLabel}</p>
              <p className="mt-1 text-sm text-slate-400 capitalize">{readiness.category}</p>
              <p className="mt-2 text-xs font-semibold text-slate-300">
                Intensity: {(readiness.trainingIntensityAdjustment * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Readiness Factors */}
      {readiness && (
        <div className="mb-6">
          <h3 className="mb-3 font-semibold text-white">Readiness Factors</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Sleep', value: readiness.factors.sleep, icon: Moon },
              { label: 'Stress', value: readiness.factors.stress, icon: AlertCircle },
              { label: 'Soreness', value: readiness.factors.soreness, icon: Heart },
              { label: 'Workload', value: readiness.factors.workload, icon: Zap },
              { label: 'Recovery', value: readiness.factors.recoveryModalities, icon: TrendingUp },
            ].map((factor) => {
              const Icon = factor.icon;
              const getColor = (val: number) => {
                if (val >= 8) return 'text-emerald-400';
                if (val >= 6) return 'text-amber-400';
                return 'text-red-400';
              };
              return (
                <div key={factor.label} className="rounded-lg border border-white/10 bg-slate-900/30 p-3 text-center">
                  <Icon className={`mx-auto mb-2 h-4 w-4 ${getColor(factor.value)}`} />
                  <p className="text-xs text-slate-500">{factor.label}</p>
                  <p className={`mt-1 text-lg font-bold ${getColor(factor.value)}`}>{factor.value.toFixed(1)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOMS */}
      {domsScore && (
        <div className="mb-6 rounded-lg border border-white/10 bg-slate-900/30 p-4">
          <h3 className="mb-2 font-semibold text-white">Delayed Onset Muscle Soreness (DOMS)</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-slate-400">Current DOMS Score</p>
                <p className="text-lg font-bold text-amber-400">{domsScore.score.toFixed(1)}/10</p>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${(domsScore.score / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
          {domsScore.tips && domsScore.tips.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
              {domsScore.tips.map((tip, idx) => (
                <p key={idx} className="text-xs text-slate-400">• {tip}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {readiness && readiness.recommendations.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-semibold text-white">Recommendations</h3>
          <div className="space-y-2">
            {readiness.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-900/30 p-3">
                {rec.startsWith('✅') ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                ) : rec.startsWith('⚠️') ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                )}
                <p className="text-sm text-slate-300">{rec.replace(/^[✅⚠️]/g, '').trim()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery Modalities */}
      {recovery && recovery.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-white">Recommended Recovery Modalities</h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {recovery.map((modality, idx) => (
              <div key={idx} className="rounded-lg border border-white/10 bg-slate-900/30 p-3">
                <p className="font-medium text-white">{modality.name}</p>
                <p className="text-xs text-slate-500">
                  {modality.duration}min • Effectiveness: {modality.effectiveness}/10
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
