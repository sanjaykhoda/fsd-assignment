import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import type { Db } from './db/client.ts';
import { createAuthRoutes } from './auth/routes.ts';
import { requireAuth } from './auth/requireAuth.ts';
import { createDefectTypeRepository } from './defect-types/repository.ts';
import { createDefectTypeRoutes } from './defect-types/routes.ts';
import { createInspectionRepository } from './inspections/repository.ts';
import { createInspectionRoutes } from './inspections/routes.ts';
import { createSapRoutes } from './sap/routes.ts';
import { errorHandler, notFoundHandler } from './middleware/errors.ts';
import { ok } from './lib/respond.ts';

export interface AppOptions {
  /** Overrides config.sap.webhookSecret. Empty leaves the webhook open. */
  sapSecret?: string;
}

/**
 * Takes the database as an argument rather than importing a singleton, so the
 * test suite can hand in an in-memory database and run fully isolated.
 */
export function createApp(db: Db, options: AppOptions = {}): Express {
  const app = express();
  const inspections = createInspectionRepository(db);
  const defectTypes = createDefectTypeRepository(db);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));

  // --- Open endpoints -------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    ok(res, { status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });
  app.use('/api/auth', createAuthRoutes());

  // Not behind the user session: SAP is a machine caller with no way to log in.
  // Open by default; set SAP_WEBHOOK_SECRET to require an X-SAP-Secret header.
  app.use('/api', createSapRoutes({ inspections, defectTypes, secret: options.sapSecret }));

  // --- Authenticated endpoints ---------------------------------------------
  app.use('/api/inspections', requireAuth, createInspectionRoutes({ inspections, defectTypes }));
  app.use('/api/defect-types', requireAuth, createDefectTypeRoutes(defectTypes));

  // --- Static SPA -----------------------------------------------------------
  // Registered after the API so a built index.html can never shadow a route.
  // In dev this directory does not exist; Vite serves the app instead.
  if (existsSync(config.webDist)) {
    app.use(express.static(config.webDist));

    // Client-side routing: a hard refresh on /inspections/3 must return the
    // app shell. Scoped away from /api so an unknown endpoint still answers
    // with JSON -- an API 404 that returns HTML is a miserable thing to debug.
    app.get('/*splat', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(join(config.webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
