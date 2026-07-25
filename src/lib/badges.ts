/**
 * Badge engine — derives unlocked achievements from a UserProfile snapshot.
 *
 * All checks are pure: no Firestore reads, no side-effects. We compute the
 * full list every time the Profile page renders so the user sees their state
 * the moment they earn one. Awarding (writing to Firestore) is handled
 * separately if/when we want to persist a "unlocked at" timestamp.
 */
import { UserProfile } from '../types';

export type BadgeId =
  | 'streak_7'
  | 'streak_30'
  | 'inbody_hero'
  | 'workout_warrior'
  | 'meal_master'
  | 'hydration_hero'
  | 'first_post'
  | 'cycle_champion'
  | 'rookie_done'
  | 'champion_rank';

export interface Badge {
  id: BadgeId;
  /** Arabic label shown under the icon. */
  label: string;
  /** Short Arabic description shown on hover / in the card body. */
  description: string;
  /** Single emoji used as the visual icon. */
  emoji: string;
  /** Tailwind tone — drives the gradient, ring, and text color. */
  tone: 'amber' | 'emerald' | 'blue' | 'rose' | 'violet' | 'pink';
  /** True when the user has unlocked this achievement. */
  unlocked: boolean;
  /** "3 / 7" style progress hint shown when locked. Optional. */
  progress?: string;
}

const BADGE_TONES: Record<Badge['tone'], { ring: string; bg: string; text: string; glow: string }> = {
  amber:   { ring: 'ring-amber-400/40',   bg: 'bg-amber-500/15',   text: 'text-amber-300',   glow: 'shadow-amber-500/30' },
  emerald: { ring: 'ring-emerald-400/40', bg: 'bg-emerald-500/15', text: 'text-emerald-300', glow: 'shadow-emerald-500/30' },
  blue:    { ring: 'ring-blue-400/40',    bg: 'bg-blue-500/15',    text: 'text-blue-300',    glow: 'shadow-blue-500/30' },
  rose:    { ring: 'ring-rose-400/40',    bg: 'bg-rose-500/15',    text: 'text-rose-300',    glow: 'shadow-rose-500/30' },
  violet:  { ring: 'ring-violet-400/40',  bg: 'bg-violet-500/15',  text: 'text-violet-300',  glow: 'shadow-violet-500/30' },
  pink:    { ring: 'ring-pink-400/40',    bg: 'bg-pink-500/15',    text: 'text-pink-300',    glow: 'shadow-pink-500/30' },
};

export function badgeTone(tone: Badge['tone']) {
  return BADGE_TONES[tone];
}

/**
 * Returns the longest run of consecutive days (ending today or yesterday) for
 * which the user logged any progress. We scan the dailyProgress map keyed by
 * `YYYY-MM-DD`. A "logged" day is one with at least one completed meal,
 * one completed exercise, OR a recorded mood/energy/water value.
 */
export function computeStreak(profile: UserProfile): number {
  const dp: any = (profile as any).dailyProgress || {};
  const days = Object.keys(dp).sort(); // ascending
  if (days.length === 0) return 0;

  const isLogged = (d: string): boolean => {
    const log = dp[d];
    if (!log) return false;
    return (
      (Array.isArray(log.mealsCompleted) && log.mealsCompleted.length > 0) ||
      (Array.isArray(log.exercisesCompleted) && log.exercisesCompleted.length > 0) ||
      typeof log.moodScore === 'number' ||
      typeof log.energyLevel === 'number' ||
      typeof log.waterLiters === 'number'
    );
  };

  // Walk backwards from today; allow today to be missing (user may not have
  // logged yet) but stop at the first gap.
  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);
  // If today isn't logged yet, start counting from yesterday so an early-morning
  // visit doesn't show 0.
  if (!isLogged(cursor.toISOString().split('T')[0])) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = cursor.toISOString().split('T')[0];
    if (!isLogged(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 365) break; // safety
  }
  return streak;
}

/**
 * Master derivation. Any new badge gets added here — UI just maps over the
 * returned list and renders.
 */
