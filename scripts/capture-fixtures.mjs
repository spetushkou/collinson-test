// Captures real Open-Meteo responses into test/fixtures/ so no test ever calls the live API.
// This script is the only code that does. Re-run it only to refresh the fixtures on purpose:
//
//   node scripts/capture-fixtures.mjs
//
// The query parameters mirror src/open-meteo/open-meteo.client.ts; the client's unit tests
// assert the same lists, so a drift shows up there.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'test/fixtures';

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'snowfall_sum',
  'precipitation_sum',
  'precipitation_probability_max',
  'weather_code',
  'sunshine_duration',
  'daylight_duration',
  'wind_speed_10m_max',
  'uv_index_max',
].join(',');

const forecast = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${DAILY}&hourly=snow_depth&timezone=auto&forecast_days=7`;
const marine = (lat, lon) =>
  `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max,wave_period_max&timezone=auto&forecast_days=7`;
const geocode = (name, countryCode) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json${countryCode ? `&countryCode=${countryCode}` : ''}`;

mkdirSync(OUT, { recursive: true });

const save = (name, body) =>
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(body, null, 2) + '\n');

const get = async (name, url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const body = await response.json();
  save(name, body);
  console.log(`${name}: captured`);
  return body;
};

const paris = await get('geocode-paris', geocode('Paris'));
await get('geocode-paris-us', geocode('Paris', 'US'));
const lisbon = await get('geocode-lisbon', geocode('Lisbon'));
await get('geocode-unknown', geocode('xqzvplace'));

// The weather calls use the geocoder's own coordinates - exactly what the service will
// send - so the e2e fixture server can route by them.
const at = (geo) => [geo.results[0].latitude, geo.results[0].longitude];
const forecastParis = await get('forecast-paris', forecast(...at(paris)));
await get('forecast-lisbon', forecast(...at(lisbon)));
await get('marine-paris', marine(...at(paris)));
await get('marine-lisbon', marine(...at(lisbon)));

// A day with one value missing, which Open-Meteo can return and the service must survive.
const withNull = structuredClone(forecastParis);
withNull.daily.temperature_2m_max[2] = null;
save('forecast-with-null', withNull);
console.log('forecast-with-null: derived');
