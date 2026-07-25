import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Radar as RadarIcon,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Heart,
  Zap,
} from 'lucide-react';
import { UserProfile } from '../types';

type RadarStatus = 'active' | 'late' | 'attention';

interface RadarRow {
  client: UserProfile;
  status: RadarStatus;
  reasons: string[];
  /** Days since last measurement (Infinity if none). */
  daysSinceMeasurement: number;
  /** Days since last login (Infinity if none). */
  daysSinceLogin: number;
  /** Latest mood score in dailyProgress (or null). */
  latestMood: number | null;
  /** Latest energy level in dailyProgress (or null). */
  latestEnergy: number | null;
  /** Has at least one pending assessment request. */
  hasPendingAssessment: boolean;
}

interface AdminRadarProps {
  clients: UserProfile[];
  /** Called when the admin taps a client row — opens the existing client modal. */
  onSelectClient: (client: UserProfile) => void;
}

const STATUS_META: Record<RadarStatus, { label: string; tone: string; ring: string; icon: React.ReactNode }> = {
  active:    { label: 'نشط',              tone: 'text-emerald-300', ring: 'border-emerald-400/30 bg-emerald-500/10', icon: <CheckCircle2 size={12} /> },
  late:      { label: 'متأخر في التحديث', tone: 'text-amber-300',   ring: 'border-amber-400/30 bg-amber-500/10',     icon: <Clock size={12} /> },
  attention: { label: 'يحتاج اهتمام',     tone: 'text-rose-300',    ring: 'border-rose-400/30 bg-rose-500/10',       icon: <AlertTriangle size={12} /> },
};

/**
 * Computes the radar row for a single client.
 *
 * Rules (from product spec):
 *  - Active     → measurement < 7d  OR login < 3d
 *  - Late       → no measurement in ≥ 14 days
 *  - Attention  → mood/energy ≤ 3 in latest log, OR a pending assessment
 *
 * Attention takes priority over Late, which takes priority over Active.
 */
function computeRow(client: UserProfile): RadarRow {
  const now = Date.now();
  const DAY = 86400000;

  // Latest measurement age
  let daysSinceMeasurement = Number.POSITIVE_INFINITY;
  const history = client.measurementHistory || [];
  if (history.length > 0) {
    const last = history[history.length - 1] as any;
    const ts = last?.date || last?.createdAt || last?.timestamp;
    if (ts) {
      const t = new Date(ts).getTime();
      if (!isNaN(t)) daysSinceMeasurement = Math.floor((now - t) / DAY);
    }
  }

  // Latest login age
  let daysSinceLogin = Number.POSITIVE_INFINITY;
  if (client.lastLoginAt) {
    const t = new Date(client.lastLoginAt as any).getTime();
    if (!isNaN(t)) daysSinceLogin = Math.floor((now - t) / DAY);
  }

  // Latest mood / energy from dailyProgress (sorted by date desc)
  const dp: any = (client as any).dailyProgress || {};
  const dates = Object.keys(dp).sort((a, b) => b.localeCompare(a));
  let latestMood: number | null = null;
  let latestEnergy: number | null = null;
  for (const d of dates) {
    const log = dp[d];
    if (latestMood === null && typeof log?.moodScore === 'number') latestMood = log.moodScore;
    if (latestEnergy === null && typeof log?.energyLevel === 'number') latestEnergy = log.energyLevel;
    if (latestMood !== null && latestEnergy !== null) break;
  }

  // Pending assessment
  const hasPendingAssessment = !!(client.assessmentRequests || []).some((r: any) => r?.status === 'pending');

  // Reason / status assignment
  const reasons: string[] = [];
  let status: RadarStatus = 'active';

  const lowMood = latestMood !== null && latestMood <= 3;
  const lowEnergy = latestEnergy !== null && latestEnergy <= 3;

  if (lowMood || lowEnergy || hasPendingAssessment) {
    status = 'attention';
    if (lowMood) reasons.push(`المود منخفض (${latestMood}/10)`);
    if (lowEnergy) reasons.push(`الطاقة منخفضة (${latestEnergy}/10)`);
    if (hasPendingAssessment) reasons.push('تقييم بدني معلّق');
  } else if (daysSinceMeasurement >= 14) {
    status = 'late';
    if (daysSinceMeasurement === Number.POSITIVE_INFINITY) {
      reasons.push('لم يرفع أي قياسات بعد');
    } else {
      reasons.push(`آخر قياس من ${daysSinceMeasurement} يوم`);
    }
  } else if (daysSinceMeasurement < 7 || daysSinceLogin < 3) {
    status = 'active';
    if (daysSinceMeasurement < 7) reasons.push(`قاس من ${daysSinceMeasurement} يوم`);
    else if (daysSinceLogin < 3) reasons.push(`دخل من ${daysSinceLogin} يوم`);
  } else {
    // Quiet zone — somewhere between fresh and late.
    status = 'late';
    reasons.push(
      daysSinceMeasurement === Number.POSITIVE_INFINITY
        ? 'لم يرفع قياسات'
        : `آخر قياس من ${daysSinceMeasurement} يوم`
    );
  }

  return {
    client,
    status,
    reasons,
    daysSinceMeasurement,
    daysSinceLogin,
    latestMood,
    latestEnergy,
    hasPendingAssessment,
  };
}