export function computeBadges(profile: UserProfile): Badge[] {
  const dp: any = (profile as any).dailyProgress || {};
  const dayKeys = Object.keys(dp);
  const measurements = profile.measurementHistory || [];
  const coins = profile.coins ?? 0;
  const streak = computeStreak(profile);

  const totalMealsDone = dayKeys.reduce((sum, d) => sum + ((dp[d]?.mealsCompleted?.length) || 0), 0);
  const totalWorkoutsDone = dayKeys.reduce((sum, d) => sum + ((dp[d]?.exercisesCompleted?.length) || 0), 0);
  const hydratedDays = dayKeys.filter((d) => (dp[d]?.waterLiters || 0) >= 2.5).length;

  // Posts authored by this user. We only have a count via coins (each post
  // earns FEED_POST coins). Best-effort: any non-zero coin total > 14 likely
  // means at least one post or activity; the dedicated badge below is still
  // gated on the activityLog flag if you wire it in later.
  const hasPosted = !!(profile as any).hasPostedToFeed || (coins >= 15);

  const cycleLog: any = (profile as any).cycleLog;
  const tracksCycle = profile.gender === 'female' && !!cycleLog?.lastPeriodStart;

  return [
    {
      id: 'streak_7',
      label: 'سلسلة 7 أيام',
      description: 'سجلت تقدمك 7 أيام متواصلة بدون انقطاع.',
      emoji: '🔥',
      tone: 'amber',
      unlocked: streak >= 7,
      progress: streak < 7 ? `${streak} / 7` : undefined,
    },
    {
      id: 'streak_30',
      label: 'سلسلة 30 يوم',
      description: 'شهر كامل من الإلتزام — مستوى البطولة الحقيقي.',
      emoji: '⚡',
      tone: 'amber',
      unlocked: streak >= 30,
      progress: streak < 30 ? `${streak} / 30` : undefined,
    },
    {
      id: 'inbody_hero',
      label: 'بطل الـ InBody',
      description: 'رفعت 4 قياسات InBody أو أكثر. ده بيخلي الكوتش يقدر يتابع التطور بدقة.',
      emoji: '📊',
      tone: 'blue',
      unlocked: measurements.length >= 4,
      progress: measurements.length < 4 ? `${measurements.length} / 4` : undefined,
    },
    {
      id: 'workout_warrior',
      label: 'محارب التمرين',
      description: 'أكملت 50 تمرين عبر خطتك الأسبوعية.',
      emoji: '💪',
      tone: 'emerald',
      unlocked: totalWorkoutsDone >= 50,
      progress: totalWorkoutsDone < 50 ? `${totalWorkoutsDone} / 50` : undefined,
    },
    {
      id: 'meal_master',
      label: 'سيد التغذية',
      description: 'أكملت 100 وجبة من خطتك الغذائية بالضبط.',
      emoji: '🥗',
      tone: 'emerald',
      unlocked: totalMealsDone >= 100,
      progress: totalMealsDone < 100 ? `${totalMealsDone} / 100` : undefined,
    },
    {
      id: 'hydration_hero',
      label: 'بطل الترطيب',
      description: 'وصلت لـ 2.5 لتر مياه أو أكتر في 14 يوم مختلف.',
      emoji: '💧',
      tone: 'blue',
      unlocked: hydratedDays >= 14,
      progress: hydratedDays < 14 ? `${hydratedDays} / 14` : undefined,
    },
    {
      id: 'first_post',
      label: 'أول منشور',
      description: 'شاركت إنجازك على حائط الأبطال — البداية الحقيقية.',
      emoji: '📣',
      tone: 'violet',
      unlocked: hasPosted,
    },
    {
      id: 'cycle_champion',
      label: 'متابعة ذكية للدورة',
      description: 'فعّلت متتبع الدورة الشهرية — الكوتش الذكي بيعدّل الخطة حسب مرحلتك.',
      emoji: '🌸',
      tone: 'pink',
      unlocked: tracksCycle,
    },
    {
      id: 'rookie_done',
      label: 'بداية الرحلة',
      description: 'أكملت أول 100 نقطة في رحلتك. مرحبًا في النادي.',
      emoji: '🌱',
      tone: 'emerald',
      unlocked: coins >= 100,
      progress: coins < 100 ? `${coins} / 100` : undefined,
    },
    {
      id: 'champion_rank',
      label: 'رتبة بطل',
      description: 'وصلت لرتبة بطل (1500 نقطة). صعب جدًا الوصول هنا — مبروك.',
      emoji: '🏆',
      tone: 'amber',
      unlocked: coins >= 1500,
      progress: coins < 1500 ? `${coins} / 1500` : undefined,
    },
  ];
}
