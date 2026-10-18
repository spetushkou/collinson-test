import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.js';

export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

export const DRIZZLE = Symbol('DRIZZLE');

// Resolved from this file, not the working directory: src/database/ in tests and
// dist/database/ at runtime are both two levels below the repo root that holds drizzle/.
const MIGRATIONS_FOLDER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'drizzle',
);

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
