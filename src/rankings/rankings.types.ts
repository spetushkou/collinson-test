import {
  Field,
  Float,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

export enum ActivityType {
  SKIING = 'SKIING',
  SURFING = 'SURFING',
  OUTDOOR_SIGHTSEEING = 'OUTDOOR_SIGHTSEEING',
  INDOOR_SIGHTSEEING = 'INDOOR_SIGHTSEEING',
}

registerEnumType(ActivityType, { name: 'Activity' });

@ObjectType({
  description:
    'What the city name resolved to - check it is the place you meant.',
})
export class Location {
  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  admin1: string | null;

  @Field()
  country: string;

  @Field({ description: 'ISO 3166-1 alpha-2, e.g. "FR"' })
  countryCode: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => Float, { description: 'metres' })
  elevation: number;

  @Field({ description: "IANA timezone; the days are this zone's days" })
  timezone: string;
}

@ObjectType({
  description: 'How old the stored forecast behind the scores is.',
})
export class ForecastMeta {
  @Field({ description: 'ISO 8601, when the oldest day was fetched' })
  fetchedAt: string;

  @Field(() => Int)
  ageMinutes: number;

  @Field({
    description: 'true when a refresh failed and stored data is served',
  })
  stale: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'oldest marine fetch in the week; null if any day was never fetched',
  })
  marineFetchedAt: string | null;

  @Field()
  source: string;
}

@ObjectType({ description: 'One rule that contributed to a score.' })
export class Factor {
  @Field()
  name: string;

  @Field({ description: 'the measured value, with its unit and label' })
  value: string;

  @Field(() => Int)
  points: number;
}

@ObjectType()
export class DayScore {
  @Field({ description: 'YYYY-MM-DD, local to the location' })
  date: string;

  @Field(() => Int, { description: '1 is the best day for this activity' })
  rank: number;

  @Field(() => Int, { description: '0..100' })
  score: number;

  @Field(() => [Factor])
  factors: Factor[];
}

@ObjectType()
export class ActivityRanking {
  @Field(() => ActivityType)
  activity: ActivityType;

  @Field({
    description: 'false when there is no data to judge this activity here',
  })
  applicable: boolean;

  @Field(() => String, { nullable: true })
  reason: string | null;

  @Field(() => [DayScore], {
    description: 'best first; empty when not applicable',
  })
  days: DayScore[];
}

@ObjectType()
export class ActivityRankings {
  @Field(() => Location)
  location: Location;

  @Field(() => ForecastMeta)
  forecast: ForecastMeta;

  @Field(() => [ActivityRanking], {
    description:
      'in a fixed order; scores compare days within an activity, not across',
  })
  activities: ActivityRanking[];
}
