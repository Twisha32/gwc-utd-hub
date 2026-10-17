import { Router } from 'express';
import { query, queryOne } from '../db';
import { requireOfficer } from '../middleware/auth';

export const statsRouter = Router();

statsRouter.get('/', requireOfficer, async (_req, res) => {
  const totals = await queryOne(
    `select
       (select count(*)::int from users) as members,
       (select count(*)::int from users where created_at > now() - interval '30 days') as "newMembers",
       (select count(*)::int from events where ends_at >= now()) as "upcomingEvents",
       (select count(*)::int from events where ends_at < now()) as "pastEvents",
       (select count(*)::int from ctf_challenges where published) as "challenges",
       (select count(*)::int from ctf_solves) as "solves",
       (select count(distinct user_id)::int from ctf_solves) as "solvers"`,
  );

  // last few finished events: how many said they'd come vs how many did
  const recent = await query(
    `select e.id, e.title, e.starts_at as "startsAt",
            (select count(*)::int from rsvps r where r.event_id = e.id and r.status = 'going') as "rsvps",
            (select count(*)::int from attendance a where a.event_id = e.id) as "attended"
     from events e
     where e.ends_at < now()
     order by e.starts_at desc
     limit 8`,
  );

  res.json({ totals, recentEvents: recent.reverse() });
});
