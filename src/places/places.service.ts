import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import { CLOCK } from '../common/clock.js';
import type { Clock } from '../common/clock.js';
import { AppError } from '../common/errors.js';
import { DRIZZLE } from '../database/database.js';
import type { Db } from '../database/database.js';
import { placeLookups, places, PlaceRow } from '../database/schema.js';
import { OpenMeteoClient } from '../open-meteo/open-meteo.client.js';
import { UpstreamError } from '../open-meteo/types.js';

// A place does not move, so a resolved name is reused for a month before asking again.
const LOOKUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normaliseQuery(city: string): string {
  return city.trim().replace(/\s+/g, ' ').toLowerCase();
}

type Geocoder = Pick<OpenMeteoClient, 'geocode'>;

@Injectable()
export class PlacesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(OpenMeteoClient) private readonly geocoder: Geocoder,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // "Paris" is the most populous Paris (France); a country code narrows it (Q2). The caller
  // sees which place it got, because the resolved row is always returned.
  async resolve(city: string, countryCode?: string): Promise<PlaceRow> {
    const name = city.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      throw new AppError(
        'BAD_USER_INPUT',
        'city must be at least 2 characters',
      );
    }
    if (countryCode !== undefined && !/^[A-Za-z]{2}$/.test(countryCode)) {
      throw new AppError(
        'BAD_USER_INPUT',
        'countryCode must be a 2-letter ISO code, such as "FR"',
      );
    }
    const code = countryCode?.toUpperCase() ?? '';
    const query = normaliseQuery(name);
    const now = this.clock();

    const fresh = await this.db
      .select({ place: places })
      .from(placeLookups)
      .innerJoin(places, eq(places.id, placeLookups.placeId))
      .where(
        and(
          eq(placeLookups.query, query),
          eq(placeLookups.countryCode, code),
          gte(
            placeLookups.fetchedAt,
            new Date(now.getTime() - LOOKUP_TTL_MS).toISOString(),
          ),
        ),
      )
      .get();
    if (fresh) return fresh.place;

    let hit;
    try {
      hit = await this.geocoder.geocode(name, code || undefined);
    } catch (error) {
      if (error instanceof UpstreamError) {
        throw new AppError('UPSTREAM_UNAVAILABLE', error.message);
      }
      throw error;
    }
    if (!hit) {
      throw new AppError(
        'PLACE_NOT_FOUND',
        code
          ? `no place called "${name}" in ${code}`
          : `no place called "${name}"`,
      );
    }

    const fetchedAt = now.toISOString();
    const row: PlaceRow = { ...hit, fetchedAt };
    await this.db.transaction(async (tx) => {
      await tx
        .insert(places)
        .values(row)
        .onConflictDoUpdate({ target: places.id, set: row });
      await tx
        .insert(placeLookups)
        .values({ query, countryCode: code, placeId: hit.id, fetchedAt })
        .onConflictDoUpdate({
          target: [placeLookups.query, placeLookups.countryCode],
          set: { placeId: hit.id, fetchedAt },
        });
    });
    return row;
  }
}
