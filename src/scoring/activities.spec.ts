import {
  scoreIndoorDay,
  scoreOutdoorDay,
  scoreSkiingDay,
  scoreSurfingDay,
  skiingApplicability,
  surfingApplicability,
} from './activities.js';
import { day, pointsOf, sum } from './test-day.js';

// Each case is the value just inside a band of the design's table, and the points it earns.
type Case = [value: number | null, points: number];

describe('skiing', () => {
  it.each<Case>([
    [4.9, 0],
    [5, 10],
    [20, 25],
    [50, 40],
    [null, 0],
  ])('snow base %s cm -> %s', (snowDepthMaxCm, points) => {
    expect(pointsOf(scoreSkiingDay(day({ snowDepthMaxCm })), 'snow base')).toBe(
      points,
    );
  });

  it.each<Case>([
    [1.9, 0],
    [2, 10],
    [10, 18],
    [20, 25],
  ])('fresh snow %s cm -> %s', (snowfallCm, points) => {
    expect(pointsOf(scoreSkiingDay(day({ snowfallCm })), 'fresh snow')).toBe(
      points,
    );
  });

  it.each<Case>([
    [-15.1, -10],
    [-15, 5],
    [-10, 15],
    [2, 5],
    [6, -10],
  ])('temperature %s C -> %s', (tempMaxC, points) => {
    expect(pointsOf(scoreSkiingDay(day({ tempMaxC })), 'temperature')).toBe(
      points,
    );
  });

  it.each<Case>([
    [19, 10],
    [20, 0],
    [40, -10],
    [60, -25],
  ])('wind %s km/h -> %s', (windMaxKmh, points) => {
    expect(pointsOf(scoreSkiingDay(day({ windMaxKmh })), 'wind')).toBe(points);
  });

  it.each<Case>([
    [1, 10],
    [45, -15],
    [95, -10],
    [61, 0],
  ])('sky code %s -> %s', (weatherCode, points) => {
    expect(pointsOf(scoreSkiingDay(day({ weatherCode })), 'sky')).toBe(points);
  });

  it('scores a powder day at the top: 40 + 25 + 15 + 10 + 10', () => {
    const factors = scoreSkiingDay(
      day({
        snowDepthMaxCm: 60,
        snowfallCm: 25,
        tempMaxC: -4,
        windMaxKmh: 10,
        weatherCode: 1,
      }),
    );
    expect(factors.map((f) => f.name)).toEqual([
      'snow base',
      'fresh snow',
      'temperature',
      'wind',
      'sky',
    ]);
    expect(sum(factors)).toBe(100);
  });

  it('is not applicable only when no day has any snow data', () => {
    const noData = [day({ snowDepthMaxCm: null, snowfallCm: null })];
    expect(skiingApplicability(noData)).toEqual({
      applicable: false,
      reason: 'no snow data for this location',
    });
    expect(
      skiingApplicability([
        ...noData,
        day({ snowDepthMaxCm: 0, snowfallCm: null }),
      ]),
    ).toEqual({ applicable: true });
  });

  it('stays applicable with no snow at all - the data exists and says no', () => {
    expect(
      skiingApplicability([day({ snowDepthMaxCm: 0, snowfallCm: 0 })]),
    ).toEqual({
      applicable: true,
    });
  });
});

describe('surfing', () => {
  it.each<Case>([
    [0.4, 0],
    [0.5, 20],
    [1, 40],
    [2.5, 25],
    [4, -10],
  ])('wave height %s m -> %s', (waveHeightMaxM, points) => {
    expect(
      pointsOf(scoreSurfingDay(day({ waveHeightMaxM })), 'wave height'),
    ).toBe(points);
  });

  it.each<Case>([
    [6.9, 5],
    [7, 15],
    [10, 25],
  ])('wave period %s s -> %s', (wavePeriodMaxS, points) => {
    expect(
      pointsOf(scoreSurfingDay(day({ wavePeriodMaxS })), 'wave period'),
    ).toBe(points);
  });

  it.each<Case>([
    [14, 15],
    [15, 5],
    [30, -10],
    [50, -25],
  ])('wind %s km/h -> %s', (windMaxKmh, points) => {
    expect(pointsOf(scoreSurfingDay(day({ windMaxKmh })), 'wind')).toBe(points);
  });

  it.each<Case>([
    [9, -5],
    [10, 5],
    [18, 10],
  ])('air temperature %s C -> %s', (tempMaxC, points) => {
    expect(
      pointsOf(scoreSurfingDay(day({ tempMaxC })), 'air temperature'),
    ).toBe(points);
  });

  it.each<Case>([
    [95, -30],
    [2, 0],
  ])('storms code %s -> %s', (weatherCode, points) => {
    expect(pointsOf(scoreSurfingDay(day({ weatherCode })), 'storms')).toBe(
      points,
    );
  });

  it('scores a Lisbon-like day at 90: 40 + 25 + 15 + 10 + 0', () => {
    const factors = scoreSurfingDay(
      day({
        waveHeightMaxM: 1.5,
        wavePeriodMaxS: 11,
        windMaxKmh: 12,
        tempMaxC: 20,
        weatherCode: 2,
      }),
    );
    expect(sum(factors)).toBe(90);
  });

  it('tells "no sea here" from "no answer" when every wave height is missing', () => {
    const inland = [day({ waveHeightMaxM: null })];
    expect(surfingApplicability(inland, true)).toEqual({
      applicable: false,
      reason: 'no wave data for this location',
    });
    expect(surfingApplicability(inland, false)).toEqual({
      applicable: false,
      reason: 'wave data unavailable',
    });
    expect(
      surfingApplicability([...inland, day({ waveHeightMaxM: 1 })], true),
    ).toEqual({
      applicable: true,
    });
  });
});

