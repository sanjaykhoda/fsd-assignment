import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ALREADY_RESOLVED'
  | 'IN_USE'
  | 'DUPLICATE'
  | 'MALFORMED_JSON'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static notFound(resource = 'Resource'): ApiError {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static validation(message: string, details?: FieldError[]): ApiError {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static conflict(code: Extract<ErrorCode, 'ALREADY_RESOLVED' | 'IN_USE' | 'DUPLICATE'>, message: string): ApiError {
    return new ApiError(409, code, message);
  }
}

/** Flattens a ZodError into the `details[]` shape the web forms render inline. */
export function toFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: toFieldErrors(err),
      },
    });
    return;
  }

  // express.json() throws a SyntaxError for an unparseable body.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' },
    });
    return;
  }

  // Anything unhandled: log the detail server-side, return none of it.
  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
