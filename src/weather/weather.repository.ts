import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, writeTransaction } from '../database/database.js';
import type { Db } from '../database/database.js';
import { dailyForecasts, DailyForecastRow } from '../database/schema.js';
import type { DailyForecast, DailyMarine } from '../open-meteo/types.js';

@Injectable()
export class WeatherRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  getWindow(placeId: number, dates: string[]): Promise<DailyForecastRow[]> {
    return this.db
      .select()
      .from(dailyForecasts)
      .where(
        and(
          eq(dailyForecasts.placeId, placeId),
          inArray(dailyForecasts.date, dates),
        ),
      )
      .orderBy(asc(dailyForecasts.date));
  }

  // One row per place per local day, replaced on every refresh: a forecast is rewritten
  // upstream every few hours, so there is nothing to keep but the latest answer and when it
  // came. The wave columns are written only when the marine call succeeded, so a marine
  // outage leaves the last good waves in place.
  async saveRefresh(
    placeId: number,
    forecast: DailyForecast[],
    marine: DailyMarine[] | null,
    fetchedAt: string,
  ): Promise<void> {
    await writeTransaction(this.db, async (tx) => {
      for (const { date, ...weather } of forecast) {
        await tx
          .insert(dailyForecasts)
          .values({ placeId, date, fetchedAt, ...weather })
          .onConflictDoUpdate({
            target: [dailyForecasts.placeId, dailyForecasts.date],
            set: { fetchedAt, ...weather },
          });
      }
      for (const { date, ...waves } of marine ?? []) {
        await tx
          .update(dailyForecasts)
          .set({ ...waves, marineFetchedAt: fetchedAt })
          .where(
            and(
              eq(dailyForecasts.placeId, placeId),
              eq(dailyForecasts.date, date),
            ),
          );
      }
    });
  }
}
