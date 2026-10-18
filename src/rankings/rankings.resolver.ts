import { Args, Query, Resolver } from '@nestjs/graphql';
import { RankingsService } from './rankings.service.js';
import { ActivityRankings } from './rankings.types.js';

@Resolver(() => ActivityRankings)
export class RankingsResolver {
  constructor(private readonly rankings: RankingsService) {}

  @Query(() => ActivityRankings, {
    description:
      'How good each of the next 7 days is for skiing, surfing, outdoor and indoor sightseeing in a city.',
  })
  activityRankings(
    @Args('city', { description: 'a city or town, e.g. "Chamonix"' })
    city: string,
    @Args('countryCode', {
      nullable: true,
      description:
        'ISO 3166-1 alpha-2 to pick among places with the same name, e.g. "US"',
    })
    countryCode?: string,
  ): Promise<ActivityRankings> {
    return this.rankings.rank(city, countryCode ?? undefined);
  }
}
