import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfig } from '../config/config.js';
import {
  DailyForecast,
  DailyMarine,
  Endpoint,
  FETCH,
  GeocodedPlace,
  UpstreamError,
} from './types.js';
import type { FetchFn } from './types.js';

const DAILY_FORECAST = [
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
] as const;

const DAILY_MARINE = ['wave_height_max', 'wave_period_max'] as const;

type Series = (number | null)[];

interface ForecastBody {
  daily: { time: string[] } & Record<(typeof DAILY_FORECAST)[number], Series>;
  hourly?: { time: string[]; snow_depth: Series };
}

interface MarineBody {
  daily: { time: string[] } & Record<(typeof DAILY_MARINE)[number], Series>;
}

interface GeocodingBody {
  results?: Array<{
    id: number;
    name: string;
    admin1?: string;
    country: string;
    country_code: string;
    latitude: number;
    longitude: number;
    elevation: number;
    timezone: string;
    population?: number;
  }>;
}

@Injectable()
export class OpenMeteoClient {
  private readonly logger = new Logger(OpenMeteoClient.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(FETCH) private readonly fetchFn: FetchFn,
  ) {}

  async geocode(
    name: string,
    countryCode?: string,
  ): Promise<GeocodedPlace | null> {
    const url = new URL('/v1/search', this.config.openMeteo.geocodingUrl);
    url.search = new URLSearchParams({
      name,
      count: '1',
      language: 'en',
      format: 'json',
      ...(countryCode ? { countryCode } : {}),
    }).toString();

    // An unknown name is HTTP 200 with no `results` key, not the 400 the docs describe.
    const body = await this.get<GeocodingBody>('geocoding', url);
    const hit = body.results?.[0];
    if (!hit) return null;
    return {
      id: hit.id,
      name: hit.name,
      admin1: hit.admin1 ?? null,
      country: hit.country,
      countryCode: hit.country_code,
      latitude: hit.latitude,
      longitude: hit.longitude,
      elevation: hit.elevation,
      timezone: hit.timezone,
      population: hit.population ?? null,
    };
  }

  async forecast(
    latitude: number,
    longitude: number,
  ): Promise<DailyForecast[]> {
    const url = this.weatherUrl(
      this.config.openMeteo.forecastUrl,
      '/v1/forecast',
      latitude,
      longitude,
      DAILY_FORECAST,
    );
    url.searchParams.set('hourly', 'snow_depth');

    const body = await this.get<ForecastBody>('forecast', url);
    const snowDepth = maxPerDay(
      body.hourly?.time ?? [],
      body.hourly?.snow_depth ?? [],
    );
    const d = body.daily;
    return d.time.map((date, i) => ({
      date,
      tempMaxC: d.temperature_2m_max[i] ?? null,
      tempMinC: d.temperature_2m_min[i] ?? null,
      snowfallCm: d.snowfall_sum[i] ?? null,
      // Open-Meteo reports snow depth in metres, hourly only.
      snowDepthMaxCm: toCm(snowDepth.get(date)),
      precipitationMm: d.precipitation_sum[i] ?? null,
      precipitationProbabilityPct: d.precipitation_probability_max[i] ?? null,
      weatherCode: d.weather_code[i] ?? null,
      sunshineS: d.sunshine_duration[i] ?? null,
      daylightS: d.daylight_duration[i] ?? null,
      windMaxKmh: d.wind_speed_10m_max[i] ?? null,
      uvIndexMax: d.uv_index_max[i] ?? null,
    }));
  }

  // An inland point is a success with null values - the answer "no sea here" - not an error.
  async marine(latitude: number, longitude: number): Promise<DailyMarine[]> {
    const url = this.weatherUrl(
      this.config.openMeteo.marineUrl,
      '/v1/marine',
      latitude,
      longitude,
      DAILY_MARINE,
    );
    const body = await this.get<MarineBody>('marine', url);
    const d = body.daily;
    return d.time.map((date, i) => ({
      date,
      waveHeightMaxM: d.wave_height_max[i] ?? null,
      wavePeriodMaxS: d.wave_period_max[i] ?? null,
    }));
  }

  private weatherUrl(
    base: string,
    path: string,
    latitude: number,
    longitude: number,
    daily: readonly string[],
  ): URL {
    const url = new URL(path, base);
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: daily.join(','),
      timezone: 'auto',
      forecast_days: '7',
    }).toString();
    return url;
  }

  private async get<T>(endpoint: Endpoint, url: URL): Promise<T> {
    const started = Date.now();
    let status = 'error';
    try {
      const response = await this.fetchFn(url, {
        signal: AbortSignal.timeout(this.config.upstreamTimeoutMs),
      });
      status = String(response.status);
      if (!response.ok) {
        throw new UpstreamError(endpoint, `HTTP ${response.status}`);
      }
      const body = (await response.json()) as T & {
        error?: boolean;
        reason?: string;
      };
      // Open-Meteo reports a bad request as HTTP 200 with { error: true, reason }.
      if (body.error) {
        throw new UpstreamError(endpoint, body.reason ?? 'error response');
      }
      return body;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      const reason =
        error instanceof Error && error.name === 'TimeoutError'
          ? `timed out after ${this.config.upstreamTimeoutMs} ms`
          : error instanceof Error
            ? error.message
            : String(error);
      throw new UpstreamError(endpoint, reason);
    } finally {
      this.logger.log(
        `upstream ${endpoint} status=${status} ms=${Date.now() - started}`,
      );
    }
  }
}

// Hourly times are local 'YYYY-MM-DDTHH:MM'; the day is the part before the 'T'.
function maxPerDay(times: string[], values: Series): Map<string, number> {
  const max = new Map<string, number>();
  times.forEach((time, i) => {
    const value = values[i];
    if (value === null || value === undefined) return;
    const day = time.slice(0, 10);
    max.set(day, Math.max(max.get(day) ?? -Infinity, value));
  });
  return max;
}

function toCm(metres: number | undefined): number | null {
  return metres === undefined ? null : Math.round(metres * 1000) / 10;
}
