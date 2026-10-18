import {
  band,
  CLEAR_CODES,
  codeFactor,
  FOG_CODES,
  STORM_CODES,
} from './factors.js';
import type { Applicability, DayInput, Factor } from './types.js';

// docs/process/design.md, "Scoring" - SKIING. A powder day reaches 100.
export function scoreSkiingDay(d: DayInput): Factor[] {
  return [
    band(
      'snow base',
      d.snowDepthMaxCm,
      'cm',
      [
        { below: 5, points: 0, label: 'no base' },
        { below: 20, points: 10 },
        { below: 50, points: 25 },
      ],
      { points: 40 },
    ),
    band(
      'fresh snow',
      d.snowfallCm,
      'cm',
      [
        { below: 2, points: 0 },
        { below: 10, points: 10 },
        { below: 20, points: 18 },
      ],
      { points: 25 },
    ),
    band(
      'temperature',
      d.tempMaxC,
      'C',
      [
        { below: -15, points: -10, label: 'bitter' },
        { below: -10, points: 5, label: 'cold' },
        { below: 2, points: 15 },
        { below: 6, points: 5 },
      ],
      { points: -10, label: 'slush' },
    ),
    band(
      'wind',
      d.windMaxKmh,
      'km/h',
      [
        { below: 20, points: 10 },
        { below: 40, points: 0 },
        { below: 60, points: -10 },
      ],
      { points: -25, label: 'lifts close' },
    ),
    codeFactor(
      'sky',
      d.weatherCode,
      [
        { codes: CLEAR_CODES, points: 10, label: 'clear' },
        { codes: FOG_CODES, points: -15, label: 'fog' },
        { codes: STORM_CODES, points: -10, label: 'storm' },
      ],
      { points: 0, label: 'overcast or precipitation' },
    ),
  ];
}

// Not applicable only when there is nothing to judge: no day has a snow reading of either
// kind. A day with 0 cm is data - it says "no" and scores 0.
export function skiingApplicability(days: DayInput[]): Applicability {
  const anyData = days.some(
    (d) => d.snowDepthMaxCm !== null || d.snowfallCm !== null,
  );
  return anyData
    ? { applicable: true }
    : { applicable: false, reason: 'no snow data for this location' };
}
