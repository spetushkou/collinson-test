import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { createDb, runMigrations } from './database.js';
import { dailyForecasts, places } from './schema.js';

describe('database', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'weather-db-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the three tables, and migrating twice is harmless', async () => {
    const db = createDb(`file:${join(dir, 'nested', 'weather.sqlite')}`);
    await runMigrations(db);
    await runMigrations(db);

    const tables = await db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name not like 'sqlite_%' order by name`,
    );
    expect(tables.map((t) => t.name)).toEqual([
      'daily_forecasts',
      'place_lookups',
      'places',
    ]);
  });

  it('stores a day with every weather value missing', async () => {
    const db = createDb(`file:${join(dir, 'weather.sqlite')}`);
    await runMigrations(db);
    await db.insert(places).values({
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
      fetchedAt: '2026-10-18T12:00:00.000Z',
    });
    await db.insert(dailyForecasts).values({
      placeId: 2988507,
      date: '2026-10-18',
      fetchedAt: '2026-10-18T12:00:00.000Z',
    });

    const [row] = await db.select().from(dailyForecasts);
    expect(row.tempMaxC).toBeNull();
    expect(row.waveHeightMaxM).toBeNull();
    expect(row.marineFetchedAt).toBeNull();
  });
});
