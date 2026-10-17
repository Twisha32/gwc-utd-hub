import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { queryOne } from '../db';
import { badRequest, conflict, unauthorized } from '../lib/errors';
import { parse } from '../lib/http';
import { endSession, startSession } from '../middleware/auth';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Wait a few minutes and try again.' } },
});

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'));

const RegisterBody = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email,
  // bcrypt only looks at the first 72 bytes
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
  joinCode: z.string().trim().optional(),
});

const LoginBody = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

// compared against when the email doesn't exist so response time doesn't
// reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

export function publicUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    major: row.major ?? null,
    gradYear: row.grad_year ?? null,
    createdAt: row.created_at,
  };
}

authRouter.post('/register', limiter, async (req, res) => {
  const body = parse(RegisterBody, req.body);

  if (config.allowedEmailDomains.length > 0) {
    const domain = body.email.split('@')[1];
    if (!config.allowedEmailDomains.includes(domain)) {
      const list = config.allowedEmailDomains.map((d) => `@${d}`).join(' or ');
      throw badRequest(`Sign up with your ${list} email.`, {
        email: `Sign up with your ${list} email.`,
      });
    }
  }

  if (config.joinCode && (body.joinCode ?? '').toLowerCase() !== config.joinCode.toLowerCase()) {
    throw badRequest('That join code is not right.', {
      joinCode: 'That join code is not right. Ask an officer for the current one.',
    });
  }

  const role = config.officerEmails.includes(body.email) ? 'officer' : 'member';
  const hash = await bcrypt.hash(body.password, config.bcryptRounds);

  try {
    const row = await queryOne(
      `insert into users (email, name, password_hash, role)
       values ($1, $2, $3, $4) returning *`,
      [body.email, body.name, hash, role],
    );
    startSession(res, row.id);
    res.status(201).json({ user: publicUser(row) });
  } catch (err: any) {
    if (err.code === '23505') {
      throw conflict('An account with that email already exists.', {
        email: 'An account with that email already exists.',
      });
    }
    throw err;
  }
});

authRouter.post('/login', limiter, async (req, res) => {
  const body = parse(LoginBody, req.body);
  const row = await queryOne('select * from users where lower(email) = $1', [body.email]);

  const ok = await bcrypt.compare(body.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw unauthorized('Incorrect email or password.');

  startSession(res, row.id);
  res.json({ user: publicUser(row) });
});

authRouter.post('/logout', (_req, res) => {
  endSession(res);
  res.status(204).end();
});

// signed out is a normal answer here, not an error, so public pages can ask
// "who is this?" without a 401 landing in the browser console
authRouter.get('/me', async (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const row = await queryOne('select * from users where id = $1', [req.user.id]);
  res.json({ user: publicUser(row) });
});
