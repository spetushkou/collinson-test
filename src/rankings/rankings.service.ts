import { Inject, Injectable } from '@nestjs/common';
import { PlacesService } from '../places/places.service.js';
import { ACTIVITIES } from '../scoring/activities.js';
import { rankDays } from '../scoring/rank.js';
import { WeatherService } from '../weather/weather.service.js';
import { ActivityRankings, ActivityType } from './rankings.types.js';

type PlaceResolver = Pick<PlacesService, 'resolve'>;
type WeatherSource = Pick<WeatherService, 'getWeek'>;

@Injectable()
export class RankingsService {
  constructor(
    @Inject(PlacesService) private readonly places: PlaceResolver,
    @Inject(WeatherService) private readonly weather: WeatherSource,
  ) {}

  async rank(city: string, countryCode?: string): Promise<ActivityRankings> {
    const place = await this.places.resolve(city, countryCode);
    const week = await this.weather.getWeek(place);
    const marineFetched = week.marineFetchedAt !== null;

    return {
      location: {
        name: place.name,
        admin1: place.admin1,
        country: place.country,
        countryCode: place.countryCode,
        latitude: place.latitude,
        longitude: place.longitude,
        elevation: place.elevation,
        timezone: place.timezone,
      },
      forecast: {
        fetchedAt: week.fetchedAt,
        ageMinutes: week.ageMinutes,
        stale: week.stale,
        marineFetchedAt: week.marineFetchedAt,
        source: 'open-meteo',
      },
      activities: ACTIVITIES.map((rules) => {
        const { applicable, reason } = rules.applicability(
          week.days,
          marineFetched,
        );
        return {
          activity: rules.activity as ActivityType,
          applicable,
          reason: reason ?? null,
          days: applicable
            ? rankDays(
                week.days.map((day) => ({
                  date: day.date,
                  factors: rules.scoreDay(day),
                })),
              )
            : [],
        };
      }),
    };
  }
}
