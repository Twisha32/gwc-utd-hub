import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, eventBody, liveEventBody, signUp, useCleanDb } from './helpers';

useCleanDb();

async function createEvent(officerAgent: request.Agent, body = eventBody()) {
  const res = await officerAgent.post('/api/events').send(body).expect(201);
  return res.body.event as { id: string };
}

describe('events', () => {
  it('lets only officers create events', async () => {
    const member = await signUp();
    await request(app).post('/api/events').send(eventBody()).expect(401);
    await member.agent.post('/api/events').send(eventBody()).expect(403);

    const officer = await signUp({ officer: true });
    const res = await officer.agent.post('/api/events').send(eventBody()).expect(201);
    expect(res.body.event.title).toBe('Python workshop');
  });

  it('rejects an event that ends before it starts', async () => {
    const officer = await signUp({ officer: true });
    const start = new Date(Date.now() + 3_600_000);
    const res = await officer.agent
      .post('/api/events')
      .send(eventBody({ startsAt: start.toISOString(), endsAt: new Date(start.getTime() - 1000).toISOString() }))
      .expect(400);
    expect(res.body.error.fields.endsAt).toBeDefined();
  });

  it('lists upcoming events publicly and never leaks the check-in code', async () => {
    const officer = await signUp({ officer: true });
    await createEvent(officer.agent);

    const res = await request(app).get('/api/events').expect(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].myStatus).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/checkin_?code/i);

    const member = await signUp();
    const detail = await member.agent.get(`/api/events/${res.body.events[0].id}`).expect(200);
    expect(detail.body.event.checkinCode).toBeUndefined();

    const asOfficer = await officer.agent.get(`/api/events/${res.body.events[0].id}`).expect(200);
    expect(asOfficer.body.event.checkinCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('separates upcoming from past', async () => {
    const officer = await signUp({ officer: true });
    const past = new Date(Date.now() - 7 * 24 * 3_600_000);
    await createEvent(
      officer.agent,
      eventBody({
        title: 'Old one',
        startsAt: past.toISOString(),
        endsAt: new Date(past.getTime() + 3_600_000).toISOString(),
      }),
    );
    await createEvent(officer.agent);

    const up = await request(app).get('/api/events?when=upcoming').expect(200);
    const old = await request(app).get('/api/events?when=past').expect(200);
    expect(up.body.events.map((e: any) => e.title)).toEqual(['Python workshop']);
    expect(old.body.events.map((e: any) => e.title)).toEqual(['Old one']);
  });

  it('404s on a bad id instead of 500ing', async () => {
    await request(app).get('/api/events/not-a-uuid').expect(404);
    await request(app).get('/api/events/00000000-0000-4000-8000-000000000000').expect(404);
  });
});

describe('rsvp', () => {
  it('is idempotent and can be cancelled', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent);
    const member = await signUp();

    const first = await member.agent.put(`/api/events/${ev.id}/rsvp`).expect(200);
    const again = await member.agent.put(`/api/events/${ev.id}/rsvp`).expect(200);
    expect(first.body.status).toBe('going');
    expect(again.body.status).toBe('going');

    const list = await member.agent.get('/api/events').expect(200);
    expect(list.body.events[0]).toMatchObject({ myStatus: 'going', goingCount: 1 });

    await member.agent.delete(`/api/events/${ev.id}/rsvp`).expect(200);
    const after = await member.agent.get('/api/events').expect(200);
    expect(after.body.events[0]).toMatchObject({ myStatus: null, goingCount: 0 });
  });

  it('needs a login', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent);
    await request(app).put(`/api/events/${ev.id}/rsvp`).expect(401);
  });

  it('waitlists when full and promotes in order when someone cancels', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, eventBody({ capacity: 2 }));
    const [a, b, c, d] = await Promise.all([signUp(), signUp(), signUp(), signUp()]);

    expect((await a.agent.put(`/api/events/${ev.id}/rsvp`)).body.status).toBe('going');
    expect((await b.agent.put(`/api/events/${ev.id}/rsvp`)).body.status).toBe('going');
    expect((await c.agent.put(`/api/events/${ev.id}/rsvp`)).body.status).toBe('waitlist');
    expect((await d.agent.put(`/api/events/${ev.id}/rsvp`)).body.status).toBe('waitlist');

    await a.agent.delete(`/api/events/${ev.id}/rsvp`).expect(200);

    const statusFor = async (u: typeof a) =>
      (await u.agent.get(`/api/events/${ev.id}`)).body.event.myStatus;
    expect(await statusFor(c)).toBe('going'); // first in line
    expect(await statusFor(d)).toBe('waitlist');
  });

  it("doesn't hand out more spots than capacity when requests race", async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, eventBody({ capacity: 3 }));
    const people = await Promise.all(Array.from({ length: 8 }, () => signUp()));

    const results = await Promise.all(
      people.map((p) => p.agent.put(`/api/events/${ev.id}/rsvp`).then((r) => r.body.status)),
    );
    expect(results.filter((s) => s === 'going')).toHaveLength(3);
    expect(results.filter((s) => s === 'waitlist')).toHaveLength(5);
  });

  it('promotes the waitlist when an officer raises the capacity', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, eventBody({ capacity: 1 }));
    const a = await signUp();
    const b = await signUp();
    await a.agent.put(`/api/events/${ev.id}/rsvp`);
    await b.agent.put(`/api/events/${ev.id}/rsvp`);

    await officer.agent.patch(`/api/events/${ev.id}`).send({ capacity: 2 }).expect(200);
    const res = await b.agent.get(`/api/events/${ev.id}`);
    expect(res.body.event.myStatus).toBe('going');
  });

  it("won't take an RSVP for an event that's over", async () => {
    const officer = await signUp({ officer: true });
    const past = new Date(Date.now() - 24 * 3_600_000);
    const ev = await createEvent(
      officer.agent,
      eventBody({ startsAt: past.toISOString(), endsAt: new Date(past.getTime() + 3_600_000).toISOString() }),
    );
    const member = await signUp();
    await member.agent.put(`/api/events/${ev.id}/rsvp`).expect(409);
  });
});

