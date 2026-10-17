import { Router } from 'express';
import type { PoolClient } from 'pg';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { query, queryOne, tx } from '../db';
import { newCheckinCode } from '../lib/codes';
import { badRequest, conflict, notFound } from '../lib/errors';
import { idParam, intQuery, parse } from '../lib/http';
import { requireAuth, requireOfficer } from '../middleware/auth';

export const eventsRouter = Router();

// check-in opens this long before the start and closes this long after the end
const OPENS_BEFORE_MIN = 30;
const CLOSES_AFTER_MIN = 60;

const checkinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: config.isTest ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many tries. Wait a few minutes and try again.' } },
});

// $1 is always the viewer's id (or null when signed out)
const SELECT_EVENT = `
  select e.id, e.title, e.description, e.location,
         e.starts_at as "startsAt", e.ends_at as "endsAt", e.capacity,
         (select count(*)::int from rsvps r where r.event_id = e.id and r.status = 'going') as "goingCount",
         (select count(*)::int from rsvps r where r.event_id = e.id and r.status = 'waitlist') as "waitlistCount",
         (select count(*)::int from attendance a where a.event_id = e.id) as "attendedCount",
         (select r.status from rsvps r where r.event_id = e.id and r.user_id = $1::uuid) as "myStatus",
         exists (select 1 from attendance a where a.event_id = e.id and a.user_id = $1::uuid) as "checkedIn",
         (now() between e.starts_at - interval '${OPENS_BEFORE_MIN} minutes'
                    and e.ends_at + interval '${CLOSES_AFTER_MIN} minutes') as "checkinOpen"
  from events e`;

const EventBody = z.object({
  title: z.string().trim().min(1, 'Give the event a title.').max(120),
  description: z.string().trim().max(4000).default(''),
  location: z.string().trim().max(200).default(''),
  startsAt: z.iso.datetime({ offset: true, error: 'Enter a valid start time.' }),
  endsAt: z.iso.datetime({ offset: true, error: 'Enter a valid end time.' }),
  capacity: z
    .number()
    .int()
    .min(1, 'Capacity must be at least 1.')
    .max(5000)
    .nullable()
    .default(null),
});

function assertOrder(startsAt: string, endsAt: string) {
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw badRequest('The event has to end after it starts.', {
      endsAt: 'The event has to end after it starts.',
    });
  }
}

async function promoteWaitlist(c: PoolClient, eventId: string) {
  const { rows } = await c.query(
    `select capacity,
            (select count(*)::int from rsvps where event_id = $1 and status = 'going') as going
     from events where id = $1`,
    [eventId],
  );
  const ev = rows[0];
  if (!ev) return;
  const slots = ev.capacity == null ? null : Math.max(0, ev.capacity - ev.going);
  if (slots === 0) return;
  // limit null means no limit, which is what we want for an uncapped event
  await c.query(
    `update rsvps set status = 'going'
     where (event_id, user_id) in (
       select event_id, user_id from rsvps
       where event_id = $1 and status = 'waitlist'
       order by created_at asc
       limit $2
     )`,
    [eventId, slots],
  );
}

eventsRouter.get('/', async (req, res) => {
  const when = ['upcoming', 'past', 'all'].includes(String(req.query.when))
    ? String(req.query.when)
    : 'upcoming';
  const limit = intQuery(req.query.limit, 50, 1, 200);

  const where =
    when === 'upcoming' ? 'where e.ends_at >= now()' : when === 'past' ? 'where e.ends_at < now()' : '';
  const order = when === 'past' ? 'order by e.starts_at desc' : 'order by e.starts_at asc';

  const events = await query(`${SELECT_EVENT} ${where} ${order} limit $2`, [
    req.user?.id ?? null,
    limit,
  ]);
  res.json({ events });
});

eventsRouter.get('/:id', async (req, res) => {
  const id = idParam(req);
  const event = await queryOne(`${SELECT_EVENT} where e.id = $2`, [req.user?.id ?? null, id]);
  if (!event) throw notFound('Event not found.');

  if (req.user?.role === 'officer') {
    const row = await queryOne('select checkin_code as code from events where id = $1', [id]);
    event.checkinCode = row?.code;
  }
  res.json({ event });
});

