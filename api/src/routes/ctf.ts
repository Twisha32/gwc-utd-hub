import { Router } from 'express';
import { z } from 'zod';
import { queryOne, query, tx } from '../db';
import { notFound, tooMany } from '../lib/errors';
import { flagMatches, hashFlag } from '../lib/flags';
import { idParam, parse } from '../lib/http';
import { requireAuth, requireOfficer } from '../middleware/auth';

export const ctfRouter = Router();

export const CATEGORIES = ['web', 'crypto', 'forensics', 'reverse', 'osint', 'pwn', 'misc'] as const;

// submissions per user per minute, across all challenges
const MAX_ATTEMPTS_PER_MINUTE = 8;

const ChallengeBody = z.object({
  title: z.string().trim().min(1, 'Give the challenge a title.').max(100),
  category: z.enum(CATEGORIES, { error: 'Pick a category.' }),
  description: z.string().trim().min(1, 'Add a description.').max(6000),
  points: z.number().int().min(1, 'Points must be at least 1.').max(2000),
  flag: z.string().trim().min(3, 'The flag needs at least 3 characters.').max(200),
  hint: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  published: z.boolean().default(false),
});

// $1 = viewer id. Officers can see drafts, everyone else only published.
const SELECT_CHALLENGE = `
  select c.id, c.title, c.category, c.description, c.points, c.hint, c.published,
         (select count(*)::int from ctf_solves s where s.challenge_id = c.id) as "solveCount",
         (select s.solved_at from ctf_solves s where s.challenge_id = c.id and s.user_id = $1::uuid) as "solvedAt"
  from ctf_challenges c`;

ctfRouter.get('/challenges', requireAuth, async (req, res) => {
  const isOfficer = req.user!.role === 'officer';
  const where = isOfficer ? '' : 'where c.published';
  const rows = await query(
    `${SELECT_CHALLENGE} ${where} order by c.category, c.points, c.title`,
    [req.user!.id],
  );
  const challenges = rows.map((r) => ({ ...r, solved: r.solvedAt != null }));
  res.json({ challenges });
});

ctfRouter.post('/challenges/:id/submit', requireAuth, async (req, res) => {
  const id = idParam(req);
  const { flag } = parse(z.object({ flag: z.string().trim().min(1, 'Enter a flag.').max(300) }), req.body);
  const userId = req.user!.id;

  const challenge = await queryOne(
    'select id, points, flag_hash from ctf_challenges where id = $1 and published',
    [id],
  );
  if (!challenge) throw notFound('Challenge not found.');

  const already = await queryOne(
    'select 1 as ok from ctf_solves where challenge_id = $1 and user_id = $2',
    [id, userId],
  );
  if (already) {
    res.json({ correct: true, alreadySolved: true, points: challenge.points });
    return;
  }

  const recent = await queryOne(
    `select count(*)::int as n from ctf_attempts
     where user_id = $1 and created_at > now() - interval '1 minute'`,
    [userId],
  );
  if (recent.n >= MAX_ATTEMPTS_PER_MINUTE) {
    throw tooMany('Slow down, you can submit about 8 flags a minute.');
  }

  const correct = flagMatches(flag, challenge.flag_hash);
  await query('insert into ctf_attempts (challenge_id, user_id, correct) values ($1, $2, $3)', [
    id,
    userId,
    correct,
  ]);

  if (!correct) {
    res.json({ correct: false });
    return;
  }

  const firstBlood = await tx(async (c) => {
    await c.query(
      'insert into ctf_solves (challenge_id, user_id) values ($1, $2) on conflict do nothing',
      [id, userId],
    );
    const { rows } = await c.query(
      'select count(*)::int as n from ctf_solves where challenge_id = $1',
      [id],
    );
    return rows[0].n === 1;
  });

  res.json({ correct: true, points: challenge.points, firstBlood });
});

// Officers play too but aren't ranked, they wrote the challenges.
ctfRouter.get('/leaderboard', requireAuth, async (req, res) => {
  const rows = await query(
    `select u.id, u.name,
            sum(c.points)::int as points,
            count(*)::int as solves,
            max(s.solved_at) as "lastSolveAt"
     from ctf_solves s
     join ctf_challenges c on c.id = s.challenge_id and c.published
     join users u on u.id = s.user_id and u.role = 'member'
     group by u.id, u.name
     order by points desc, "lastSolveAt" asc, u.name asc
     limit 200`,
  );
  const board = rows.map((r, i) => ({ rank: i + 1, ...r, isMe: r.id === req.user!.id }));
  res.json({ leaderboard: board });
});

// ---- officer CRUD ----

ctfRouter.post('/challenges', requireOfficer, async (req, res) => {
  const body = parse(ChallengeBody, req.body);
  const row = await queryOne(
    `insert into ctf_challenges (title, category, description, points, flag_hash, hint, published)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      body.title,
      body.category,
      body.description,
      body.points,
      hashFlag(body.flag),
      body.hint ?? null,
      body.published,
    ],
  );
  const challenge = await queryOne(`${SELECT_CHALLENGE} where c.id = $2`, [req.user!.id, row.id]);
  res.status(201).json({ challenge: { ...challenge, solved: false } });
});

ctfRouter.patch('/challenges/:id', requireOfficer, async (req, res) => {
  const id = idParam(req);
  // flag is optional on edit: leaving it out keeps the current one
  const body = parse(ChallengeBody.partial({ flag: true, published: true }), req.body);

  const row = await queryOne(
    `update ctf_challenges set
       title = $2, category = $3, description = $4, points = $5,
       flag_hash = coalesce($6, flag_hash), hint = $7, published = coalesce($8, published)
     where id = $1 returning id`,
    [
      id,
      body.title,
      body.category,
      body.description,
      body.points,
      body.flag ? hashFlag(body.flag) : null,
      body.hint ?? null,
      req.body?.published === undefined ? null : body.published,
    ],
  );
  if (!row) throw notFound('Challenge not found.');
  const challenge = await queryOne(`${SELECT_CHALLENGE} where c.id = $2`, [req.user!.id, id]);
  res.json({ challenge: { ...challenge, solved: challenge.solvedAt != null } });
});

ctfRouter.put('/challenges/:id/published', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const { published } = parse(z.object({ published: z.boolean() }), req.body);
  const row = await queryOne(
    'update ctf_challenges set published = $2 where id = $1 returning id, published',
    [id, published],
  );
  if (!row) throw notFound('Challenge not found.');
  res.json({ challenge: row });
});

ctfRouter.delete('/challenges/:id', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const row = await queryOne('delete from ctf_challenges where id = $1 returning id', [id]);
  if (!row) throw notFound('Challenge not found.');
  res.status(204).end();
});
