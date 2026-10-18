import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { APP_CONFIG, AppConfig } from './config/config.js';
import { CommonModule } from './common/common.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { PlacesModule } from './places/places.module.js';
import { WeatherModule } from './weather/weather.module.js';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    DatabaseModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // Outside production the schema is written to schema.gql, which is committed so the
        // API can be read without running it. In production it stays in memory: a read-only
        // filesystem must not stop the service from starting.
        autoSchemaFile:
          config.nodeEnv === 'production'
            ? true
            : join(process.cwd(), 'schema.gql'),
        sortSchema: true,
      }),
    }),
    HealthModule,
    PlacesModule,
    WeatherModule,
  ],
})
export class AppModule {}
