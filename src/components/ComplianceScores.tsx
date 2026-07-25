import React, { useMemo, useState } from 'react';
import { Activity, Award, ChevronDown, Footprints, Moon, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../types';
import { complianceTone, computeComplianceScore } from '../lib/smartwatch';

interface Props {
  clients: UserProfile[];
}

/**
 * Admin "Accountability" panel — ranks active clients by their 7-day
 * smartwatch compliance score so the coach can see at a glance who is
 * actually wearing the band and hitting the daily activity floor.
 *
 * Pure read of the existing `dailyLogs.{date}.watch.*` map — no extra
 * Firestore reads, no schema changes.
 */
export default function ComplianceScores({ clients }: Props) {
  const [expanded, setExpanded] = useState(true);

  const ranked = useMemo(() => {
    return clients
      .filter((c) => c.role === 'client' && c.isActivated !== false)
      .map((c) => {
        const breakdown = computeComplianceScore(c.dailyLogs as any, 7);
        return { client: c, breakdown };
      })
      .sort((a, b) => b.breakdown.score - a.breakdown.score);
  }, [clients]);

  if (ranked.length === 0) return null;

  const overallAvg = Math.round(
    ranked.reduce((s, r) => s + r.breakdown.score, 0) / ranked.length
  );
  const lowCount = ranked.filter((r) => r.breakdown.score < 50).length;

  return (
    <section className="mb-10 rounded-3xl border border-white/5 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between gap-4 hover:bg-slate-900/60 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Award size={20} className="text-white" />
          </div>
          <div className="text-right">
            <h3 className="text-lg font-bold text-white leading-tight">
              نقاط الالتزام (Accountability Score)
            </h3>
            <p className="text-[11px] text-slate-500">
              مبنية على بيانات الساعة الذكية لآخر 7 أيام · متوسط الفريق:{' '}
              <span className="text-white font-bold">{overallAvg}%</span> ·{' '}
              <span className={lowCount > 0 ? 'text-rose-300 font-bold' : 'text-slate-500'}>
                {lowCount} عميل تحت 50%
              </span>
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {ranked.map(({ client, breakdown }) => {
            const tone = complianceTone(breakdown.score);
            const lastSync = breakdown.lastSyncedAt
              ? new Date(breakdown.lastSyncedAt).toLocaleDateString('ar-EG', {
                  day: 'numeric',
                  month: 'short',
                })
              : '—';
            return (
              <div
                key={client.uid}
                className="px-5 py-4 grid grid-cols-12 gap-3 items-center hover:bg-slate-900/60 transition"
              >
                <div className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[12px] font-black ${tone.color}`}>
                    {breakdown.score}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{client.name || 'بدون اسم'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{client.email}</p>
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-2 flex items-center gap-2 text-[12px] text-slate-300">
                  <Footprints size={14} className="text-emerald-400 shrink-0" />
                  <span className="font-bold text-white">{breakdown.goalDays}</span>
                  <span className="text-slate-500">/7 يوم هدف</span>
                </div>

                <div className="col-span-6 sm:col-span-2 flex items-center gap-2 text-[12px] text-slate-300">
                  <Moon size={14} className="text-violet-300 shrink-0" />
                  <span className="font-bold text-white">{breakdown.avgSleepHours || '—'}</span>
                  <span className="text-slate-500">س متوسط النوم</span>
                </div>

                <div className="col-span-6 sm:col-span-2 flex items-center gap-2 text-[12px] text-slate-300">
                  <Activity size={14} className="text-cyan-400 shrink-0" />
                  <span className="font-bold text-white">{breakdown.activeDays}</span>
                  <span className="text-slate-500">/7 أيام نشاط</span>
                </div>

                <div className="col-span-6 sm:col-span-2 flex items-center justify-end gap-2">
                  <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${tone.color}`}>
                    {tone.label}
                  </span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">آخر مزامنة {lastSync}</span>
                </div>

                {breakdown.score < 25 && (
                  <div className="col-span-12 mt-1 flex items-center gap-2 text-[11px] text-rose-300 bg-rose-500/5 border border-rose-400/20 rounded-xl p-2">
                    <ShieldAlert size={13} />
                    <span>هذا العميل لم يسجّل بيانات كافية — يحتاج متابعة شخصية.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
