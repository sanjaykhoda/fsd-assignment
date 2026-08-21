import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.ts';

/**
 * The only module in the codebase that imports a SQLite driver. Everything else
 * talks to the `Db` interface below, so swapping better-sqlite3 for Node's
 * built-in `node:sqlite` is a change to this file alone.
 */
export interface Db {
  all<T>(sql: string, params?: unknown[]): T[];
  get<T>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number };
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}

/**
 * better-sqlite3 is a native addon compiled against a specific Node ABI, so
 * switching Node versions without reinstalling throws a raw dlopen error deep
 * in the module loader. That is a confusing first experience for anyone setting
 * the project up, so it is translated into the actual fix here.
 */
function openDatabase(path: string): Database.Database {
  try {
    return new Database(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_DLOPEN_FAILED') {
      console.error(
        `
The native SQLite module was built for a different Node version than the` +
          `
one now running (${process.version}). Reinstall dependencies to fix it:
` +
          `
  rm -rf node_modules && npm install
` +
          `
(on Windows: rmdir /s /q node_modules && npm install)
`,
      );
      process.exit(1);
    }
    throw error;
  }
}

export function createDb(path: string = config.dbPath): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = openDatabase(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    all: <T>(sql: string, params: unknown[] = []) => db.prepare(sql).all(...params) as T[],
    get: <T>(sql: string, params: unknown[] = []) => db.prepare(sql).get(...params) as T | undefined,
    run: (sql, params = []) => {
      const result = db.prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
    },
    exec: (sql) => void db.exec(sql),
    transaction: <T>(fn: () => T) => db.transaction(fn)(),
    close: () => db.close(),
  };
}
