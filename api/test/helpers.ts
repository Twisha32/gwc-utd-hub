import request from 'supertest';
import { beforeEach, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { pool, query } from '../src/db';

export const app = createApp();

export function useCleanDb() {
  beforeEach(async () => {
    await pool.query(
      'truncate ctf_attempts, ctf_solves, ctf_challenges, attendance, rsvps, events, users restart identity cascade',
    );
  });
  afterAll(async () => {
    await pool.end();
  });
}

let counter = 0;

// returns a supertest agent that's already signed in (it keeps the cookie)
export async function signUp(opts: { name?: string; officer?: boolean } = {}) {
  counter += 1;
  const email = `student${counter}@utdallas.edu`;
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: opts.name ?? `Student ${counter}`, email, password: 'correct horse battery' })
    .expect(201);

  const id = res.body.user.id as string;
  if (opts.officer) await query("update users set role = 'officer' where id = $1", [id]);
  return { agent, id, email };
}

const HOUR = 60 * 60 * 1000;

export function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 48 * HOUR);
  return {
    title: 'Python workshop',
    description: 'Bring a laptop.',
    location: 'ECSW 1.315',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 2 * HOUR).toISOString(),
    capacity: null,
    ...overrides,
  };
}

// an event that is happening right now, so check-in is open
export function liveEventBody(overrides: Record<string, unknown> = {}) {
  return eventBody({
    startsAt: new Date(Date.now() - HOUR).toISOString(),
    endsAt: new Date(Date.now() + HOUR).toISOString(),
    ...overrides,
  });
}
