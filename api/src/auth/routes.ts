import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.ts';
import { loginSchema } from '../domain/schemas.ts';
import { ApiError } from '../middleware/errors.ts';
import { ok } from '../lib/respond.ts';
import { signToken } from './requireAuth.ts';

/**
 * Single operator account, configured by environment variable -- the brief asks
 * for "basic authentication, keep it simple", and a users table with roles and
 * a signup flow would be inventing requirements.
 *
 * The configured password is hashed once at boot and only ever compared through
 * bcrypt, so the comparison is constant-time and no plaintext lives in memory
 * past startup. A real deployment would ship the *hash* in the environment and
 * skip this step; that is the one line that would change.
 */
export function createAuthRoutes(): Router {
  const router = Router();
  const passwordHash = bcrypt.hashSync(config.auth.password, 10);

  router.post('/login', async (req, res) => {
    const { username, password } = loginSchema.parse(req.body ?? {});

    const usernameMatches = username.toLowerCase() === config.auth.username.toLowerCase();
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    // One message for both failure modes: revealing which half was wrong turns
    // the login form into a username oracle.
    if (!usernameMatches || !passwordMatches) {
      throw ApiError.unauthorized('Incorrect username or password');
    }

    const user = { username: config.auth.username };
    ok(res, { token: signToken(user), user });
  });

  return router;
}