describe('outdoor sightseeing', () => {
  it.each<Case>([
    [19, 30],
    [20, 15],
    [50, -5],
    [80, -20],
  ])('rain chance %s%% -> %s', (precipitationProbabilityPct, points) => {
    expect(
      pointsOf(
        scoreOutdoorDay(day({ precipitationProbabilityPct })),
        'rain chance',
      ),
    ).toBe(points);
  });

  it.each<Case>([
    [9.9, 0],
    [10, -10],
  ])('rain amount %s mm -> %s', (precipitationMm, points) => {
    expect(
      pointsOf(scoreOutdoorDay(day({ precipitationMm })), 'rain amount'),
    ).toBe(points);
  });

  it.each<Case>([
    [-1, -15],
    [0, 0],
    [8, 10],
    [15, 25],
    [26, 10],
    [32, 0],
    [35, -15],
  ])('temperature %s C -> %s', (tempMaxC, points) => {
    expect(pointsOf(scoreOutdoorDay(day({ tempMaxC })), 'temperature')).toBe(
      points,
    );
  });

  it.each<Case>([
    [19, 15],
    [20, 5],
    [40, -15],
  ])('wind %s km/h -> %s', (windMaxKmh, points) => {
    expect(pointsOf(scoreOutdoorDay(day({ windMaxKmh })), 'wind')).toBe(points);
  });

  it.each<[sunshineS: number, points: number]>([
    [10000, 0],
    [12000, 8],
    [24000, 15],
  ])('sunshine %s s of 40000 -> %s', (sunshineS, points) => {
    expect(
      pointsOf(
        scoreOutdoorDay(day({ sunshineS, daylightS: 40000 })),
        'sunshine',
      ),
    ).toBe(points);
  });

  it('cannot judge sunshine without the length of the day', () => {
    const factors = scoreOutdoorDay(day({ daylightS: null }));
    expect(factors.find((f) => f.name === 'sunshine')).toEqual({
      name: 'sunshine',
      value: 'no data',
      points: 0,
    });
  });

  it.each<Case>([
    [95, -20],
    [45, -10],
    [3, 0],
  ])('sky code %s -> %s', (weatherCode, points) => {
    expect(pointsOf(scoreOutdoorDay(day({ weatherCode })), 'sky')).toBe(points);
  });

  it.each<Case>([
    [7.9, 0],
    [8, -5],
  ])('uv %s -> %s', (uvIndexMax, points) => {
    expect(pointsOf(scoreOutdoorDay(day({ uvIndexMax })), 'uv')).toBe(points);
  });

  it('scores a perfect day at 85: 30 + 0 + 25 + 15 + 15 + 0 + 0', () => {
    const factors = scoreOutdoorDay(
      day({
        precipitationProbabilityPct: 10,
        precipitationMm: 0,
        tempMaxC: 22,
        windMaxKmh: 10,
        sunshineS: 32000,
        daylightS: 40000,
        weatherCode: 1,
        uvIndexMax: 5,
      }),
    );
    expect(factors).toHaveLength(7);
    expect(sum(factors)).toBe(85);
  });
});

describe('indoor sightseeing', () => {
  it('starts from a baseline that weather never removes', () => {
    expect(pointsOf(scoreIndoorDay(day()), 'baseline')).toBe(50);
  });

  it.each<Case>([
    [29, 0],
    [30, 10],
    [60, 25],
  ])('rain chance %s%% -> %s', (precipitationProbabilityPct, points) => {
    expect(
      pointsOf(
        scoreIndoorDay(day({ precipitationProbabilityPct })),
        'rain chance',
      ),
    ).toBe(points);
  });

  it.each<Case>([
    [4, 15],
    [5, 0],
    [30, 15],
  ])('temperature %s C -> %s', (tempMaxC, points) => {
    expect(pointsOf(scoreIndoorDay(day({ tempMaxC })), 'temperature')).toBe(
      points,
    );
  });

  it.each<Case>([
    [39, 0],
    [40, 10],
  ])('wind %s km/h -> %s', (windMaxKmh, points) => {
    expect(pointsOf(scoreIndoorDay(day({ windMaxKmh })), 'wind')).toBe(points);
  });

  it('marks down a day that is clearly better spent outside', () => {
    const outside = day({ sunshineS: 30000, daylightS: 40000, tempMaxC: 20 });
    expect(pointsOf(scoreIndoorDay(outside), 'a day to be outside')).toBe(-20);
    const grey = day({ sunshineS: 4000, daylightS: 40000, tempMaxC: 20 });
    expect(pointsOf(scoreIndoorDay(grey), 'a day to be outside')).toBe(0);
  });

  it('scores a rainy, cold, windy day at the top: 50 + 25 + 15 + 10 + 0', () => {
    const factors = scoreIndoorDay(
      day({
        precipitationProbabilityPct: 90,
        tempMaxC: 2,
        windMaxKmh: 50,
        sunshineS: 4000,
        daylightS: 40000,
      }),
    );
    expect(sum(factors)).toBe(100);
  });
});
