import React from 'react';
import { Heart, Zap } from 'lucide-react';

interface DailyEntry {
  moodScore?: number;
  energyLevel?: number;
}

interface MoodTrendChartProps {
  /** Map keyed by ISO date (YYYY-MM-DD). */
  dailyProgress?: Record<string, DailyEntry>;
  /** How many trailing days to plot (default 7). */
  days?: number;
}

const WIDTH = 280;
const HEIGHT = 110;
const PAD_X = 24;
const PAD_Y = 14;

function buildPath(values: (number | null)[]): string {
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_Y * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : innerW;
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    const x = PAD_X + step * i;
    const y = PAD_Y + innerH - (Math.max(0, Math.min(10, v)) / 10) * innerH;
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

/**
 * Compact 7-day mood + energy line chart, shown both on the client
 * dashboard ("trend هذا الأسبوع") and inside the admin client modal.
 * Pure SVG → zero extra runtime cost, no chart-lib dep.
 */
export default function MoodTrendChart({ dailyProgress = {}, days = 7 }: MoodTrendChartProps) {
  const today = new Date();
  const labels: string[] = [];
  const moodVals: (number | null)[] = [];
  const energyVals: (number | null)[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const entry = dailyProgress[key];
    labels.push(d.toLocaleDateString('ar-EG', { weekday: 'narrow' }));
    moodVals.push(typeof entry?.moodScore === 'number' ? entry.moodScore : null);
    energyVals.push(typeof entry?.energyLevel === 'number' ? entry.energyLevel : null);
  }

  const haveAny = moodVals.some(v => v != null) || energyVals.some(v => v != null);

  if (!haveAny) {
    return (
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-center">
        <p className="text-[11px] text-slate-500 italic">لا توجد بيانات نفسية بعد لهذا الأسبوع.</p>
      </div>
    );
  }

  const innerW = WIDTH - PAD_X * 2;
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;

  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">آخر {days} أيام</h4>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-pink-400 font-bold">
            <Heart size={10} /> مزاج
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <Zap size={10} /> طاقة
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" preserveAspectRatio="none">
        {[0, 0.5, 1].map((p) => (
          <line
            key={p}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={PAD_Y + (HEIGHT - PAD_Y * 2) * p}
            y2={PAD_Y + (HEIGHT - PAD_Y * 2) * p}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        <path d={buildPath(moodVals)} fill="none" stroke="#ec4899" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={buildPath(energyVals)} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {moodVals.map((v, i) =>
          v == null ? null : (
            <circle key={`m${i}`} cx={PAD_X + stepX * i} cy={PAD_Y + (HEIGHT - PAD_Y * 2) - (v / 10) * (HEIGHT - PAD_Y * 2)} r={2.5} fill="#ec4899" />
          ),
        )}
        {energyVals.map((v, i) =>
          v == null ? null : (
            <circle key={`e${i}`} cx={PAD_X + stepX * i} cy={PAD_Y + (HEIGHT - PAD_Y * 2) - (v / 10) * (HEIGHT - PAD_Y * 2)} r={2.5} fill="#f59e0b" />
          ),
        )}

        {labels.map((lab, i) => (
          <text
            key={`lab${i}`}
            x={PAD_X + stepX * i}
            y={HEIGHT - 2}
            textAnchor="middle"
            className="fill-slate-600"
            style={{ fontSize: 8, fontWeight: 700 }}
          >
            {lab}
          </text>
        ))}
      </svg>
    </div>
  );
}
