import type { RequestHandler } from 'express';
import { config } from '../config';
import { forbidden } from '../lib/errors';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Cookies are SameSite=Lax already, this is a second lock: browsers always send
// Origin on cross-site writes, so anything that isn't our web app gets bounced.
// Requests without an Origin header (curl, tests, server to server) pass through.
export const originGuard: RequestHandler = (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !config.webOrigins.includes(origin)) {
    return next(forbidden('Cross-origin request blocked.'));
  }
  next();
};
