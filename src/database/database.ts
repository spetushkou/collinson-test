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

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const writeQueues = new WeakMap<Db, Promise<unknown>>();

// Every write goes through here. The libsql driver is synchronous and gives each
// transaction its own pooled connection, so two overlapping write transactions deadlock
// the one JavaScript thread: the second blocks on SQLite's lock while the first can never
// reach its commit, and it ends in SQLITE_BUSY. A busy timeout cannot help inside one
// process, so writes are queued instead - one at a time, each in its own transaction.
export function writeTransaction<T>(
  db: Db,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(db) ?? Promise.resolve();
  const run = previous.then(() => db.transaction(work));
  writeQueues.set(
    db,
    run.catch(() => undefined),
  );
  return run;
}

export async function runMigrations(db: Db): Promise<void> {
  // WAL lets reads go on while a refresh writes. It is a property of the file, so setting
  // it once at boot covers every connection.
  await db.$client.execute('PRAGMA journal_mode = WAL');
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
