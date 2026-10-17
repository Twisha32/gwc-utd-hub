import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { query } from '../src/db';
import { app, signUp, useCleanDb } from './helpers';

useCleanDb();

async function makeChallenge(
  officer: request.Agent,
  over: Record<string, unknown> = {},
) {
  const res = await officer
    .post('/api/ctf/challenges')
    .send({
      title: 'Warmup',
      category: 'misc',
      description: 'Decode it.',
      points: 100,
      flag: 'gwc{test_flag}',
      published: true,
      ...over,
    })
    .expect(201);
  return res.body.challenge as { id: string };
}

describe('ctf challenges', () => {
  it('is officer only to create and never returns the flag or its hash', async () => {
    const member = await signUp();
    const officer = await signUp({ officer: true });
    await member.agent
      .post('/api/ctf/challenges')
      .send({ title: 'x', category: 'misc', description: 'x', points: 10, flag: 'abc' })
      .expect(403);

    await makeChallenge(officer.agent);
    const list = await member.agent.get('/api/ctf/challenges').expect(200);
    const text = JSON.stringify(list.body);
    expect(text).not.toContain('gwc{test_flag}');
    expect(text).not.toMatch(/flag/i);
  });

  it('hides drafts from members but not from officers', async () => {
    const member = await signUp();
    const officer = await signUp({ officer: true });
    await makeChallenge(officer.agent, { title: 'Live' });
    const draft = await makeChallenge(officer.agent, { title: 'Draft', published: false });

    const asMember = await member.agent.get('/api/ctf/challenges');
    expect(asMember.body.challenges.map((c: any) => c.title)).toEqual(['Live']);
    const asOfficer = await officer.agent.get('/api/ctf/challenges');
    expect(asOfficer.body.challenges).toHaveLength(2);

    // and you can't submit to a draft
    await member.agent.post(`/api/ctf/challenges/${draft.id}/submit`).send({ flag: 'gwc{test_flag}' }).expect(404);
  });

  it('stores only a hash of the flag', async () => {
    const officer = await signUp({ officer: true });
    await makeChallenge(officer.agent);
    const [row] = await query('select flag_hash from ctf_challenges');
    expect(row.flag_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.flag_hash).not.toContain('gwc');
  });

  it('keeps the existing flag when an edit leaves it out', async () => {
    const officer = await signUp({ officer: true });
    const member = await signUp();
    const ch = await makeChallenge(officer.agent);

    await officer.agent
      .patch(`/api/ctf/challenges/${ch.id}`)
      .send({ title: 'Renamed', category: 'misc', description: 'New text', points: 150 })
      .expect(200);

    const res = await member.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag: 'gwc{test_flag}' });
    expect(res.body).toMatchObject({ correct: true, points: 150 });
  });
});

describe('ctf submissions', () => {
  it('scores a right answer once, and says wrong answers are wrong', async () => {
    const officer = await signUp({ officer: true });
    const member = await signUp();
    const ch = await makeChallenge(officer.agent, { points: 250 });
    const submit = (flag: string) =>
      member.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag });

    expect((await submit('gwc{nope}')).body).toEqual({ correct: false });

    const ok = await submit('  gwc{test_flag}  '); // surrounding whitespace is forgiven
    expect(ok.body).toMatchObject({ correct: true, points: 250, firstBlood: true });

    const again = await submit('gwc{test_flag}');
    expect(again.body).toMatchObject({ correct: true, alreadySolved: true });

    const summary = await member.agent.get('/api/users/me/summary');
    expect(summary.body.summary).toMatchObject({ ctfPoints: 250, ctfSolves: 1 });
  });

  it('is case sensitive', async () => {
    const officer = await signUp({ officer: true });
    const member = await signUp();
    const ch = await makeChallenge(officer.agent);
    const res = await member.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag: 'GWC{TEST_FLAG}' });
    expect(res.body.correct).toBe(false);
  });

  it('only gives first blood to the first solver', async () => {
    const officer = await signUp({ officer: true });
    const [a, b] = [await signUp(), await signUp()];
    const ch = await makeChallenge(officer.agent);
    const first = await a.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag: 'gwc{test_flag}' });
    const second = await b.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag: 'gwc{test_flag}' });
    expect(first.body.firstBlood).toBe(true);
    expect(second.body.firstBlood).toBe(false);
  });

  it('rate limits guessing', async () => {
    const officer = await signUp({ officer: true });
    const member = await signUp();
    const ch = await makeChallenge(officer.agent);
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await member.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag: `gwc{guess${i}}` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });
});

describe('leaderboard', () => {
  it('ranks by points, breaks ties by who got there first, and leaves officers out', async () => {
    const officer = await signUp({ officer: true });
    const [maya, priya, sofia] = [
      await signUp({ name: 'Maya' }),
      await signUp({ name: 'Priya' }),
      await signUp({ name: 'Sofia' }),
    ];
    const small = await makeChallenge(officer.agent, { title: 'Small', points: 100, flag: 'gwc{a}' });
    const big = await makeChallenge(officer.agent, { title: 'Big', points: 300, flag: 'gwc{b}' });

    const solve = (u: typeof maya, ch: { id: string }, flag: string) =>
      u.agent.post(`/api/ctf/challenges/${ch.id}/submit`).send({ flag }).expect(200);

    await solve(priya, small, 'gwc{a}'); // 100, earlier
    await solve(sofia, small, 'gwc{a}'); // 100, later
    await solve(maya, big, 'gwc{b}'); // 300
    await solve(officer, big, 'gwc{b}'); // doesn't count for the board

    const res = await sofia.agent.get('/api/ctf/leaderboard').expect(200);
    expect(res.body.leaderboard.map((r: any) => [r.name, r.points, r.rank])).toEqual([
      ['Maya', 300, 1],
      ['Priya', 100, 2],
      ['Sofia', 100, 3],
    ]);
    expect(res.body.leaderboard.find((r: any) => r.isMe).name).toBe('Sofia');
  });

  it('needs a login', async () => {
    await request(app).get('/api/ctf/leaderboard').expect(401);
  });
});
