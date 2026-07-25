import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { rankFromCoins } from '../lib/gamification';

interface PointsBadgeProps {
  coins: number;
  compact?: boolean;
  onClick?: () => void;
}

export default function PointsBadge({ coins, compact, onClick }: PointsBadgeProps) {
  const safeCoins = Math.max(0, coins || 0);
  const rank = rankFromCoins(safeCoins);
  const [pulse, setPulse] = useState(false);
  const [prevCoins, setPrevCoins] = useState(safeCoins);

  useEffect(() => {
    if (safeCoins > prevCoins) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1200);
      setPrevCoins(safeCoins);
      return () => clearTimeout(t);
    }
    if (safeCoins !== prevCoins) setPrevCoins(safeCoins);
    return undefined;
  }, [safeCoins, prevCoins]);

  const progressPct =
    rank.nextAt === Infinity
      ? 100
      : Math.min(100, Math.round(((safeCoins - rank.minCoins) / (rank.nextAt - rank.minCoins)) * 100));

  return (
    <button
      onClick={onClick}
      className="relative group flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/70 border border-amber-500/20 hover:border-amber-400/40 transition focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      title={`${rank.name} · ${rank.englishName}`}
    >
      <span className="text-base leading-none">{rank.emoji}</span>
      <div className="flex flex-col items-start leading-none">
        <div className="flex items-baseline gap-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={safeCoins}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm font-black text-amber-300 tabular-nums"
            >
              {safeCoins.toLocaleString('ar-EG')}
            </motion.span>
          </AnimatePresence>
          {!compact && <span className="text-[10px] text-amber-400/70 font-bold">XP</span>}
        </div>
        {!compact && (
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{rank.name}</span>
        )}
      </div>

      {!compact && (
        <div className="absolute bottom-0 left-1.5 right-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full"
            style={{ background: rank.color }}
          />
        </div>
      )}

      <AnimatePresence>
        {pulse && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 1.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 rounded-2xl border-2 border-amber-400 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </button>
  );
}
