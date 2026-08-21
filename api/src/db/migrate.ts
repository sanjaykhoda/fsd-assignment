import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Db } from './client.ts';

const SCHEMA_VERSION = 1;

/**
 * There is no migration runner here on purpose: two tables, one developer, and
 * a 72-hour window. The DDL is fully idempotent, so replaying it on every boot
 * is both the install path and the upgrade path. `user_version` is stamped to
 * leave a hook for a real migration chain if this ever outgrows that.
 */
export function migrate(db: Db): void {
  const schema = readFileSync(resolve(import.meta.dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
