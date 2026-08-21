import type { Response } from 'express';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Every successful response is `{ data, meta? }` and every failure is
 * `{ error }` (see middleware/errors.ts). Key presence -- not a redundant
 * `success` boolean that just restates the HTTP status -- is what the client
 * discriminates on, which makes the whole API one TS union type.
 */
export function ok<T>(res: Response, data: T, meta?: PageMeta): Response {
  return res.status(200).json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T, location?: string): Response {
  if (location) res.setHeader('Location', location);
  return res.status(201).json({ data });
}

export function noContent(res: Response): Response {
  return res.status(204).end();
}
