import { ApiError } from '../middleware/errors.ts';

/**
 * Route params are strings. Anything non-numeric can never match a row, so it
 * is a 404 rather than a 422 -- `/api/inspections/banana` is a missing
 * resource, not a malformed request body.
 */
export function parseIdParam(raw: string | undefined, resource: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.notFound(resource);
  return id;
}
