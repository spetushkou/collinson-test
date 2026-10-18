import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

// Timestamps are ISO 8601 strings in UTC; dates are the place's local 'YYYY-MM-DD'.

export const places = sqliteTable('places', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  admin1: text('admin1'),
  country: text('country').notNull(),
  countryCode: text('country_code').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  elevation: real('elevation').notNull(),
  timezone: text('timezone').notNull(),
  population: integer('population'),
  fetchedAt: text('fetched_at').notNull(),
});

export const placeLookups = sqliteTable(
  'place_lookups',
  {
    query: text('query').notNull(),
    countryCode: text('country_code').notNull(),
    placeId: integer('place_id')
      .notNull()
      .references(() => places.id),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.query, t.countryCode] })],
);

// One row per place per local day. A forecast refresh replaces the weather columns; the
// wave columns are written only by a successful marine call, which also sets
// marine_fetched_at - so "fetched, no sea here" (set, waves null) is told apart from
// "marine source never answered" (null).
export const dailyForecasts = sqliteTable(
  'daily_forecasts',
  {
    placeId: integer('place_id')
      .notNull()
      .references(() => places.id),
    date: text('date').notNull(),
    fetchedAt: text('fetched_at').notNull(),
    tempMaxC: real('temp_max_c'),
    tempMinC: real('temp_min_c'),
    snowfallCm: real('snowfall_cm'),
    snowDepthMaxCm: real('snow_depth_max_cm'),
    precipitationMm: real('precipitation_mm'),
    precipitationProbabilityPct: integer('precipitation_probability_pct'),
    weatherCode: integer('weather_code'),
    sunshineS: real('sunshine_s'),
    daylightS: real('daylight_s'),
    windMaxKmh: real('wind_max_kmh'),
    uvIndexMax: real('uv_index_max'),
    marineFetchedAt: text('marine_fetched_at'),
    waveHeightMaxM: real('wave_height_max_m'),
    wavePeriodMaxS: real('wave_period_max_s'),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.date] })],
);

export type PlaceRow = typeof places.$inferSelect;
export type DailyForecastRow = typeof dailyForecasts.$inferSelect;
