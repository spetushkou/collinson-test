import { band, formatNumber, sunshineRatio } from './factors.js';
import type { DayInput, Factor } from './types.js';

// docs/process/design.md, "Scoring" - INDOOR SIGHTSEEING. Indoor is better the worse it is
// outside (questions.md Q6): a baseline that weather never removes, raised by rain, cold,
// heat and wind, lowered on a day clearly better spent outdoors.
export function scoreIndoorDay(d: DayInput): Factor[] {
  return [
    { name: 'baseline', value: 'museums do not mind weather', points: 50 },
    band(
      'rain chance',
      d.precipitationProbabilityPct,
      '%',
      [
        { below: 30, points: 0 },
        { below: 60, points: 10 },
      ],
      { points: 25 },
    ),
    band(
      'temperature',
      d.tempMaxC,
      'C',
      [
        { below: 5, points: 15, label: 'cold' },
        { below: 30, points: 0 },
      ],
      { points: 15, label: 'hot' },
    ),
    band('wind', d.windMaxKmh, 'km/h', [{ below: 40, points: 0 }], {
      points: 10,
    }),
    outsideDay(d),
  ];
}

function outsideDay(d: DayInput): Factor {
  const name = 'a day to be outside';
  const ratio = sunshineRatio(d);
  if (ratio === null || d.tempMaxC === null) {
    return { name, value: 'no data', points: 0 };
  }
  const shown = `${formatNumber(ratio * 100)}% sun, ${formatNumber(d.tempMaxC)} C`;
  const tempting = ratio >= 0.6 && d.tempMaxC >= 15 && d.tempMaxC < 26;
  return tempting
    ? { name, value: `${shown} - go outside`, points: -20 }
    : { name, value: shown, points: 0 };
}
