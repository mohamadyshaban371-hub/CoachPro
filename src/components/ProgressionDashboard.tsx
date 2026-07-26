import React, { useMemo } from 'react';
import { useExerciseStats } from '../hooks/useExerciseStats';
import { useAuth } from '../lib/useAuth';
import { TrendingUp, Target, Award, Zap, AlertCircle, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'motion/react';

interface ProgressionDashboardProps {
  clientUid?: string;
  compact?: boolean;
}

export default function ProgressionDashboard({ clientUid: propClientUid, compact = false }: ProgressionDashboardProps) {
  const { user } = useAuth();
  const uid = propClientUid || user?.uid;
  
  const { stats, prs } = useExerciseStats(uid);

  const topExercises = useMemo(() => {
    return stats
      .filter(s => s.bestWeight && s.bestReps)
      .sort((a, b) => (b.bestVolume || 0) - (a.bestVolume || 0))
      .slice(0, 5);
  }, [stats]);

  const personalRecords = useMemo(() => {
    return stats.filter(s => s.bestWeight).sort((a, b) => (b.bestWeight || 0) - (a.bestWeight || 0)).slice(0, 10);
  }, [stats]);

  const allTimePRs = useMemo(() => {
    const grouped: Record<string, any> = {};
    stats.forEach(s => {
      if (!grouped[s.exerciseName] || (s.bestWeight || 0) > (grouped[s.exerciseName].bestWeight || 0)) {
        grouped[s.exerciseName] = s;
      }
    });
    return Object.values(grouped).sort((a, b) => (b.bestWeight || 0) - (a.bestWeight || 0));
  }, [stats]);

  const progressTrend = useMemo(() => {
    if (stats.length === 0) return null;
    
    const sortedStats = stats.filter(s => s.recentSessions && s.recentSessions.length > 0);
    if (sortedStats.length === 0) return null;

    const totalVolume = sortedStats.reduce((acc, s) => acc + (s.bestVolume || 0), 0);
    const avgReps = sortedStats.reduce((acc, s) => acc + (s.bestReps || 0), 0) / sortedStats.length;
    
    return {
      totalVolume,
      avgReps,
      exerciseCount: sortedStats.length,
    };
  }, [stats]);

  if (compact && stats.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4 text-center text-sm text-slate-400">
        No exercise data yet
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Top Exercises</h3>
        <div className="space-y-2">
          {personalRecords.slice(0, 3).map((ex) => (
            <div key={ex.exerciseName} className="flex items-center justify-between rounded-lg bg-slate-900/30 px-3 py-2">
              <p className="text-sm text-slate-300">{ex.exerciseName}</p>
              <div className="text-right">
                <p className="font-semibold text-white">{ex.bestWeight}kg</p>
                <p className="text-xs text-slate-500">{ex.bestReps} reps</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <TrendingUp className="h-6 w-6 text-green-400" />
            Progression Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-400">Track your strength and progress metrics</p>
        </div>
      </div>

      {/* Overview Cards */}
      {progressTrend && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl border border-white/10 bg-slate-900/30 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Total Volume</p>
                <p className="mt-2 text-2xl font-bold text-white">{progressTrend.totalVolume.toLocaleString()} kg</p>
              </div>
              <Zap className="h-8 w-8 text-cyan-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-white/10 bg-slate-900/30 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Avg Reps/Set</p>
                <p className="mt-2 text-2xl font-bold text-white">{progressTrend.avgReps.toFixed(1)}</p>
              </div>
              <Target className="h-8 w-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/10 bg-slate-900/30 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Exercises Tracked</p>
                <p className="mt-2 text-2xl font-bold text-white">{progressTrend.exerciseCount}</p>
              </div>
              <Award className="h-8 w-8 text-yellow-400" />
            </div>
          </motion.div>
        </div>
      )}

      {/* All Time PRs */}
      <div className="mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
          <Award className="h-5 w-5 text-yellow-400" />
          Personal Records
        </h3>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {allTimePRs.map((ex, idx) => {
            const estimatedOneRM = ex.bestEstimated1RM ? Math.round(ex.bestEstimated1RM) : null;
            return (
              <motion.div
                key={ex.exerciseName}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/30 p-3 hover:border-white/20"
              >
                <div className="flex-1">
                  <p className="font-medium text-white">{ex.exerciseName}</p>
                  <div className="mt-1 flex gap-4 text-xs text-slate-500">
                    <span>Weight: {ex.bestWeight}kg</span>
                    <span>Reps: {ex.bestReps}</span>
                    {estimatedOneRM && <span>Est. 1RM: {estimatedOneRM}kg</span>}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  {ex.lastPerformed && (
                    <p className="text-xs text-slate-500">
                      {new Date(ex.lastPerformed).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recent Session Activity */}
      {topExercises.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Top Exercises by Volume
          </h3>
          <div className="space-y-2">
            {topExercises.map((ex, idx) => {
              const progressPercent = ex.recentSessions && ex.recentSessions.length > 1
                ? Math.round(
                    ((ex.recentSessions[ex.recentSessions.length - 1].volume - ex.recentSessions[0].volume) /
                      ex.recentSessions[0].volume) * 100
                  )
                : 0;

              return (
                <motion.div
                  key={ex.exerciseName}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-lg border border-white/10 bg-slate-900/30 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-white">{ex.exerciseName}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-cyan-400">{ex.bestVolume?.toLocaleString()} kg</p>
                      {progressPercent > 0 && (
                        <span className="text-xs font-semibold text-emerald-400">
                          +{progressPercent}%
                        </span>
                      )}
                      {progressPercent < 0 && (
                        <span className="text-xs font-semibold text-red-400">
                          {progressPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-900">
                    <div
                      className="h-full rounded-full bg-cyan-500"
                      style={{ width: `${Math.min(100, (ex.bestVolume || 0) / 1000) * 100}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session Count */}
      <div className="rounded-lg border border-white/10 bg-slate-900/30 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <Calendar className="h-5 w-5 text-blue-400" />
          Session Statistics
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-400">Total Sessions Tracked</p>
            <p className="mt-1 text-xl font-bold text-white">
              {stats.reduce((acc, s) => acc + (s.recentSessions?.length || 0), 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Unique Exercises</p>
            <p className="mt-1 text-xl font-bold text-white">{stats.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
