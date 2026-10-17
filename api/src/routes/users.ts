import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { idParam, intQuery, parse } from '../lib/http';
import { requireAuth, requireOfficer } from '../middleware/auth';
import { publicUser } from './auth';

export const usersRouter = Router();

const ProfileBody = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80).optional(),
  major: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  gradYear: z
    .number()
    .int()
    .min(2020, 'Enter a valid graduation year.')
    .max(2040, 'Enter a valid graduation year.')
    .nullable()
    .optional(),
});

usersRouter.patch('/me', requireAuth, async (req, res) => {
  const body = parse(ProfileBody, req.body);
  const row = await queryOne(
    `update users set
       name = coalesce($2, name),
       major = case when $3::boolean then $4 else major end,
       grad_year = case when $5::boolean then $6 else grad_year end
     where id = $1 returning *`,
    [
      req.user!.id,
      body.name ?? null,
      body.major !== undefined,
      body.major ?? null,
      body.gradYear !== undefined,
      body.gradYear ?? null,
    ],
  );
  res.json({ user: publicUser(row) });
});

// numbers for the profile page
usersRouter.get('/me/summary', requireAuth, async (req, res) => {
  const id = req.user!.id;
  const row = await queryOne(
    `select
       (select count(*)::int from attendance where user_id = $1) as attended,
       (select count(*)::int from rsvps r join events e on e.id = r.event_id
          where r.user_id = $1 and r.status = 'going' and e.ends_at >= now()) as "upcomingRsvps",
       (select coalesce(sum(c.points), 0)::int from ctf_solves s
          join ctf_challenges c on c.id = s.challenge_id
          where s.user_id = $1 and c.published) as "ctfPoints",
       (select count(*)::int from ctf_solves s
          join ctf_challenges c on c.id = s.challenge_id
          where s.user_id = $1 and c.published) as "ctfSolves"`,
    [id],
  );
  res.json({ summary: row });
});

// officers: find people to check in by hand or promote
usersRouter.get('/', requireOfficer, async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = intQuery(req.query.limit, 25, 1, 100);
  const rows = await query(
    `select id, name, email, role, major, grad_year as "gradYear", created_at as "createdAt"
     from users
     where $1 = '' or name ilike '%' || $1 || '%' or email ilike '%' || $1 || '%'
     order by created_at desc
     limit $2`,
    [q, limit],
  );
  res.json({ users: rows });
});

usersRouter.put('/:id/role', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const { role } = parse(z.object({ role: z.enum(['member', 'officer']) }), req.body);
  if (id === req.user!.id) throw badRequest("You can't change your own role.");

  const row = await queryOne(
    `update users set role = $2 where id = $1
     returning id, name, email, role`,
    [id, role],
  );
  if (!row) throw notFound('No such member.');
  res.json({ user: row });
});