eventsRouter.post('/', requireOfficer, async (req, res) => {
  const body = parse(EventBody, req.body);
  assertOrder(body.startsAt, body.endsAt);

  const created = await queryOne(
    `insert into events (title, description, location, starts_at, ends_at, capacity, checkin_code, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      body.title,
      body.description,
      body.location,
      body.startsAt,
      body.endsAt,
      body.capacity,
      newCheckinCode(),
      req.user!.id,
    ],
  );
  const event = await queryOne(`${SELECT_EVENT} where e.id = $2`, [req.user!.id, created.id]);
  res.status(201).json({ event });
});

eventsRouter.patch('/:id', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const patch = parse(EventBody.partial(), req.body);
  // partial() keeps the defaults, so only trust keys the client really sent
  const sent = (k: string) => Object.prototype.hasOwnProperty.call(req.body ?? {}, k);

  await tx(async (c) => {
    const { rows } = await c.query(
      'select title, description, location, starts_at, ends_at, capacity from events where id = $1 for update',
      [id],
    );
    const cur = rows[0];
    if (!cur) throw notFound('Event not found.');

    const next = {
      title: sent('title') ? patch.title! : cur.title,
      description: sent('description') ? patch.description! : cur.description,
      location: sent('location') ? patch.location! : cur.location,
      startsAt: sent('startsAt') ? patch.startsAt! : cur.starts_at.toISOString(),
      endsAt: sent('endsAt') ? patch.endsAt! : cur.ends_at.toISOString(),
      capacity: sent('capacity') ? (patch.capacity ?? null) : cur.capacity,
    };
    assertOrder(next.startsAt, next.endsAt);

    await c.query(
      `update events set title = $2, description = $3, location = $4,
         starts_at = $5, ends_at = $6, capacity = $7, updated_at = now()
       where id = $1`,
      [id, next.title, next.description, next.location, next.startsAt, next.endsAt, next.capacity],
    );
    // more room now? let people off the waitlist in
    await promoteWaitlist(c, id);
  });

  const event = await queryOne(`${SELECT_EVENT} where e.id = $2`, [req.user!.id, id]);
  res.json({ event });
});

eventsRouter.delete('/:id', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const row = await queryOne('delete from events where id = $1 returning id', [id]);
  if (!row) throw notFound('Event not found.');
  res.status(204).end();
});

// ---- RSVP ----

eventsRouter.put('/:id/rsvp', requireAuth, async (req, res) => {
  const id = idParam(req);
  const userId = req.user!.id;

  const status = await tx(async (c) => {
    // lock the event row so two people grabbing the last spot can't both get it
    const { rows } = await c.query(
      'select capacity, ends_at < now() as ended from events where id = $1 for update',
      [id],
    );
    const ev = rows[0];
    if (!ev) throw notFound('Event not found.');

    const existing = await c.query(
      'select status from rsvps where event_id = $1 and user_id = $2',
      [id, userId],
    );
    if (existing.rows[0]) return existing.rows[0].status as string;

    if (ev.ended) throw conflict('This event has already ended.');

    const { rows: counts } = await c.query(
      `select count(*)::int as going from rsvps where event_id = $1 and status = 'going'`,
      [id],
    );
    const next = ev.capacity == null || counts[0].going < ev.capacity ? 'going' : 'waitlist';
    await c.query('insert into rsvps (event_id, user_id, status) values ($1, $2, $3)', [
      id,
      userId,
      next,
    ]);
    return next;
  });

  res.json({ status });
});

eventsRouter.delete('/:id/rsvp', requireAuth, async (req, res) => {
  const id = idParam(req);
  await tx(async (c) => {
    const lock = await c.query('select 1 from events where id = $1 for update', [id]);
    if (!lock.rows[0]) throw notFound('Event not found.');

    const removed = await c.query(
      'delete from rsvps where event_id = $1 and user_id = $2 returning status',
      [id, req.user!.id],
    );
    if (removed.rows[0]?.status === 'going') await promoteWaitlist(c, id);
  });
  res.json({ status: null });
});

// ---- check-in ----

eventsRouter.post('/:id/checkin', requireAuth, checkinLimiter, async (req, res) => {
  const id = idParam(req);
  const { code } = parse(z.object({ code: z.string().trim().min(1, 'Enter the check-in code.') }), req.body);

  const ev = await queryOne(
    `select checkin_code,
            (now() between starts_at - interval '${OPENS_BEFORE_MIN} minutes'
                       and ends_at + interval '${CLOSES_AFTER_MIN} minutes') as open
     from events where id = $1`,
    [id],
  );
  if (!ev) throw notFound('Event not found.');
  if (!ev.open) throw conflict("Check-in isn't open for this event right now.");

  if (code.toUpperCase() !== ev.checkin_code) {
    throw badRequest("That code doesn't match.", { code: "That code doesn't match. Check the screen and try again." });
  }

  await query(
    `insert into attendance (event_id, user_id, method) values ($1, $2, 'code')
     on conflict do nothing`,
    [id, req.user!.id],
  );
  res.json({ checkedIn: true });
});

// ---- officer tools ----

eventsRouter.get('/:id/roster', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const exists = await queryOne('select 1 as ok from events where id = $1', [id]);
  if (!exists) throw notFound('Event not found.');

  const roster = await query(
    `select u.id, u.name, u.email,
            r.status as "rsvpStatus",
            a.checked_in_at as "checkedInAt",
            a.method as "checkInMethod"
     from users u
     left join rsvps r on r.user_id = u.id and r.event_id = $1
     left join attendance a on a.user_id = u.id and a.event_id = $1
     where r.user_id is not null or a.user_id is not null
     order by (a.user_id is null), u.name`,
    [id],
  );
  res.json({ roster });
});

eventsRouter.put('/:id/attendance/:userId', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const userId = idParam(req, 'userId');

  const ev = await queryOne('select 1 as ok from events where id = $1', [id]);
  if (!ev) throw notFound('Event not found.');
  const user = await queryOne('select 1 as ok from users where id = $1', [userId]);
  if (!user) throw notFound('No such member.');

  await query(
    `insert into attendance (event_id, user_id, method) values ($1, $2, 'officer')
     on conflict do nothing`,
    [id, userId],
  );
  res.json({ checkedIn: true });
});

eventsRouter.delete('/:id/attendance/:userId', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const userId = idParam(req, 'userId');
  await query('delete from attendance where event_id = $1 and user_id = $2', [id, userId]);
  res.json({ checkedIn: false });
});

eventsRouter.post('/:id/checkin-code', requireOfficer, async (req, res) => {
  const id = idParam(req);
  const row = await queryOne(
    'update events set checkin_code = $2, updated_at = now() where id = $1 returning checkin_code as code',
    [id, newCheckinCode()],
  );
  if (!row) throw notFound('Event not found.');
  res.json({ code: row.code });
});
