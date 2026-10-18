import { Query, Resolver } from '@nestjs/graphql';

// Code-first GraphQL refuses a schema without a Query type, so this placeholder
// holds the endpoint up until the first real query lands.
@Resolver()
export class HealthResolver {
  @Query(() => String, { description: 'Liveness probe over GraphQL.' })
  ping(): string {
    return 'pong';
  }
}
