import type { DayScore, Factor } from './types.js';

const clamp = (n: number) => Math.min(100, Math.max(0, n));

// Score = the factors' points summed and clamped to 0..100. Days are ranked best first; a tie
// goes to the earlier date, the sooner day being the more useful one to plan (Q7).
export function rankDays(
  days: Array<{ date: string; factors: Factor[] }>,
): DayScore[] {
  return days
    .map((d) => ({
      date: d.date,
      factors: d.factors,
      score: clamp(d.factors.reduce((sum, f) => sum + f.points, 0)),
    }))
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
    .map((d, i) => ({ ...d, rank: i + 1 }));
}
