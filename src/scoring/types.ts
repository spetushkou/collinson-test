import type { DailyForecastRow } from '../database/schema.js';

export type Activity =
  'SKIING' | 'SURFING' | 'OUTDOOR_SIGHTSEEING' | 'INDOOR_SIGHTSEEING';

// The weather of one local day, as stored - every value can be null.
export type DayInput = Pick<
  DailyForecastRow,
  | 'date'
  | 'tempMaxC'
  | 'tempMinC'
  | 'snowfallCm'
  | 'snowDepthMaxCm'
  | 'precipitationMm'
  | 'precipitationProbabilityPct'
  | 'weatherCode'
  | 'sunshineS'
  | 'daylightS'
  | 'windMaxKmh'
  | 'uvIndexMax'
  | 'waveHeightMaxM'
  | 'wavePeriodMaxS'
>;

export interface Factor {
  name: string;
  value: string;
  points: number;
}

export interface DayScore {
  date: string;
  rank: number;
  score: number;
  factors: Factor[];
}

export interface Applicability {
  applicable: boolean;
  reason?: string;
}
