import { resolve } from 'node:path';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

/**
 * `:memory:` is passed through untouched (used by the test suite); every other
 * value resolves against the api/ package root so `npm start` behaves the same
 * regardless of which directory it was invoked from.
 */
function resolveDbPath(raw: string): string {
  return raw === ':memory:' ? raw : resolve(PACKAGE_ROOT, raw);
}

export const config = {
  port: Number(env('PORT', '4000')),
  dbPath: resolveDbPath(env('DB_PATH', 'data/app.sqlite')),

  /** Built SPA, served by this same process in production. */
  webDist: resolve(PACKAGE_ROOT, '..', 'web', 'dist'),

  auth: {
    username: env('AUTH_USERNAME', 'supervisor'),
    password: env('AUTH_PASSWORD', 'inspect123'),
    jwtSecret: env('JWT_SECRET', 'dev-only-secret-change-me'),
    expiresIn: env('JWT_EXPIRES_IN', '12h'),
  },

  sap: {
    /**
     * Empty by default, which leaves POST /api/sap-webhook open so it can be
     * called with nothing but a JSON body -- the endpoint the brief describes.
     * Setting SAP_WEBHOOK_SECRET requires a matching X-SAP-Secret header, which
     * is what a real deployment would do.
     */
    webhookSecret: env('SAP_WEBHOOK_SECRET', ''),
  },

  isTest: process.env.NODE_ENV === 'test',
} as const;
