import type { Express } from 'express';
import { createApp, type AppOptions } from '../app.ts';
import { config } from '../config.ts';
import { createDb, type Db } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { signToken } from '../auth/requireAuth.ts';

export interface TestContext {
  app: Express;
  db: Db;
  auth: Record<string, string>;
}

/**
 * A fresh in-memory database per suite: no fixture file to keep in sync, no
 * cross-test bleed, and nothing left on disk afterwards.
 */
export function createTestContext(options: AppOptions = {}): TestContext {
  const db = createDb(':memory:');
  migrate(db);

  return {
    app: createApp(db, options),
    db,
    auth: { Authorization: `Bearer ${signToken({ username: config.auth.username })}` },
  };
}

/** Looks up a seeded defect type id by code, so tests never hardcode row ids. */
export function defectTypeId(db: Db, code: string): number {
  return db.get<{ id: number }>('SELECT id FROM defect_types WHERE code = ?', [code])!.id;
}
