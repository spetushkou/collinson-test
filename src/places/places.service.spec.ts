import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '../common/errors.js';
import { createDb, Db, runMigrations } from '../database/database.js';
import { GeocodedPlace, UpstreamError } from '../open-meteo/types.js';
import { normaliseQuery, PlacesService } from './places.service.js';

const PARIS_FR: GeocodedPlace = {
  id: 2988507,
  name: 'Paris',
  admin1: 'Ile-de-France',
  country: 'France',
  countryCode: 'FR',
  latitude: 48.85341,
  longitude: 2.3488,
  elevation: 42,
  timezone: 'Europe/Paris',
  population: 2138551,
};
const PARIS_US: GeocodedPlace = {
  ...PARIS_FR,
  id: 4717560,
  admin1: 'Texas',
  country: 'United States',
  countryCode: 'US',
  timezone: 'America/Chicago',
};

describe('normaliseQuery', () => {
  it('trims, collapses spaces and lower-cases', () => {
    expect(normaliseQuery('  New   YORK ')).toBe('new york');
  });
});

describe('PlacesService', () => {
  let dir: string;
  let db: Db;
  let now: Date;
  let calls: Array<{ name: string; countryCode?: string }>;
  let answer: (name: string, countryCode?: string) => GeocodedPlace | null;
  let service: PlacesService;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'places-'));
    db = createDb(`file:${join(dir, 'w.sqlite')}`);
    await runMigrations(db);
    now = new Date('2026-10-18T12:00:00Z');
    calls = [];
    answer = (name, countryCode) =>
      name.toLowerCase().startsWith('paris')
        ? countryCode === 'US'
          ? PARIS_US
          : PARIS_FR
        : null;
    const geocoder = {
      geocode: async (name: string, countryCode?: string) => {
        calls.push({ name, countryCode });
        return answer(name, countryCode);
      },
    };
    service = new PlacesService(db, geocoder, () => now);
  });

  afterEach(() => {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('geocodes an unseen city once and stores it', async () => {
    const place = await service.resolve('Paris');
    expect(place).toMatchObject({
      id: 2988507,
      name: 'Paris',
      countryCode: 'FR',
      timezone: 'Europe/Paris',
    });
    expect(calls).toEqual([{ name: 'Paris', countryCode: undefined }]);
  });

  it('answers the same city from storage, however it is typed', async () => {
    await service.resolve('Paris');
    const again = await service.resolve('  pArIs ');
    expect(again.id).toBe(2988507);
    expect(calls).toHaveLength(1);
  });

  it('upper-cases the country code and keeps it as its own lookup', async () => {
    await service.resolve('Paris');
    const texas = await service.resolve('Paris', 'us');
    expect(texas.admin1).toBe('Texas');
    expect(calls[1]).toEqual({ name: 'Paris', countryCode: 'US' });
    await service.resolve('paris', 'US');
    expect(calls).toHaveLength(2);
  });

  it('geocodes again once a lookup is older than 30 days', async () => {
    await service.resolve('Paris');
    now = new Date('2026-11-18T12:00:01Z');
    await service.resolve('Paris');
    expect(calls).toHaveLength(2);
  });

  it.each([
    ['P', undefined],
    ['   ', undefined],
    ['Paris', 'FRA'],
    ['Paris', 'F1'],
  ])(
    'rejects city %j with country code %j as BAD_USER_INPUT',
    async (city, code) => {
      const error = await service.resolve(city, code).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('BAD_USER_INPUT');
      expect(calls).toHaveLength(0);
    },
  );

  it('reports a name the geocoder does not know as PLACE_NOT_FOUND', async () => {
    const error = await service.resolve('xqzvplace').catch((e: unknown) => e);
    expect((error as AppError).code).toBe('PLACE_NOT_FOUND');
  });

  it('reports a geocoder outage as UPSTREAM_UNAVAILABLE', async () => {
    answer = () => {
      throw new UpstreamError('geocoding', 'HTTP 503');
    };
    const error = await service.resolve('Paris').catch((e: unknown) => e);
    expect((error as AppError).code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
