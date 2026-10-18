import { band, codeFactor, STORM_CODES } from './factors.js';
import type { Applicability, DayInput, Factor } from './types.js';

// docs/process/design.md, "Scoring" - SURFING. A clean, long-period swell day reaches 90.
export function scoreSurfingDay(d: DayInput): Factor[] {
  return [
    band(
      'wave height',
      d.waveHeightMaxM,
      'm',
      [
        { below: 0.5, points: 0, label: 'flat' },
        { below: 1, points: 20 },
        { below: 2.5, points: 40 },
        { below: 4, points: 25 },
      ],
      { points: -10, label: 'dangerous' },
    ),
    band(
      'wave period',
      d.wavePeriodMaxS,
      's',
      [
        { below: 7, points: 5 },
        { below: 10, points: 15 },
      ],
      { points: 25 },
    ),
    band(
      'wind',
      d.windMaxKmh,
      'km/h',
      [
        { below: 15, points: 15 },
        { below: 30, points: 5 },
        { below: 50, points: -10 },
      ],
      { points: -25 },
    ),
    band(
      'air temperature',
      d.tempMaxC,
      'C',
      [
        { below: 10, points: -5 },
        { below: 18, points: 5 },
      ],
      { points: 10 },
    ),
    codeFactor(
      'storms',
      d.weatherCode,
      [{ codes: STORM_CODES, points: -30, label: 'storm' }],
      { points: 0, label: 'no storms' },
    ),
  ];
}

// The marine API answers an inland point with nulls, which is a success ("no sea here");
// a marine call that never succeeded leaves nulls too, which is a different story.
export function surfingApplicability(
  days: DayInput[],
  marineFetched: boolean,
): Applicability {
  if (days.some((d) => d.waveHeightMaxM !== null)) return { applicable: true };
  return {
    applicable: false,
    reason: marineFetched
      ? 'no wave data for this location'
      : 'wave data unavailable',
  };
}
