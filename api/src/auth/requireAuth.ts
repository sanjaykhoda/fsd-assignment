import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.ts';
import { ApiError } from '../middleware/errors.ts';

export interface AuthUser {
  username: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.auth.jwtSecret, {
    expiresIn: config.auth.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw ApiError.unauthorized('Missing bearer token');
  }

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret) as AuthUser;
    next();
  } catch {
    // Expired and tampered tokens are indistinguishable to the client on
    // purpose; both mean "log in again".
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  }
}
