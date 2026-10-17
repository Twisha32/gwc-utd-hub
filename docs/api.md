# API reference

Everything lives under `/api`. Requests and responses are JSON. Auth is a session cookie (`gwc_session`) that the login and register routes set.

Errors always look like this:

```json
{ "error": { "message": "Use at least 8 characters.", "fields": { "password": "Use at least 8 characters." } } }
```

`fields` only shows up on validation errors. Status codes: 400 validation, 401 not signed in, 403 wrong role or origin, 404 not found, 409 conflict (duplicate email, event already over, check-in closed), 429 rate limited.

In the tables, **member** means any signed in user and **officer** means role `officer`.

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{ "ok": true }`, 503 if the database can't be reached |

## Auth

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | none | `name`, `email`, `password` (8 to 72 chars), `joinCode` if the server requires one. Returns the user and sets the cookie |
| POST | `/auth/login` | none | `email`, `password` |
| POST | `/auth/logout` | none | 204 |
| GET | `/auth/me` | none | `{ "user": {...} }`, or `{ "user": null }` when signed out |

Register and login are limited to 30 attempts per 15 minutes per IP.

## Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| PATCH | `/users/me` | member | `name`, `major`, `gradYear`, all optional |
| GET | `/users/me/summary` | member | `attended`, `upcomingRsvps`, `ctfPoints`, `ctfSolves` |
| GET | `/users?q=&limit=` | officer | Search by name or email, `limit` up to 100 |
| PUT | `/users/:id/role` | officer | `{ "role": "member" \| "officer" }`. You can't change your own |

## Events

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/events?when=upcoming\|past\|all&limit=` | none | Includes `myStatus` and `checkedIn` when signed in. Never includes the check-in code |
| GET | `/events/:id` | none | Officers also get `checkinCode` |
| POST | `/events` | officer | `title`, `startsAt`, `endsAt` (ISO 8601), `location`, `description`, `capacity` (number or null) |
| PATCH | `/events/:id` | officer | Any of the above. Raising capacity moves people off the waitlist |
| DELETE | `/events/:id` | officer | 204. Takes RSVPs and attendance with it |
| PUT | `/events/:id/rsvp` | member | Returns `{ "status": "going" \| "waitlist" }`. Safe to call twice. 409 if the event is over |
| DELETE | `/events/:id/rsvp` | member | Frees the spot and promotes the next person on the waitlist |
| POST | `/events/:id/checkin` | member | `{ "code": "ABC123" }`, case insensitive. 409 outside the check-in window |
| GET | `/events/:id/roster` | officer | Everyone with an RSVP or an attendance record |
| PUT | `/events/:id/attendance/:userId` | officer | Check someone in by hand |
| DELETE | `/events/:id/attendance/:userId` | officer | Undo a check-in |
| POST | `/events/:id/checkin-code` | officer | Generates a new code and returns it |

Check-in is open from 30 minutes before `startsAt` until 60 minutes after `endsAt`. The `checkinOpen` field on an event tells you whether it's open right now.

## CTF

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/ctf/challenges` | member | Published challenges with `solved` and `solveCount`. Officers also see drafts. Flags are never returned |
| POST | `/ctf/challenges/:id/submit` | member | `{ "flag": "gwc{...}" }`. Returns `{ "correct": false }`, or `{ "correct": true, "points": 100, "firstBlood": false }`. About 8 submissions a minute per user |
| GET | `/ctf/leaderboard` | member | Top 200 members. Ties go to whoever reached the score first. Officers are excluded |
| POST | `/ctf/challenges` | officer | `title`, `category`, `description`, `points`, `flag`, `hint`, `published` |
| PATCH | `/ctf/challenges/:id` | officer | Same fields. Leave `flag` out to keep the current one |
| PUT | `/ctf/challenges/:id/published` | officer | `{ "published": true }` |
| DELETE | `/ctf/challenges/:id` | officer | 204 |

Categories are `web`, `crypto`, `forensics`, `reverse`, `osint`, `pwn` and `misc`. In a description, text between triple backticks is shown as a code block.

## Stats

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/stats` | officer | Totals plus RSVPs vs check-ins for the last eight finished events |
