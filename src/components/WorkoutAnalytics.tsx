import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Zap, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'motion/react';

interface WorkoutSession {
  date: string;
  duration: number;
  volume: number;
  intensity: number;
  muscleGroups: string[];
  completed: boolean;
}

interface WorkoutAnalyticsProps {
  sessions?: WorkoutSession[];
  compact?: boolean;
}

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f87171', '#6366f1'];

export default function WorkoutAnalytics({ sessions = [], compact = false }: WorkoutAnalyticsProps) {
  const analytics = useMemo(() => {
    if (sessions.length === 0) {
      return {
        totalWorkouts: 0,
        totalVolume: 0,
        avgDuration: 0,
        avgIntensity: 0,
        completionRate: 0,
        weeklyFrequency: 0,
        muscleBalance: {},
        durationTrend: [],
        volumeTrend: [],
        intensityTrend: [],
      };
    }

    const lastSevenDays = sessions.filter(s => {
      const date = new Date(s.date);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      return diff <= 7 * 24 * 60 * 60 * 1000;
    });

    const totalWorkouts = sessions.length;
    const completedWorkouts = sessions.filter(s => s.completed).length;
    const totalVolume = sessions.reduce((sum, s) => sum + (s.volume || 0), 0);
    const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length;
    const avgIntensity = sessions.reduce((sum, s) => sum + (s.intensity || 0), 0) / sessions.length;
    const completionRate = (completedWorkouts / totalWorkouts) * 100;
    const weeklyFrequency = lastSevenDays.length;

    // Muscle balance
    const muscleBalance: Record<string, number> = {};
    sessions.forEach(s => {
      s.muscleGroups?.forEach(muscle => {
        muscleBalance[muscle] = (muscleBalance[muscle] || 0) + 1;
      });
    });

    // Trends (last 10 sessions)
    const trendSessions = sessions.slice(-10);
    const durationTrend = trendSessions.map(s => ({
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      duration: s.duration,
    }));
    const volumeTrend = trendSessions.map(s => ({
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      volume: s.volume,
    }));
    const intensityTrend = trendSessions.map(s => ({
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      intensity: s.intensity,
    }));

    return {
      totalWorkouts,
      totalVolume,
      avgDuration: Math.round(avgDuration),
      avgIntensity: Math.round(avgIntensity),
      completionRate: Math.round(completionRate),
      weeklyFrequency,
      muscleBalance,
      durationTrend,
      volumeTrend,
      intensityTrend,
    };
  }, [sessions]);

  const muscleBalanceData = useMemo(() => {
    return Object.entries(analytics.muscleBalance)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [analytics.muscleBalance]);

  if (compact) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white text-sm">
          <BarChart3 className="h-4 w-4" />
          Workout Analytics
        </h3>
        <div className="grid gap-3 grid-cols-2">
          <div className="rounded-lg bg-slate-900/30 p-2">
            <p className="text-xs text-slate-500">Total Workouts</p>
            <p className="text-lg font-bold text-white">{analytics.totalWorkouts}</p>
          </div>
          <div className="rounded-lg bg-slate-900/30 p-2">
            <p className="text-xs text-slate-500">Avg Duration</p>
            <p className="text-lg font-bold text-white">{analytics.avgDuration} min</p>
          </div>
          <div className="rounded-lg bg-slate-900/30 p-2">
            <p className="text-xs text-slate-500">Total Volume</p>
            <p className="text-lg font-bold text-white">{(analytics.totalVolume / 1000).toFixed(1)}t</p>
          </div>
          <div className="rounded-lg bg-slate-900/30 p-2">
            <p className="text-xs text-slate-500">Completion</p>
            <p className="text-lg font-bold text-white">{analytics.completionRate}%</p>
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
            <BarChart3 className="h-6 w-6 text-blue-400" />
            Workout Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-400">Detailed workout metrics and trends</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-xl border border-white/10 bg-slate-900/30 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Total Workouts</p>
              <p className="mt-2 text-3xl font-bold text-white">{analytics.totalWorkouts}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
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
              <p className="text-xs uppercase tracking-widest text-slate-500">Avg Duration</p>
              <p className="mt-2 text-3xl font-bold text-white">{analytics.avgDuration} <span className="text-lg text-slate-400">min</span></p>
            </div>
            <Clock className="h-8 w-8 text-cyan-400" />
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
              <p className="text-xs uppercase tracking-widest text-slate-500">Total Volume</p>
              <p className="mt-2 text-3xl font-bold text-white">{(analytics.totalVolume / 1000).toFixed(1)} <span className="text-lg text-slate-400">tons</span></p>
            </div>
            <Zap className="h-8 w-8 text-yellow-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-white/10 bg-slate-900/30 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Completion Rate</p>
              <p className="mt-2 text-3xl font-bold text-white">{analytics.completionRate} <span className="text-lg text-slate-400">%</span></p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-400" />
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Duration Trend */}
        {analytics.durationTrend.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="mb-4 font-semibold text-white">Workout Duration Trend</p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.durationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="#06b6d4"
                  dot={{ fill: '#06b6d4' }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Volume Trend */}
        {analytics.volumeTrend.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="mb-4 font-semibold text-white">Total Volume Trend</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.volumeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="volume" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Muscle Balance */}
      {muscleBalanceData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 mb-6">
          <p className="mb-4 font-semibold text-white">Muscle Group Distribution</p>
          <div className="flex flex-wrap gap-2">
            {muscleBalanceData.map((muscle, idx) => (
              <div
                key={muscle.name}
                className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2"
              >
                <p className="text-sm font-medium text-white">{muscle.name}</p>
                <p className="text-xs text-slate-500">{muscle.value} sessions</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Stats */}
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
        <h3 className="mb-4 font-semibold text-white">Weekly Statistics</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-900/30 p-3">
            <p className="text-sm text-slate-400">Workouts This Week</p>
            <p className="mt-1 text-2xl font-bold text-white">{analytics.weeklyFrequency}</p>
          </div>
          <div className="rounded-lg bg-slate-900/30 p-3">
            <p className="text-sm text-slate-400">Avg Intensity</p>
            <p className="mt-1 text-2xl font-bold text-white">{analytics.avgIntensity} <span className="text-sm text-slate-400">RPE</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
