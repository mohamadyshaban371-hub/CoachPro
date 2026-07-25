import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star } from 'lucide-react';

interface CelebrationPopupProps {
  show: boolean;
  onClose: () => void;
  profilePicUrl?: string;
  name?: string;
  message?: string;
  subMessage?: string;
}

const CONFETTI_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#ef4444', '#06b6d4', '#f97316',
];

function ConfettiPiece({ delay, x, color }: { delay: number; x: string; color: string }) {
  return (
    <motion.div
      initial={{ y: -20, x: 0, opacity: 1, scale: 1, rotate: 0 }}
      animate={{
        y: ['0%', '80vh'],
        x: [0, Math.random() > 0.5 ? 60 : -60],
        opacity: [1, 1, 0],
        scale: [1, 0.8],
        rotate: [0, Math.random() > 0.5 ? 360 : -360],
      }}
      transition={{
        duration: 2.2 + Math.random() * 1.2,
        delay,
        ease: 'easeIn',
        times: [0, 0.7, 1],
      }}
      style={{
        position: 'fixed',
        left: x,
        top: '5%',
        width: Math.random() > 0.5 ? 10 : 6,
        height: Math.random() > 0.5 ? 10 : 6,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        backgroundColor: color,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
}

const confettiPieces = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  delay: (i / 40) * 1.5,
  x: `${Math.random() * 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

export default function CelebrationPopup({
  show,
  onClose,
  profilePicUrl,
  name,
  message,
  subMessage,
}: CelebrationPopupProps) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 5500);
    return () => clearTimeout(t);
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {confettiPieces.map((p) => (
            <ConfettiPiece key={p.id} delay={p.delay} x={p.x} color={p.color} />
          ))}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="fixed inset-0 z-[9995] flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className="relative pointer-events-auto bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow */}
              <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl" />
              </div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all z-10"
              >
                <X size={18} />
              </button>

              {/* Stars */}
              <div className="flex justify-center gap-1 mb-4">
                {[0, 0.1, 0.2, 0.1, 0].map((delay, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3 + delay, type: 'spring', stiffness: 400 }}
                  >
                    <Star
                      size={i === 2 ? 28 : 20}
                      className="text-amber-400 fill-amber-400"
                    />
                  </motion.div>
                ))}
              </div>

              {/* Profile Picture */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className="relative w-24 h-24 mx-auto mb-5"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse opacity-60 blur-sm" />
                {profilePicUrl ? (
                  <img
                    src={profilePicUrl}
                    alt={name}
                    className="relative w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-xl"
                  />
                ) : (
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border-4 border-white/20 flex items-center justify-center shadow-xl">
                    <span className="text-3xl font-black text-white">
                      {name?.charAt(0)?.toUpperCase() || '🏆'}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest mb-3"
              >
                🏆 {message || 'Hero of the Day!'}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-2xl font-black text-white leading-tight mb-2"
              >
                {name ? `أهلاً يا ${name}! 💪` : 'أهلاً بالبطل! 💪'}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-slate-400 text-sm leading-relaxed"
              >
                {subMessage || 'استمر في العمل الجاد واحتفل بكل خطوة نحو هدفك!'}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                onClick={onClose}
                className="mt-6 w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-blue-600/20"
              >
                هيا نبدأ! 🚀
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
