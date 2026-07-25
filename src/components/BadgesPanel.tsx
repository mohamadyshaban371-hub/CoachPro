import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Trophy, Lock } from 'lucide-react';
import { UserProfile } from '../types';
import { computeBadges, badgeTone } from '../lib/badges';

interface BadgesPanelProps {
  profile: UserProfile;
}

/**
 * Visual achievements grid. Renders both unlocked and locked badges so the
 * user can see what's still ahead — the "progress hint" under each locked
 * badge gives them a clear next milestone.
 */
export default function BadgesPanel({ profile }: BadgesPanelProps) {
  const badges = useMemo(() => computeBadges(profile), [profile]);
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <section className="rounded-3xl bg-slate-900/60 border border-white/5 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">إنجازاتك</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
              Achievements · {unlockedCount} / {badges.length}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-amber-300 tabular-nums leading-none">
            {Math.round((unlockedCount / badges.length) * 100)}%
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">مكتمل</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
          initial={{ width: 0 }}
          animate={{ width: `${(unlockedCount / badges.length) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {badges.map((b, i) => {
          const tone = badgeTone(b.tone);
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`relative rounded-2xl p-4 border transition-all ${
                b.unlocked
                  ? `${tone.bg} ${tone.ring} ring-1 shadow-lg ${tone.glow}`
                  : 'bg-slate-800/40 border-white/5'
              }`}
              title={b.description}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-2 ${
                  b.unlocked
                    ? `${tone.bg} ${tone.ring} ring-1`
                    : 'bg-slate-900 text-slate-700 grayscale opacity-50'
                }`}
              >
                {b.unlocked ? b.emoji : <Lock size={18} className="text-slate-600" />}
              </div>
              <div className={`text-[12px] font-bold leading-tight ${b.unlocked ? 'text-white' : 'text-slate-500'}`}>
                {b.label}
              </div>
              {b.progress && !b.unlocked && (
                <div className={`text-[10px] mt-1 font-bold tabular-nums ${tone.text} opacity-80`}>
                  {b.progress}
                </div>
              )}
              {b.unlocked && (
                <div className={`text-[10px] mt-1 font-bold uppercase tracking-widest ${tone.text}`}>
                  مفتوح ✓
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        الإنجازات بتتفعّل تلقائياً حسب نشاطك اليومي. كل ما تكمل تمرين، وجبة، أو تسجل قياس جديد، الكوتش الذكي بيتابع تقدمك ويفتح إنجازات جديدة.
      </p>
    </section>
  );
}
