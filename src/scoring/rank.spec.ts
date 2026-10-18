import { rankDays } from './rank.js';

const f = (points: number) => [{ name: 'x', value: 'x', points }];

describe('rankDays', () => {
  it('clamps the sum of the factors to 0..100', () => {
    const ranked = rankDays([
      { date: '2026-10-19', factors: [...f(80), ...f(40)] },
      { date: '2026-10-20', factors: f(-30) },
    ]);
    expect(ranked.map((d) => d.score)).toEqual([100, 0]);
  });

  it('ranks by score, breaks ties by the earlier date, and returns them in rank order', () => {
    const ranked = rankDays([
      { date: '2026-10-21', factors: f(50) },
      { date: '2026-10-19', factors: f(70) },
      { date: '2026-10-20', factors: f(50) },
    ]);
    expect(ranked.map((d) => [d.rank, d.date, d.score])).toEqual([
      [1, '2026-10-19', 70],
      [2, '2026-10-20', 50],
      [3, '2026-10-21', 50],
    ]);
  });

  it('keeps every factor on the day it explains', () => {
    const [only] = rankDays([{ date: '2026-10-19', factors: f(12) }]);
    expect(only.factors).toEqual(f(12));
  });

  it('returns nothing for no days', () => {
    expect(rankDays([])).toEqual([]);
  });
});
