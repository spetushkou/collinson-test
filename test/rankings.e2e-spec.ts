import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { CLOCK } from '../src/common/clock.js';
import { FixtureServer, startFixtureServer } from './fixture-server.js';

const QUERY = `query Rank($city: String!, $countryCode: String) {
  activityRankings(city: $city, countryCode: $countryCode) {
    location { name countryCode timezone }
    forecast { stale ageMinutes marineFetchedAt source }
    activities {
      activity applicable reason
      days { date rank score factors { name value points } }
    }
  }
}`;

interface Ranked {
  location: { name: string; countryCode: string; timezone: string };
  forecast: {
    stale: boolean;
    ageMinutes: number;
    marineFetchedAt: string | null;
  };
  activities: Array<{
    activity: string;
    applicable: boolean;
    reason: string | null;
    days: Array<{
      date: string;
      rank: number;
      score: number;
      factors: unknown[];
    }>;
  }>;
}

describe('activityRankings (e2e)', () => {
  let app: INestApplication<App>;
  let upstream: FixtureServer;
  let dbDir: string;
  // The fixtures were captured on 2026-10-18; the service's clock is pinned to that day.
  let now = new Date('2026-10-18T10:00:00Z');

  const rank = (city: string, countryCode?: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .send({ query: QUERY, variables: { city, countryCode } });

  const errorCode = (res: request.Response) =>
    (res.body as { errors?: Array<{ extensions?: { code?: string } }> })
      .errors?.[0]?.extensions?.code;

  beforeAll(async () => {
    upstream = await startFixtureServer();
    dbDir = mkdtempSync(join(tmpdir(), 'rankings-e2e-'));
    process.env.DB_URL = `file:${join(dbDir, 'weather.sqlite')}`;
    process.env.OPEN_METEO_GEOCODING_URL = upstream.baseUrl;
    process.env.OPEN_METEO_FORECAST_URL = upstream.baseUrl;
    process.env.OPEN_METEO_MARINE_URL = upstream.baseUrl;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(() => now)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
    rmSync(dbDir, { recursive: true, force: true });
    for (const key of [
      'DB_URL',
      'OPEN_METEO_GEOCODING_URL',
      'OPEN_METEO_FORECAST_URL',
      'OPEN_METEO_MARINE_URL',
    ]) {
      delete process.env[key];
    }
  });

  it('ranks seven days per activity for Paris, and surfing is not applicable inland', async () => {
    const res = await rank('Paris').expect(200);
    const data = (res.body as { data: { activityRankings: Ranked } }).data
      .activityRankings;

    expect(data.location).toEqual({
      name: 'Paris',
      countryCode: 'FR',
      timezone: 'Europe/Paris',
    });
    expect(data.forecast).toMatchObject({ stale: false, ageMinutes: 0 });
    expect(data.activities.map((a) => [a.activity, a.applicable])).toEqual([
      ['SKIING', true],
      ['SURFING', false],
      ['OUTDOOR_SIGHTSEEING', true],
      ['INDOOR_SIGHTSEEING', true],
    ]);
    expect(data.activities[1]).toMatchObject({
      reason: 'no wave data for this location',
      days: [],
    });
    for (const activity of [
      data.activities[0],
      data.activities[2],
      data.activities[3],
    ]) {
      expect(activity.days).toHaveLength(7);
      expect(activity.days.map((d) => d.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(activity.days[0].factors.length).toBeGreaterThan(0);
    }
    expect(upstream.calls.sort()).toEqual([
      '/v1/forecast',
      '/v1/marine',
      '/v1/search',
    ]);
  });

  it('answers the second query from storage, without calling upstream', async () => {
    const before = upstream.calls.length;
    await rank('paris').expect(200);
    expect(upstream.calls.length).toBe(before);
  });

  it('ranks surfing for a coastal city', async () => {
    const res = await rank('Lisbon').expect(200);
    const surfing = (res.body as { data: { activityRankings: Ranked } }).data
      .activityRankings.activities[1];
    expect(surfing.applicable).toBe(true);
    expect(surfing.days).toHaveLength(7);
  });

  it('serves the stored week, marked stale, when the refresh fails', async () => {
    now = new Date('2026-10-18T11:01:00Z');
    upstream.fail.add('forecast');
    try {
      const res = await rank('Paris').expect(200);
      const data = (res.body as { data: { activityRankings: Ranked } }).data
        .activityRankings;
      expect(data.forecast).toMatchObject({ stale: true, ageMinutes: 61 });
      expect(data.activities[2].days).toHaveLength(7);
    } finally {
      upstream.fail.delete('forecast');
      now = new Date('2026-10-18T10:00:00Z');
    }
  });

  it.each([
    ['xqzvplace', undefined, 'PLACE_NOT_FOUND'],
    ['P', undefined, 'BAD_USER_INPUT'],
    ['Paris', 'FRA', 'BAD_USER_INPUT'],
  ])('reports %j / %j as %s', async (city, countryCode, code) => {
    const res = await rank(city, countryCode).expect(200);
    expect(errorCode(res)).toBe(code);
  });

  it('reports UPSTREAM_UNAVAILABLE when the weather fails and nothing is stored', async () => {
    upstream.fail.add('forecast');
    try {
      const res = await rank('Paris', 'US').expect(200);
      expect(errorCode(res)).toBe('UPSTREAM_UNAVAILABLE');
    } finally {
      upstream.fail.delete('forecast');
    }
    // The same request succeeds once the forecast is back, so the error above came from the
    // failure and not from a place the fixtures cannot answer.
    const res = await rank('Paris', 'US').expect(200);
    expect(errorCode(res)).toBeUndefined();
  });

  it('keeps answering GET /health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
