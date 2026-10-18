import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config/config.js';
import { OpenMeteoClient } from './open-meteo.client.js';
import { FetchFn, UpstreamError } from './types.js';

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(process.cwd(), 'test/fixtures', `${name}.json`), 'utf8'),
  );

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// A fake fetch that answers from a fixture chosen by the caller and records every URL.
function fakeFetch(answer: (url: URL) => Response | Promise<Response>) {
  const urls: URL[] = [];
  const fetchFn: FetchFn = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return answer(url);
  };
  return { fetchFn, urls };
}

const config = loadConfig({ UPSTREAM_TIMEOUT_MS: '50' });
const PARIS = { latitude: 48.85341, longitude: 2.3488 };

describe('OpenMeteoClient', () => {
  describe('geocode', () => {
    it('resolves Paris to Paris, France, with its timezone', async () => {
      const { fetchFn, urls } = fakeFetch(() => json(fixture('geocode-paris')));
      const place = await new OpenMeteoClient(config, fetchFn).geocode('Paris');

      expect(place).toMatchObject({
        name: 'Paris',
        country: 'France',
        countryCode: 'FR',
        timezone: 'Europe/Paris',
      });
      expect(urls[0].origin).toBe('https://geocoding-api.open-meteo.com');
      expect(urls[0].pathname).toBe('/v1/search');
      expect(urls[0].searchParams.get('name')).toBe('Paris');
      expect(urls[0].searchParams.get('count')).toBe('1');
      expect(urls[0].searchParams.has('countryCode')).toBe(false);
    });

    it('passes the country code through', async () => {
      const { fetchFn, urls } = fakeFetch(() =>
        json(fixture('geocode-paris-us')),
      );
      const place = await new OpenMeteoClient(config, fetchFn).geocode(
        'Paris',
        'US',
      );

      expect(urls[0].searchParams.get('countryCode')).toBe('US');
      expect(place?.admin1).toBe('Texas');
    });

    it('returns null for a name the geocoder does not know', async () => {
      const { fetchFn } = fakeFetch(() => json(fixture('geocode-unknown')));
      await expect(
        new OpenMeteoClient(config, fetchFn).geocode('xqzvplace'),
      ).resolves.toBeNull();
    });
  });

  describe('forecast', () => {
    it('asks for exactly the design variables, in local days', async () => {
      const { fetchFn, urls } = fakeFetch(() =>
        json(fixture('forecast-paris')),
      );
      await new OpenMeteoClient(config, fetchFn).forecast(
        PARIS.latitude,
        PARIS.longitude,
      );

      const params = urls[0].searchParams;
      expect(urls[0].origin + urls[0].pathname).toBe(
        'https://api.open-meteo.com/v1/forecast',
      );
      expect(params.get('daily')?.split(',')).toEqual([
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
      ]);
      expect(params.get('hourly')).toBe('snow_depth');
      expect(params.get('timezone')).toBe('auto');
      expect(params.get('forecast_days')).toBe('7');
    });

    it('returns seven days with the hourly snow depth folded to a daily maximum', async () => {
      const raw = fixture('forecast-paris') as {
        daily: { time: string[]; temperature_2m_max: number[] };
        hourly: { time: string[]; snow_depth: (number | null)[] };
      };
      // Put a known snow depth on the second day: 0.12 m at 06:00, 0.30 m at 18:00.
      const day = raw.daily.time[1];
      raw.hourly.snow_depth = raw.hourly.time.map((t) =>
        t === `${day}T06:00` ? 0.12 : t === `${day}T18:00` ? 0.3 : 0,
      );
      const { fetchFn } = fakeFetch(() => json(raw));
      const days = await new OpenMeteoClient(config, fetchFn).forecast(1, 2);

      expect(days).toHaveLength(7);
      expect(days.map((d) => d.date)).toEqual(raw.daily.time);
      expect(days[1].snowDepthMaxCm).toBe(30);
      expect(days[0].snowDepthMaxCm).toBe(0);
      expect(days[0].tempMaxC).toBe(raw.daily.temperature_2m_max[0]);
    });

    it('keeps a missing value as null', async () => {
      const { fetchFn } = fakeFetch(() => json(fixture('forecast-with-null')));
      const days = await new OpenMeteoClient(config, fetchFn).forecast(1, 2);
      expect(days[2].tempMaxC).toBeNull();
      expect(days[1].tempMaxC).not.toBeNull();
    });

    it('treats a day with no snow-depth readings as no data, not zero', async () => {
      const raw = fixture('forecast-paris') as {
        hourly: { snow_depth: (number | null)[] };
      };
      raw.hourly.snow_depth = raw.hourly.snow_depth.map(() => null);
      const { fetchFn } = fakeFetch(() => json(raw));
      const days = await new OpenMeteoClient(config, fetchFn).forecast(1, 2);
      expect(days.every((d) => d.snowDepthMaxCm === null)).toBe(true);
    });
  });

  describe('marine', () => {
    it('returns seven days of null waves for an inland point', async () => {
      const { fetchFn, urls } = fakeFetch(() => json(fixture('marine-paris')));
      const days = await new OpenMeteoClient(config, fetchFn).marine(1, 2);

      expect(urls[0].origin + urls[0].pathname).toBe(
        'https://marine-api.open-meteo.com/v1/marine',
      );
      expect(urls[0].searchParams.get('daily')).toBe(
        'wave_height_max,wave_period_max',
      );
      expect(days).toHaveLength(7);
      expect(days.every((d) => d.waveHeightMaxM === null)).toBe(true);
    });

    it('returns the waves for a coastal point', async () => {
      const { fetchFn } = fakeFetch(() => json(fixture('marine-lisbon')));
      const days = await new OpenMeteoClient(config, fetchFn).marine(1, 2);
      expect(days.every((d) => typeof d.waveHeightMaxM === 'number')).toBe(
        true,
      );
    });
  });

  describe('failures', () => {
    it('turns an HTTP error into an UpstreamError naming the endpoint', async () => {
      const { fetchFn } = fakeFetch(() => json({ reason: 'down' }, 500));
      const error = await new OpenMeteoClient(config, fetchFn)
        .forecast(1, 2)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as UpstreamError).endpoint).toBe('forecast');
      expect((error as UpstreamError).message).toContain('500');
    });

    it('treats an error body sent with HTTP 200 as a failure, not data', async () => {
      const { fetchFn } = fakeFetch(() =>
        json({ error: true, reason: 'Cannot initialize WeatherVariable' }),
      );
      await expect(
        new OpenMeteoClient(config, fetchFn).marine(1, 2),
      ).rejects.toThrow(/Cannot initialize WeatherVariable/);
    });

    it('gives up after the configured timeout', async () => {
      const fetchFn: FetchFn = (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        });
      const started = Date.now();
      const error = await new OpenMeteoClient(config, fetchFn)
        .geocode('Paris')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UpstreamError);
      expect((error as UpstreamError).endpoint).toBe('geocoding');
      expect(Date.now() - started).toBeLessThan(1000);
    });

    it('turns a network error into an UpstreamError', async () => {
      const fetchFn: FetchFn = () =>
        Promise.reject(new TypeError('fetch failed'));
      await expect(
        new OpenMeteoClient(config, fetchFn).forecast(1, 2),
      ).rejects.toBeInstanceOf(UpstreamError);
    });
  });
});
