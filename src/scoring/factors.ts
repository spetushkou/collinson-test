import type { DayInput, Factor } from './types.js';

export interface Band {
  below: number;
  points: number;
  label?: string;
}

export interface Outcome {
  points: number;
  label?: string;
}

const NO_DATA = 'no data';

export function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

const describe = (shown: string, label?: string) =>
  label ? `${shown} - ${label}` : shown;

// Maps a measured value onto contiguous ranges, tried in order: a value below `below` takes
// that range, so a lower bound is inclusive and an upper one exclusive; anything past the
// last range takes `last`. A missing value scores 0 and says so, so a day is never scored on
// a guess.
export function band(
  name: string,
  value: number | null,
  unit: string,
  bands: Band[],
  last: Outcome,
): Factor {
  if (value === null) return { name, value: NO_DATA, points: 0 };
  const hit = bands.find((b) => value < b.below) ?? last;
  const shown = unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
  return { name, value: describe(shown, hit.label), points: hit.points };
}

export interface CodeCase {
  codes: number[];
  points: number;
  label: string;
}

// For WMO weather codes, which are categories, not a scale.
export function codeFactor(
  name: string,
  code: number | null,
  cases: CodeCase[],
  otherwise: Outcome & { label: string },
): Factor {
  if (code === null) return { name, value: NO_DATA, points: 0 };
  const hit = cases.find((c) => c.codes.includes(code)) ?? otherwise;
  return { name, value: `${hit.label} (code ${code})`, points: hit.points };
}

export const STORM_CODES = [95, 96, 99];
export const FOG_CODES = [45, 48];
export const CLEAR_CODES = [0, 1, 2];

// The share of the day's daylight that was sunny, or null when either side is unknown.
export function sunshineRatio(day: DayInput): number | null {
  if (day.sunshineS === null || day.daylightS === null || day.daylightS <= 0) {
    return null;
  }
  return day.sunshineS / day.daylightS;
}