describe('check-in', () => {
  it('works with the right code while the event is on, and only counts once', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, liveEventBody());
    const code = (await officer.agent.get(`/api/events/${ev.id}`)).body.event.checkinCode;
    const member = await signUp();

    const wrong = await member.agent.post(`/api/events/${ev.id}/checkin`).send({ code: 'ZZZZZZ' }).expect(400);
    expect(wrong.body.error.fields.code).toBeDefined();

    // lowercase and stray spaces are fine, people type these on phones
    await member.agent.post(`/api/events/${ev.id}/checkin`).send({ code: ` ${code.toLowerCase()} ` }).expect(200);
    await member.agent.post(`/api/events/${ev.id}/checkin`).send({ code }).expect(200);

    const detail = await member.agent.get(`/api/events/${ev.id}`);
    expect(detail.body.event).toMatchObject({ checkedIn: true, attendedCount: 1 });
  });

  it('is closed well before the event starts', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent); // starts in two days
    const code = (await officer.agent.get(`/api/events/${ev.id}`)).body.event.checkinCode;
    const member = await signUp();
    await member.agent.post(`/api/events/${ev.id}/checkin`).send({ code }).expect(409);
  });

  it('stops working with the old code after an officer regenerates it', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, liveEventBody());
    const oldCode = (await officer.agent.get(`/api/events/${ev.id}`)).body.event.checkinCode;
    const { body } = await officer.agent.post(`/api/events/${ev.id}/checkin-code`).expect(200);
    expect(body.code).not.toBe(oldCode);

    const member = await signUp();
    await member.agent.post(`/api/events/${ev.id}/checkin`).send({ code: oldCode }).expect(400);
    await member.agent.post(`/api/events/${ev.id}/checkin`).send({ code: body.code }).expect(200);
  });
});

describe('roster', () => {
  it('is officer only and shows rsvps plus walk-ins', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, liveEventBody());
    const rsvped = await signUp({ name: 'Rsvp Person' });
    const walkIn = await signUp({ name: 'Walk In' });

    await rsvped.agent.put(`/api/events/${ev.id}/rsvp`).expect(200);
    await rsvped.agent.get(`/api/events/${ev.id}/roster`).expect(403);

    await officer.agent.put(`/api/events/${ev.id}/attendance/${walkIn.id}`).expect(200);
    await officer.agent.put(`/api/events/${ev.id}/attendance/${rsvped.id}`).expect(200);

    const { body } = await officer.agent.get(`/api/events/${ev.id}/roster`).expect(200);
    const byName = Object.fromEntries(body.roster.map((r: any) => [r.name, r]));
    expect(byName['Rsvp Person']).toMatchObject({ rsvpStatus: 'going', checkInMethod: 'officer' });
    expect(byName['Walk In']).toMatchObject({ rsvpStatus: null, checkInMethod: 'officer' });

    await officer.agent.delete(`/api/events/${ev.id}/attendance/${walkIn.id}`).expect(200);
    const after = await officer.agent.get(`/api/events/${ev.id}/roster`);
    expect(after.body.roster.map((r: any) => r.name)).toEqual(['Rsvp Person']);
  });

  it('feeds the profile summary and officer stats', async () => {
    const officer = await signUp({ officer: true });
    const ev = await createEvent(officer.agent, liveEventBody());
    const member = await signUp();
    await member.agent.put(`/api/events/${ev.id}/rsvp`);
    await officer.agent.put(`/api/events/${ev.id}/attendance/${member.id}`);

    const me = await member.agent.get('/api/users/me/summary').expect(200);
    expect(me.body.summary).toMatchObject({ attended: 1, upcomingRsvps: 1 });

    await member.agent.get('/api/stats').expect(403);
    const stats = await officer.agent.get('/api/stats').expect(200);
    expect(stats.body.totals.members).toBe(2);
  });
});
