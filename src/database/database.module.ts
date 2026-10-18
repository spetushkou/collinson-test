import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/config.js';
import { createDb, DRIZZLE, runMigrations } from './database.js';

// Migrations run before the provider resolves, so nothing can query an unmigrated database
// and a reviewer never runs a migration command by hand.
@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => {
        const db = createDb(config.dbUrl);
        await runMigrations(db);
        return db;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
