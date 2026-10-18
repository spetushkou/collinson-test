import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.js';

export type Db = LibSQLDatabase<typeof schema>;

export const DRIZZLE = Symbol('DRIZZLE');

const MIGRATIONS_FOLDER = join(process.cwd(), 'drizzle');

export function createDb(url: string): Db {
  if (url.startsWith('file:')) {
    // libsql creates the file but not its directory.
    mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
  }
  return drizzle({ connection: { url }, schema });
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
