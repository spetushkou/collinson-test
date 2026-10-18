import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '../common/errors.js';
import { loadConfig } from '../config/config.js';
import { createDb, Db, runMigrations } from '../database/database.js';
import { places, PlaceRow } from '../database/schema.js';
import {
  DailyForecast,
  DailyMarine,
  UpstreamError,
} from '../open-meteo/types.js';
import { WeatherRepository } from './weather.repository.js';
import { WeatherService } from './weather.service.js';
import { localWindow } from './window.js';

const PARIS: PlaceRow = {
  id: 2988507,
  name: 'Paris',
  admin1: null,
  country: 'France',
  countryCode: 'FR',
  latitude: 48.85,
  longitude: 2.35,
  elevation: 42,
  timezone: 'Europe/Paris',
  population: null,
  fetchedAt: '2026-10-18T00:00:00.000Z',
};

const forecastFor = (dates: string[], tempMaxC: number): DailyForecast[] =>
  dates.map((date) => ({
    date,
    tempMaxC,
    tempMinC: 5,
    snowfallCm: 0,
    snowDepthMaxCm: 0,
    precipitationMm: 0,
    precipitationProbabilityPct: 10,
    weatherCode: 1,
    sunshineS: 20000,
    daylightS: 36000,
    windMaxKmh: 10,
    uvIndexMax: 3,
  }));

const marineFor = (dates: string[], wave: number | null): DailyMarine[] =>
  dates.map((date) => ({
    date,
    waveHeightMaxM: wave,
    wavePeriodMaxS: wave && 9,
  }));

describe('WeatherService', () => {
  let dir: string;
  let db: Db;
  let now: Date;
  let calls: { forecast: number; marine: number };
  let fail: { forecast: boolean; marine: boolean };
  let temp: number;
  let wave: number | null;
  let service: WeatherService;

  const minutes = (n: number) => {
    now = new Date(now.getTime() + n * 60_000);
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'weather-'));
    db = createDb(`file:${join(dir, 'w.sqlite')}`);
    await runMigrations(db);
    await db.insert(places).values(PARIS);
    now = new Date('2026-10-18T10:00:00Z');
    calls = { forecast: 0, marine: 0 };
    fail = { forecast: false, marine: false };
    temp = 20;
    wave = null;
    const client = {
      forecast: async () => {
        calls.forecast++;
        await new Promise((r) => setTimeout(r, 5));
        if (fail.forecast) throw new UpstreamError('forecast', 'HTTP 503');
        return forecastFor(localWindow(PARIS.timezone, now), temp);
      },
      marine: async () => {
        calls.marine++;
        if (fail.marine) throw new UpstreamError('marine', 'HTTP 503');
        return marineFor(localWindow(PARIS.timezone, now), wave);
      },
    };
    service = new WeatherService(
      new WeatherRepository(db),
      client,
      () => now,
      loadConfig({ FORECAST_TTL_MINUTES: '60' }),
    );
  });

  afterEach(() => {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('fetches an empty store once and stores the seven days', async () => {
    const week = await service.getWeek(PARIS);
    expect(calls).toEqual({ forecast: 1, marine: 1 });
    expect(week.days.map((d) => d.date)).toEqual(
      localWindow(PARIS.timezone, now),
    );
    expect(week).toMatchObject({ stale: false, ageMinutes: 0 });
    expect(week.fetchedAt).toBe(now.toISOString());
  });

  it('serves stored data inside the refresh window without calling upstream', async () => {
    await service.getWeek(PARIS);
    minutes(59);
    const week = await service.getWeek(PARIS);
    expect(calls).toEqual({ forecast: 1, marine: 1 });
    expect(week).toMatchObject({ stale: false, ageMinutes: 59 });
  });

  it('refreshes once the stored forecast is older than the window, replacing it', async () => {
    await service.getWeek(PARIS);
    minutes(61);
    temp = 25;
    const week = await service.getWeek(PARIS);
    expect(calls.forecast).toBe(2);
    expect(week.days.every((d) => d.tempMaxC === 25)).toBe(true);
    expect(week.ageMinutes).toBe(0);
  });

  it('serves the stored week, marked stale, when the refresh fails', async () => {
    await service.getWeek(PARIS);
    minutes(61);
    fail.forecast = true;
    const week = await service.getWeek(PARIS);
    expect(week).toMatchObject({ stale: true, ageMinutes: 61 });
    expect(week.days).toHaveLength(7);
  });

  it('fails as UPSTREAM_UNAVAILABLE when nothing is stored and the fetch fails', async () => {
    fail.forecast = true;
    const error = await service.getWeek(PARIS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('keeps stored waves when the marine call fails on a refresh', async () => {
    wave = 1.5;
    const first = await service.getWeek(PARIS);
    minutes(61);
    fail.marine = true;
    wave = 3;
    const week = await service.getWeek(PARIS);
    expect(week.days.every((d) => d.waveHeightMaxM === 1.5)).toBe(true);
    expect(week.marineFetchedAt).toBe(first.marineFetchedAt);
    expect(week.stale).toBe(false);
  });

  it('records a marine answer of nulls as fetched - "no sea here"', async () => {
    const week = await service.getWeek(PARIS);
    expect(week.days.every((d) => d.waveHeightMaxM === null)).toBe(true);
    expect(week.marineFetchedAt).toBe(now.toISOString());
  });

  it('leaves the marine time empty when the marine call never succeeded', async () => {
    fail.marine = true;
    const week = await service.getWeek(PARIS);
    expect(week.marineFetchedAt).toBeNull();
  });

  it('refreshes after local midnight even inside the refresh window', async () => {
    now = new Date('2026-10-18T21:30:00Z'); // 23:30 in Paris
    await service.getWeek(PARIS);
    minutes(45); // 00:15 the next day in Paris: one stored day has left the window
    await service.getWeek(PARIS);
    expect(calls.forecast).toBe(2);
  });

  it('serves the days still in the window when that refresh fails', async () => {
    await service.getWeek(PARIS);
    minutes(24 * 60);
    fail.forecast = true;
    const week = await service.getWeek(PARIS);
    expect(week.stale).toBe(true);
    expect(week.days).toHaveLength(6);
    expect(week.days[0].date).toBe(localWindow(PARIS.timezone, now)[0]);
  });

  it('makes one upstream fetch for concurrent requests about the same place', async () => {
    const weeks = await Promise.all([
      service.getWeek(PARIS),
      service.getWeek(PARIS),
      service.getWeek(PARIS),
    ]);
    expect(calls.forecast).toBe(1);
    expect(weeks.every((w) => w.days.length === 7)).toBe(true);
  });
});
