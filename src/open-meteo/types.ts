export type FetchFn = typeof fetch;

export const FETCH = Symbol('FETCH');

export type Endpoint = 'geocoding' | 'forecast' | 'marine';

export class UpstreamError extends Error {
  constructor(
    readonly endpoint: Endpoint,
    message: string,
  ) {
    super(`Open-Meteo ${endpoint}: ${message}`);
    this.name = 'UpstreamError';
  }
}

export interface GeocodedPlace {
  id: number;
  name: string;
  admin1: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  population: number | null;
}

// One local day. Any value can be null: Open-Meteo leaves out what a model does not provide.
export interface DailyForecast {
  date: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  snowfallCm: number | null;
  snowDepthMaxCm: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  weatherCode: number | null;
  sunshineS: number | null;
  daylightS: number | null;
  windMaxKmh: number | null;
  uvIndexMax: number | null;
}

export interface DailyMarine {
  date: string;
  waveHeightMaxM: number | null;
  wavePeriodMaxS: number | null;
}
