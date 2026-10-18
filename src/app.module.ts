import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Outside production the schema is written to schema.gql, which is committed so the API
      // can be read without running it. In production it stays in memory: a read-only
      // filesystem must not stop the service from starting.
      autoSchemaFile:
        process.env.NODE_ENV === 'production'
          ? true
          : join(process.cwd(), 'schema.gql'),
      sortSchema: true,
    }),
    HealthModule,
  ],
})
export class AppModule {}
