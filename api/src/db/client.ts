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

export function createDb(path: string = config.dbPath): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
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
