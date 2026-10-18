import {
  band,
  codeFactor,
  FOG_CODES,
  STORM_CODES,
  sunshineRatio,
} from './factors.js';
import type { DayInput, Factor } from './types.js';

// docs/process/design.md, "Scoring" - OUTDOOR SIGHTSEEING. A dry, mild, sunny day reaches 85.
export function scoreOutdoorDay(d: DayInput): Factor[] {
  const ratio = sunshineRatio(d);
  return [
    band(
      'rain chance',
      d.precipitationProbabilityPct,
      '%',
      [
        { below: 20, points: 30 },
        { below: 50, points: 15 },
        { below: 80, points: -5 },
      ],
      { points: -20 },
    ),
    band('rain amount', d.precipitationMm, 'mm', [{ below: 10, points: 0 }], {
      points: -10,
    }),
    band(
      'temperature',
      d.tempMaxC,
      'C',
      [
        { below: 0, points: -15 },
        { below: 8, points: 0, label: 'cold' },
        { below: 15, points: 10 },
        { below: 26, points: 25 },
        { below: 32, points: 10 },
        { below: 35, points: 0, label: 'hot' },
      ],
      { points: -15 },
    ),
    band(
      'wind',
      d.windMaxKmh,
      'km/h',
      [
        { below: 20, points: 15 },
        { below: 40, points: 5 },
      ],
      { points: -15 },
    ),
    band(
      'sunshine',
      ratio === null ? null : ratio * 100,
      '% of daylight',
      [
        { below: 30, points: 0, label: 'overcast' },
        { below: 60, points: 8 },
      ],
      { points: 15 },
    ),
    codeFactor(
      'sky',
      d.weatherCode,
      [
        { codes: STORM_CODES, points: -20, label: 'storm' },
        { codes: FOG_CODES, points: -10, label: 'fog' },
      ],
      { points: 0, label: 'no storm or fog' },
    ),
    band('uv', d.uvIndexMax, '', [{ below: 8, points: 0 }], {
      points: -5,
      label: 'bring shade',
    }),
  ];
}
