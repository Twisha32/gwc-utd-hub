// Demo data for local development. This WIPES every table first.
//   npm run seed
import bcrypt from 'bcryptjs';
import { config } from './config';
import { pool, tx } from './db';
import { newCheckinCode } from './lib/codes';
import { hashFlag } from './lib/flags';
import { migrate } from './migrate';

if (config.isProd) {
  console.error('Not seeding a production database.');
  process.exit(1);
}

// tiny deterministic rng so the demo data looks the same every run
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const at = (daysFromNow: number, hour: number, minute = 0) => {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const fence = (s: string) => '```\n' + s + '\n```';

const caesar = (s: string, shift: number) =>
  s.replace(/[a-z]/gi, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
  });

const members = [
  'Maya Chen', 'Priya Nair', 'Sofia Alvarez', 'Hannah Park', 'Amara Okafor', 'Leila Haddad',
  'Jordan Mills', 'Nora Kim', 'Elena Petrova', 'Tess Walker', 'Anika Rao', 'Camila Duarte',
  'Ruth Bekele', 'Isla Murphy',
];

async function main() {
  await migrate(() => {});
  const password = await bcrypt.hash('password123', config.bcryptRounds);

  await tx(async (c) => {
    await c.query(
      'truncate ctf_attempts, ctf_solves, ctf_challenges, attendance, rsvps, events, users restart identity cascade',
    );

    const officer = (
      await c.query(
        `insert into users (email, name, password_hash, role, major, grad_year)
         values ('officer@example.com', 'Riley Santos', $1, 'officer', 'Computer Science', 2027)
         returning id`,
        [password],
      )
    ).rows[0];

    const memberIds: string[] = [];
    for (const [i, name] of members.entries()) {
      const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
      const { rows } = await c.query(
        `insert into users (email, name, password_hash, major, grad_year, created_at)
         values ($1, $2, $3, $4, $5, now() - $6::int * interval '1 day') returning id`,
        [
          `${slug}@example.com`,
          name,
          password,
          ['Computer Science', 'Software Engineering', 'Data Science', 'Information Technology'][i % 4],
          2026 + (i % 4),
          10 + Math.floor(rand() * 90),
        ],
      );
      memberIds.push(rows[0].id);
    }
    // one plain demo login to point people at
    await c.query(
      `insert into users (email, name, password_hash, major, grad_year)
       values ('member@example.com', 'Demo Member', $1, 'Computer Science', 2028)`,
      [password],
    );

    // ---- events ----
    const eventDefs = [
      { title: 'Intro to Git and GitHub', location: 'ECSW 1.315', start: at(-35, 18), len: 2, cap: null,
        description: 'Branches, pull requests and how not to panic during a merge conflict. Bring a laptop.' },
      { title: 'Resume review night', location: 'SSA 1.100', start: at(-21, 18), len: 2, cap: 40,
        description: 'Bring a printed or digital resume. Officers and a few upperclassmen will give feedback in small groups.' },
      { title: 'Python for absolute beginners', location: 'ECSW 1.315', start: at(-14, 17, 30), len: 2, cap: 30,
        description: 'No experience needed. We build a small text adventure from scratch.' },
      { title: 'CTF warmup session', location: 'ECSS 2.306', start: at(-7, 18), len: 2, cap: null,
        description: 'Learn the common categories and solve a few starter challenges together.' },
      { title: 'Chapter meeting', location: 'ECSW 1.315', start: at(5, 18), len: 1, cap: null,
        description: 'Semester plans, committee sign-ups and snacks.' },
      { title: 'Mock technical interviews', location: 'SSA 1.100', start: at(12, 17, 30), len: 3, cap: 24,
        description: 'Paired practice with feedback. You will interview once and observe once.' },
      { title: 'Build a REST API with Node', location: 'ECSW 1.315', start: at(19, 18), len: 2, cap: 3,
        description: 'Workshop on routes, validation and talking to a database. Small room, so spots are limited.' },
    ];

    const eventIds: { id: string; past: boolean }[] = [];
    for (const e of eventDefs) {
      const end = new Date(e.start.getTime() + e.len * HOUR);
      const { rows } = await c.query(
        `insert into events (title, description, location, starts_at, ends_at, capacity, checkin_code, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [e.title, e.description, e.location, e.start, end, e.cap, newCheckinCode(), officer.id],
      );
      eventIds.push({ id: rows[0].id, past: end < new Date() });
    }

    for (const ev of eventIds) {
      const interested = memberIds.filter(() => rand() < (ev.past ? 0.7 : 0.45));
      for (const [i, uid] of interested.entries()) {
        await c.query('insert into rsvps (event_id, user_id, status) values ($1, $2, $3)', [
          ev.id,
          uid,
          'going',
        ]);
        if (ev.past && rand() < 0.78) {
          await c.query(
            `insert into attendance (event_id, user_id, method, checked_in_at)
             select $1, $2, 'code', starts_at + $3::int * interval '1 minute' from events where id = $1`,
            [ev.id, uid, 2 + i],
          );
        }
      }
    }

    // fill the small workshop so the waitlist is visible in the demo
    const small = eventIds[eventIds.length - 1];
    await c.query('delete from rsvps where event_id = $1', [small.id]);
    for (const [i, uid] of memberIds.slice(0, 5).entries()) {
      await c.query('insert into rsvps (event_id, user_id, status) values ($1, $2, $3)', [
        small.id,
        uid,
        i < 3 ? 'going' : 'waitlist',
      ]);
    }

    // ---- ctf ----
    // These flags are in the repo, so they're sample challenges only. Make your
    // real ones from the admin page and the answers stay out of git.
    const challengeDefs = [
      { title: 'Welcome aboard', category: 'misc', points: 50, flag: 'gwc{base64_is_not_encryption}',
        text: (f: string) => `This looks like gibberish, but it ends in two equals signs for a reason.\n\n${fence(Buffer.from(f).toString('base64'))}`,
        hint: 'It is a very common encoding, not a cipher.', published: true },
      { title: 'Shift happens', category: 'crypto', points: 100, flag: 'gwc{rotate_it_back}',
        text: (f: string) => `Someone shifted every letter by the same amount. Punctuation was left alone.\n\n${fence(caesar(f, 7))}`,
        hint: 'The flag format is gwc{...}. Work out the shift from the first three letters.', published: true },
      { title: 'Hex marks the spot', category: 'misc', points: 75, flag: 'gwc{two_digits_per_byte}',
        text: (f: string) => `Each pair of characters is one byte.\n\n${fence(Buffer.from(f).toString('hex'))}`,
        hint: 'ASCII table, or a one-liner in your favorite language.', published: true },
      { title: 'Eight bits at a time', category: 'crypto', points: 125, flag: 'gwc{bits_and_bytes}',
        text: (f: string) =>
          `Decode this one.\n\n${fence([...Buffer.from(f)].map((b) => b.toString(2).padStart(8, '0')).join(' '))}`,
        hint: null, published: true },
      { title: 'Draft: inspect the page', category: 'web', points: 150, flag: 'gwc{not_ready_yet}',
        text: () => 'Placeholder for a web challenge that is still being built.', hint: null, published: false },
    ];

    const challengeIds: { id: string; points: number; published: boolean }[] = [];
    for (const ch of challengeDefs) {
      const { rows } = await c.query(
        `insert into ctf_challenges (title, category, description, points, flag_hash, hint, published)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [ch.title, ch.category, ch.text(ch.flag), ch.points, hashFlag(ch.flag), ch.hint, ch.published],
      );
      challengeIds.push({ id: rows[0].id, points: ch.points, published: ch.published });
    }

    // spread solves around so the leaderboard has some shape
    const live = challengeIds.filter((x) => x.published);
    for (const [i, uid] of memberIds.entries()) {
      const skill = 1 - i / memberIds.length; // earlier members are a bit stronger
      for (const [j, ch] of live.entries()) {
        if (rand() < skill * 0.9 - j * 0.12) {
          await c.query(
            `insert into ctf_solves (challenge_id, user_id, solved_at)
             values ($1, $2, now() - $3::int * interval '1 minute')`,
            [ch.id, uid, Math.floor(rand() * 60 * 24 * 6)],
          );
        }
      }
    }
  });

  console.log('Seeded.\n  officer: officer@example.com / password123\n  member:  member@example.com / password123');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
