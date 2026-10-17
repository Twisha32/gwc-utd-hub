import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { queryOne } from '../db';
import { forbidden, unauthorized } from '../lib/errors';

export const SESSION_COOKIE = 'gwc_session';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'officer';
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function startSession(res: Response, userId: string) {
  const token = jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: '7d' });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: WEEK_MS,
    path: '/',
  });
}

export function endSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  });
}

// Reads the cookie if there is one. Never rejects, use requireAuth for that.
// The role comes from the database on every request so demoting an officer
// takes effect right away instead of whenever their token expires.
export const loadUser: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) return next();
    const user = await queryOne<SessionUser>(
      'select id, email, name, role from users where id = $1',
      [payload.sub],
    );
    if (user) req.user = user;
  } catch {
    // expired or tampered token, treat as signed out
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

export const requireOfficer: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'officer') return next(forbidden('Officers only.'));
  next();
};
