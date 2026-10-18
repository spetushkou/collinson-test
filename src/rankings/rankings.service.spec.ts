import type { DailyForecastRow, PlaceRow } from '../database/schema.js';
import type { WeatherWeek } from '../weather/weather.service.js';
import { RankingsService } from './rankings.service.js';

const PARIS: PlaceRow = {
  id: 2988507,
  name: 'Paris',
  admin1: 'Ile-de-France',
  country: 'France',
  countryCode: 'FR',
  latitude: 48.85,
  longitude: 2.35,
  elevation: 42,
  timezone: 'Europe/Paris',
  population: 2138551,
  fetchedAt: '2026-10-18T10:00:00.000Z',
};

const dayRow = (
  date: string,
  overrides: Partial<DailyForecastRow> = {},
): DailyForecastRow => ({
  placeId: PARIS.id,
  date,
  fetchedAt: '2026-10-18T10:00:00.000Z',
  tempMaxC: 18,
  tempMinC: 9,
  snowfallCm: 0,
  snowDepthMaxCm: 0,
  precipitationMm: 0,
  precipitationProbabilityPct: 10,
  weatherCode: 1,
  sunshineS: 25000,
  daylightS: 38000,
  windMaxKmh: 12,
  uvIndexMax: 3,
  marineFetchedAt: '2026-10-18T10:00:00.000Z',
  waveHeightMaxM: null,
  wavePeriodMaxS: null,
  ...overrides,
});

describe('RankingsService', () => {
  let week: WeatherWeek;
  let service: RankingsService;

  beforeEach(() => {
    week = {
      days: ['2026-10-18', '2026-10-19', '2026-10-20'].map((date, i) =>
        dayRow(date, { precipitationProbabilityPct: [10, 90, 50][i] }),
      ),
      fetchedAt: '2026-10-18T10:00:00.000Z',
      ageMinutes: 5,
      stale: false,
      marineFetchedAt: '2026-10-18T10:00:00.000Z',
    };
    service = new RankingsService(
      { resolve: async () => PARIS },
      { getWeek: async () => week },
    );
  });

  it('echoes the resolved place and the age of the forecast', async () => {
    const result = await service.rank('Paris');
    expect(result.location).toMatchObject({
      name: 'Paris',
      countryCode: 'FR',
      timezone: 'Europe/Paris',
    });
    expect(result.forecast).toEqual({
      fetchedAt: '2026-10-18T10:00:00.000Z',
      ageMinutes: 5,
      stale: false,
      marineFetchedAt: '2026-10-18T10:00:00.000Z',
      source: 'open-meteo',
    });
  });

  it('returns the four activities in a fixed order', async () => {
    const result = await service.rank('Paris');
    expect(result.activities.map((a) => a.activity)).toEqual([
      'SKIING',
      'SURFING',
      'OUTDOOR_SIGHTSEEING',
      'INDOOR_SIGHTSEEING',
    ]);
  });

  it('ranks the days within an activity, best first, with their reasons', async () => {
    const result = await service.rank('Paris');
    const outdoor = result.activities.find(
      (a) => a.activity === 'OUTDOOR_SIGHTSEEING',
    );
    expect(outdoor?.days.map((d) => [d.rank, d.date])).toEqual([
      [1, '2026-10-18'],
      [2, '2026-10-20'],
      [3, '2026-10-19'],
    ]);
    expect(outdoor?.days[0].factors.length).toBeGreaterThan(0);
    const indoor = result.activities.find(
      (a) => a.activity === 'INDOOR_SIGHTSEEING',
    );
    expect(indoor?.days[0].date).toBe('2026-10-19');
  });

  it('marks surfing not applicable inland, with the reason and no days', async () => {
    const result = await service.rank('Paris');
    expect(result.activities[1]).toEqual({
      activity: 'SURFING',
      applicable: false,
      reason: 'no wave data for this location',
      days: [],
    });
  });

  it('says the wave data is unavailable when no marine answer is stored', async () => {
    week.marineFetchedAt = null;
    const result = await service.rank('Paris');
    expect(result.activities[1].reason).toBe('wave data unavailable');
  });

  it('passes a stale forecast through as stale', async () => {
    week.stale = true;
    week.ageMinutes = 180;
    const result = await service.rank('Paris');
    expect(result.forecast).toMatchObject({ stale: true, ageMinutes: 180 });
  });
});
