import type { DayInput } from './types.js';

// A neutral day for tests: every value present and unremarkable. Override what a test is about.
export function day(overrides: Partial<DayInput> = {}): DayInput {
  return {
    date: '2026-10-19',
    tempMaxC: 12,
    tempMinC: 5,
    snowfallCm: 0,
    snowDepthMaxCm: 0,
    precipitationMm: 0,
    precipitationProbabilityPct: 0,
    weatherCode: 3,
    sunshineS: 18000,
    daylightS: 36000,
    windMaxKmh: 10,
    uvIndexMax: 3,
    waveHeightMaxM: null,
    wavePeriodMaxS: null,
    ...overrides,
  };
}

export const pointsOf = (
  factors: { name: string; points: number }[],
  name: string,
) => factors.find((f) => f.name === name)?.points;

export const sum = (factors: { points: number }[]) =>
  factors.reduce((total, f) => total + f.points, 0);
