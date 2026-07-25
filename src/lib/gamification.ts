import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export const POINTS = {
  WATER_INCREMENT: 5,
  WORKOUT_COMPLETED: 25,
  MEAL_COMPLETED: 10,
  MEASUREMENT_UPDATED: 100,
  FEED_POST: 15,
  FRIDGE_SCAN: 10,
} as const;

export type PointReason = keyof typeof POINTS;

export interface Rank {
  name: string;
  englishName: string;
  minCoins: number;
  nextAt: number;
  color: string;
  emoji: string;
}

const RANKS: Rank[] = [
  { name: 'مبتدئ',  englishName: 'Rookie',   minCoins: 0,    nextAt: 100,      color: '#94a3b8', emoji: '🌱' },
  { name: 'متحمس',  englishName: 'Hustler',  minCoins: 100,  nextAt: 500,      color: '#60a5fa', emoji: '⚡' },
  { name: 'محارب',  englishName: 'Warrior',  minCoins: 500,  nextAt: 1500,     color: '#a78bfa', emoji: '🔥' },
  { name: 'بطل',    englishName: 'Champion', minCoins: 1500, nextAt: 5000,     color: '#f59e0b', emoji: '🏆' },
  { name: 'أسطورة', englishName: 'Legend',   minCoins: 5000, nextAt: Infinity, color: '#fbbf24', emoji: '👑' },
];

export function rankFromCoins(coins: number): Rank {
  const c = Math.max(0, coins || 0);
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (c >= RANKS[i].minCoins) return RANKS[i];
  }
  return RANKS[0];
}

export async function awardCoins(uid: string, reason: PointReason, multiplier = 1): Promise<number> {
  if (!uid) return 0;
  const amount = POINTS[reason] * multiplier;
  if (amount <= 0) return 0;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { coins: increment(amount) });
    return amount;
  } catch (err) {
    console.error('[gamification] awardCoins failed:', err);
    return 0;
  }
}
