import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { app, signUp, useCleanDb } from './helpers';

useCleanDb();

describe('auth', () => {
  it('registers, logs out and logs back in', async () => {
    const agent = request.agent(app);
    const reg = await agent
      .post('/api/auth/register')
      .send({ name: 'Maya Chen', email: 'Maya@UTDallas.edu', password: 'longenough1' })
      .expect(201);
    expect(reg.body.user.email).toBe('maya@utdallas.edu');
    expect(reg.body.user.role).toBe('member');
    expect(reg.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(reg.body)).not.toContain('password');

    expect((await agent.get('/api/auth/me').expect(200)).body.user.email).toBe('maya@utdallas.edu');
    await agent.post('/api/auth/logout').expect(204);
    expect((await agent.get('/api/auth/me').expect(200)).body.user).toBeNull();

    await agent
      .post('/api/auth/login')
      .send({ email: 'maya@utdallas.edu', password: 'longenough1' })
      .expect(200);
    expect((await agent.get('/api/auth/me')).body.user).not.toBeNull();
  });

  it('rejects a duplicate email', async () => {
    const body = { name: 'A', email: 'dup@utdallas.edu', password: 'longenough1' };
    await request(app).post('/api/auth/register').send(body).expect(201);
    const res = await request(app).post('/api/auth/register').send(body).expect(409);
    expect(res.body.error.fields.email).toMatch(/already exists/);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'real@utdallas.edu', password: 'longenough1' })
      .expect(201);

    const wrongPw = await request(app)
      .post('/api/auth/login')
      .send({ email: 'real@utdallas.edu', password: 'nope-nope-nope' })
      .expect(401);
    const noUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@utdallas.edu', password: 'nope-nope-nope' })
      .expect(401);
    expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
  });

  it('only accepts allowed email domains', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'a@gmail.com', password: 'longenough1' })
      .expect(400);
    expect(res.body.error.fields.email).toMatch(/@utdallas\.edu/);
  });

  it('checks the join code when one is set', async () => {
    config.joinCode = 'purple-42';
    try {
      const body = { name: 'A', email: 'code@utdallas.edu', password: 'longenough1' };
      await request(app).post('/api/auth/register').send(body).expect(400);
      await request(app)
        .post('/api/auth/register')
        .send({ ...body, joinCode: 'PURPLE-42' })
        .expect(201);
    } finally {
      config.joinCode = '';
    }
  });

  it('makes listed emails officers on signup', async () => {
    config.officerEmails = ['boss@utdallas.edu'];
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Boss', email: 'boss@utdallas.edu', password: 'longenough1' })
        .expect(201);
      expect(res.body.user.role).toBe('officer');
    } finally {
      config.officerEmails = [];
    }
  });

  it('validates the body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('blocks writes from another origin', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@utdallas.edu', password: 'whatever12' })
      .expect(403);
  });

  it('lets a member update their own profile', async () => {
    const { agent } = await signUp({ name: 'Old Name' });
    const res = await agent
      .patch('/api/users/me')
      .send({ name: 'New Name', major: 'Data Science', gradYear: 2028 })
      .expect(200);
    expect(res.body.user).toMatchObject({ name: 'New Name', major: 'Data Science', gradYear: 2028 });
  });

  it('keeps member management to officers', async () => {
    const member = await signUp();
    const officer = await signUp({ officer: true });
    await member.agent.get('/api/users').expect(403);
    await member.agent.put(`/api/users/${officer.id}/role`).send({ role: 'member' }).expect(403);

    await officer.agent.put(`/api/users/${member.id}/role`).send({ role: 'officer' }).expect(200);
    await member.agent.get('/api/users').expect(200); // promoted, no new login needed
    await officer.agent.put(`/api/users/${officer.id}/role`).send({ role: 'member' }).expect(400);
  });
});
