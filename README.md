# GWC at UTD Hub

Chapter management for Girls Who Code at UT Dallas. Members RSVP to events, check in when they arrive and solve CTF challenges. Officers run events, attendance and the challenge set from an admin area.

![Landing page](docs/screenshots/landing.png)

| | |
|---|---|
| ![Events](docs/screenshots/events.png) | ![CTF](docs/screenshots/ctf.png) |
| ![Leaderboard](docs/screenshots/leaderboard.png) | ![Managing an event](docs/screenshots/manage-event.png) |

The screenshots use the demo data from `npm run seed`, so none of those names are real people.

## What it does

**Members**

- Sign up with a school email (and an optional join code the officers hand out)
- RSVP to events. When one fills up you go on a waitlist and move up automatically if someone cancels
- Check in at the event with a short code shown on the projector
- Solve CTF challenges and see where you rank
- A profile page with your attendance and points

**Officers**

- Create and edit events, with an optional capacity
- Show the check-in code full screen, regenerate it, or check people in by hand (walk-ins, dead phones)
- Live roster of who RSVPed and who showed up
- Write CTF challenges, keep them as drafts, publish when ready
- Overview of members, upcoming events and RSVPs vs actual attendance
- Promote other members to officer

## Stack

- **Web:** Next.js 16 (App Router), React 19, TypeScript, SWR. Plain CSS, no UI kit
- **API:** Node 22, Express 5, TypeScript, zod for validation
- **Database:** Postgres 16 through `pg`, with plain SQL migrations (`api/migrations`)
- **Tests:** Vitest and Supertest against a real Postgres, 36 tests
- **Ops:** Docker for both services, docker compose for local, GitHub Actions for CI, a Render blueprint for deploys

## Running it

### With Docker

```bash
docker compose up --build
docker compose exec api node dist/seed.js   # optional demo data
```

Open http://localhost:3000. After seeding you can sign in as `officer@example.com` or `member@example.com`, both with the password `password123`. Seeding wipes the database, so don't do it once you have real data.

### Without Docker

You need Node 22 and a Postgres. The quickest Postgres is a container:

```bash
docker run --name gwc-db -d -p 5432:5432 \
  -e POSTGRES_USER=gwc -e POSTGRES_PASSWORD=gwc -e POSTGRES_DB=gwc postgres:16
```

Then two terminals:

```bash
# api
cd api
cp .env.example .env
npm install
npm run migrate
npm run seed      # optional
npm run dev       # http://localhost:4000

# web
cd web
cp .env.example .env.local
npm install
npm run dev       # http://localhost:3000
```

### Tests

```bash
docker exec gwc-db createdb -U gwc gwc_test
cd api
TEST_DATABASE_URL=postgres://gwc:gwc@localhost:5432/gwc_test npm test
```

The test database gets dropped and rebuilt on every run, so the name has to end in `_test`. The runner refuses anything else.

## Configuration

API (`api/.env`):

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | none, required | Postgres connection string |
| `DATABASE_SSL` | `false` | Set `true` for hosted databases that need TLS |
| `JWT_SECRET` | none, required | Signs session cookies. Use a long random string |
| `FLAG_PEPPER` | none, required | Key used when hashing CTF flags. **Don't change it after you create challenges**, every stored flag stops matching |
| `WEB_ORIGIN` | `http://localhost:3000` | Public URL of the web app. Writes from any other origin are rejected |
| `ALLOWED_EMAIL_DOMAINS` | empty (anyone) | Comma separated, e.g. `utdallas.edu` |
| `OFFICER_EMAILS` | empty | Comma separated. These emails become officers when they sign up |
| `CLUB_JOIN_CODE` | empty | If set, sign up requires it |
| `TRUST_PROXY` | `1` | How many proxies sit in front of the API, used for rate limiting by IP |
| `BCRYPT_ROUNDS` | `11` | Password hashing cost |
| `RUN_MIGRATIONS` | `true` | Apply new migrations when the server starts |
| `PORT` | `4000` | |

Web:

| Variable | Default | What it does |
|---|---|---|
| `API_URL` | `http://localhost:4000` | Where `/api/*` requests get forwarded. Read at runtime, not build time |

Club details like the name, timezone and footer links are in `web/src/lib/club.ts`. The copy under "What we do" on the landing page is in the same file.

To make yourself an officer, put your email in `OFFICER_EMAILS` before you sign up. After that, officers can promote people from Admin, Members. If you're already signed up: `update users set role = 'officer' where email = '...';`

## How it's put together

```
api/
  migrations/     SQL, applied in filename order
  src/routes/     auth, users, events, ctf, stats
  src/middleware/ session loading, role checks, origin check, error handler
  test/           integration tests
web/
  src/app/        pages (App Router), plus the /api proxy route
  src/components/ header, event rows, forms, the dot-matrix hero
  src/lib/        api client, hooks, date formatting, club config
docs/             API reference, deploy guide, screenshots
```

```mermaid
erDiagram
  users ||--o{ rsvps : makes
  events ||--o{ rsvps : has
  users ||--o{ attendance : "checks in"
  events ||--o{ attendance : records
  users ||--o{ ctf_solves : earns
  ctf_challenges ||--o{ ctf_solves : "solved by"
  users ||--o{ ctf_attempts : submits
  ctf_challenges ||--o{ ctf_attempts : logs
```

A few decisions worth knowing about:

- **The browser only talks to the web app.** `web/src/app/api/[...path]/route.ts` forwards `/api/*` to the real API. That keeps the session cookie first-party, so there's no CORS or third-party cookie trouble when the two services live on different domains, and the same Docker image works anywhere because the API address is read at runtime.
- **Sessions** are a JWT in an httpOnly, SameSite=Lax cookie. The user's role is read from the database on every request rather than trusted from the token, so removing an officer takes effect immediately. Writes with an unexpected `Origin` header get a 403.
- **RSVPs lock the event row** inside a transaction before counting spots. There's a test that fires eight simultaneous RSVPs at a three-spot event and checks exactly three get in.
- **Check-in** opens 30 minutes before an event starts and closes an hour after it ends. Codes are six characters with the look-alikes (0/O, 1/I) removed, and the check-in route is rate limited.
- **CTF flags** are stored as an HMAC, never plaintext, so a database dump doesn't hand out answers. Every submission is logged, and a user can send about 8 a minute. That limit is counted in the database so it holds up with more than one API instance.
- **Officers are left off the leaderboard** since they write the challenges. They can still solve them.
- **Times** are stored as UTC and shown and entered in the club timezone (`America/Chicago`), whatever the viewer's laptop is set to.

The API is documented in [docs/api.md](docs/api.md).

## Deploying

There's a Render blueprint in `render.yaml` and a step by step guide in [docs/deploy.md](docs/deploy.md). CI (`.github/workflows/ci.yml`) typechecks both apps, runs the API tests against Postgres, builds both Docker images and brings the whole stack up to check the pieces can reach each other.

## Not done yet

- No email verification or password reset. For now the domain restriction and join code are what keep strangers out.
- Sessions can't be revoked individually. They last seven days.
- No CSV export for attendance.
- The browser walkthrough I used to check the UI isn't in the repo, so CI has API tests and a smoke test but no browser tests.

## License

MIT, see [LICENSE](LICENSE).
