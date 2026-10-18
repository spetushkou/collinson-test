import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK } from '../common/clock.js';
import type { Clock } from '../common/clock.js';
import { AppError } from '../common/errors.js';
import { APP_CONFIG } from '../config/config.js';
import type { AppConfig } from '../config/config.js';
import type { DailyForecastRow, PlaceRow } from '../database/schema.js';
import { OpenMeteoClient } from '../open-meteo/open-meteo.client.js';
import { WeatherRepository } from './weather.repository.js';
import { localWindow } from './window.js';

export interface WeatherWeek {
  days: DailyForecastRow[];
  fetchedAt: string;
  ageMinutes: number;
  stale: boolean;
  marineFetchedAt: string | null;
}

type WeatherSource = Pick<OpenMeteoClient, 'forecast' | 'marine'>;

const MINUTE_MS = 60_000;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  // One upstream refresh per place at a time: concurrent requests for a place that needs
  // refreshing wait for the same fetch instead of each calling Open-Meteo.
  private readonly inFlight = new Map<number, Promise<WeatherWeek>>();

  constructor(
    private readonly repository: WeatherRepository,
    @Inject(OpenMeteoClient) private readonly source: WeatherSource,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // docs/process/design.md, "Refresh policy": serve the stored week while it is complete and
  // younger than the refresh window; otherwise refresh, and if the refresh fails serve what
  // is stored, marked stale, rather than nothing.
  async getWeek(place: PlaceRow): Promise<WeatherWeek> {
    const now = this.clock();
    const dates = localWindow(place.timezone, now);
    const stored = await this.repository.getWindow(place.id, dates);

    if (this.isFresh(stored, now)) {
      this.logger.log(`place=${place.id} decision=fresh`);
      return this.week(stored, now, false);
    }

    const running = this.inFlight.get(place.id);
    if (running) return running;
    const refresh = this.refresh(place, dates, stored, now).finally(() =>
      this.inFlight.delete(place.id),
    );
    this.inFlight.set(place.id, refresh);
    return refresh;
  }

  private isFresh(rows: DailyForecastRow[], now: Date): boolean {
    if (rows.length < 7) return false;
    const oldest = Math.min(...rows.map((r) => Date.parse(r.fetchedAt)));
    return now.getTime() - oldest <= this.config.forecastTtlMinutes * MINUTE_MS;
  }

  private async refresh(
    place: PlaceRow,
    dates: string[],
    stored: DailyForecastRow[],
    now: Date,
  ): Promise<WeatherWeek> {
    const [forecast, marine] = await Promise.allSettled([
      this.source.forecast(place.latitude, place.longitude, place.timezone),
      this.source.marine(place.latitude, place.longitude, place.timezone),
    ]);

    if (forecast.status === 'rejected') {
      return this.fallBack(place, stored, now, errorText(forecast.reason));
    }

    if (marine.status === 'rejected') {
      this.logger.warn(
        `place=${place.id} marine failed, keeping stored waves: ${errorText(marine.reason)}`,
      );
    }
    await this.repository.saveRefresh(
      place.id,
      forecast.value,
      marine.status === 'fulfilled' ? marine.value : null,
      now.toISOString(),
      dates[0],
    );
    const refreshed = await this.repository.getWindow(place.id, dates);
    // A 200 answer that renewed none of our window's days is no better than no answer.
    if (!refreshed.some((d) => d.fetchedAt === now.toISOString())) {
      return this.fallBack(place, stored, now, 'no days in the window');
    }
    this.logger.log(`place=${place.id} decision=refreshed`);
    return this.week(refreshed, now, false);
  }

  private fallBack(
    place: PlaceRow,
    stored: DailyForecastRow[],
    now: Date,
    reason: string,
  ): WeatherWeek {
    if (stored.length === 0) {
      this.logger.warn(
        `place=${place.id} decision=failed nothing stored reason=${reason}`,
      );
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        'the weather service is unavailable and nothing is stored for this place',
      );
    }
    this.logger.warn(
      `place=${place.id} decision=stale rows=${stored.length} reason=${reason}`,
    );
    return this.week(stored, now, true);
  }

  private week(
    days: DailyForecastRow[],
    now: Date,
    stale: boolean,
  ): WeatherWeek {
    const oldest = Math.min(...days.map((d) => Date.parse(d.fetchedAt)));
    // The week's marine time is the oldest one, and null if any day was never fetched from
    // the sea: a day with no marine answer must read as "unavailable", not as "no sea here".
    const marineTimes = days.map((d) => d.marineFetchedAt);
    const marineFetchedAt = marineTimes.includes(null)
      ? null
      : (marineTimes as string[]).sort()[0];
    return {
      days,
      fetchedAt: new Date(oldest).toISOString(),
      ageMinutes: Math.floor((now.getTime() - oldest) / MINUTE_MS),
      stale,
      marineFetchedAt,
    };
  }
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