function fmtDays(n: number): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return 'اليوم';
  if (n === 1) return 'أمس';
  return `${n} يوم`;
}

/**
 * Radar panel — at-a-glance view of every client's engagement health.
 * Only shows activated clients; pending activations belong elsewhere.
 */
export default function AdminRadar({ clients, onSelectClient }: AdminRadarProps) {
  const [filter, setFilter] = useState<'all' | RadarStatus>('all');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return clients
      .filter((c) => c.isActivated)
      .map(computeRow)
      .sort((a, b) => {
        // Worst first: attention → late → active
        const order: Record<RadarStatus, number> = { attention: 0, late: 1, active: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        // Within group, oldest measurement first.
        return b.daysSinceMeasurement - a.daysSinceMeasurement;
      });
  }, [clients]);

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    late: rows.filter((r) => r.status === 'late').length,
    attention: rows.filter((r) => r.status === 'attention').length,
  }), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        (r.client.name || '').toLowerCase().includes(q) ||
        (r.client.email || '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 via-rose-600 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-500/20 ring-1 ring-white/10">
          <RadarIcon size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white leading-tight">الرادار</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
            Engagement Radar · {counts.all} عميل مفعّل
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'active' as const,    color: 'emerald', icon: <CheckCircle2 size={18} />,  label: 'نشط', count: counts.active,    sub: '< 7 أيام قياس' },
          { key: 'late' as const,      color: 'amber',   icon: <Clock size={18} />,         label: 'متأخر', count: counts.late,    sub: '≥ 14 يوم بدون تحديث' },
          { key: 'attention' as const, color: 'rose',    icon: <AlertTriangle size={18} />, label: 'يحتاج اهتمام', count: counts.attention, sub: 'مود/طاقة منخفضة' },
        ]).map((card) => {
          const active = filter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setFilter(active ? 'all' : card.key)}
              className={`text-right rounded-3xl p-4 border transition-all ${
                active
                  ? `bg-${card.color}-500/15 border-${card.color}-400/40 ring-2 ring-${card.color}-400/30`
                  : `bg-slate-900/60 border-white/5 hover:border-${card.color}-400/30`
              }`}
            >
              <div className={`text-${card.color}-300 mb-2`}>{card.icon}</div>
              <div className="text-3xl font-black text-white tabular-nums leading-none">{card.count}</div>
              <div className="text-[12px] font-bold text-white mt-2">{card.label}</div>
              <div className="text-[10px] text-slate-500">{card.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو البريد..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-2xl ps-3 pe-9 py-2.5 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'attention', 'late', 'active'] as const).map((k) => {
            const active = filter === k;
            const label = k === 'all' ? `الكل (${counts.all})` : STATUS_META[k as RadarStatus].label;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`shrink-0 px-3 py-1.5 rounded-2xl text-[12px] font-bold border transition ${
                  active
                    ? 'bg-blue-600 text-white border-blue-400/30 shadow-lg shadow-blue-500/30'
                    : 'bg-slate-900/50 text-slate-400 border-white/5 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 p-10 text-center">
          <RadarIcon size={28} className="mx-auto text-slate-600 mb-2" />
          <p className="text-sm text-slate-400">مفيش عميل مطابق للفلتر الحالي.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((row) => {
            const meta = STATUS_META[row.status];
            const initial = (row.client.name || '?').slice(0, 1).toUpperCase();
            return (
              <motion.button
                key={row.client.uid}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onSelectClient(row.client)}
                className="w-full text-right rounded-3xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-white/10 p-4 transition-all flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="shrink-0 w-11 h-11 rounded-2xl overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center">
                    {row.client.profilePicUrl ? (
                      <img
                        src={row.client.profilePicUrl}
                        alt={row.client.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-base font-black text-slate-300">{initial}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{row.client.name || 'بدون اسم'}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.ring} ${meta.tone}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate ltr text-left">{row.client.email}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {row.reasons.join(' · ') || '—'}
                    </p>
                  </div>
                </div>

                {/* Mini metrics */}
                <div className="flex items-center gap-3 sm:gap-4 ps-2 sm:ps-4 sm:border-s sm:border-white/5">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">قياس</div>
                    <div className="text-sm font-bold text-white tabular-nums">{fmtDays(row.daysSinceMeasurement)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">دخول</div>
                    <div className="text-sm font-bold text-white tabular-nums">{fmtDays(row.daysSinceLogin)}</div>
                  </div>
                  <div className="text-center min-w-[3.5rem]">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-center gap-1">
                      <Heart size={9} /> <Zap size={9} />
                    </div>
                    <div className="text-sm font-bold text-white tabular-nums">
                      {row.latestMood ?? '—'}/{row.latestEnergy ?? '—'}
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-slate-500 hidden sm:block" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
