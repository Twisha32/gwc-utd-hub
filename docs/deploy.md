# Deploying

Two services and a database. The web app is the only thing the public hits, and it forwards `/api/*` to the API.

This guide uses Render because the repo has a blueprint for it (`render.yaml`). Anywhere that runs Docker images and Postgres works the same way, just set the same environment variables.

## Render

1. Push the repo to GitHub.
2. In Render: **New, Blueprint**, pick the repo. It reads `render.yaml` and proposes a Postgres database, `gwc-hub-api` and `gwc-hub-web`.
3. Render asks for the variables the blueprint leaves blank:
   - `OFFICER_EMAILS`: your email, and any other officers. Whoever signs up with these addresses becomes an officer
   - `CLUB_JOIN_CODE`: optional, but worth setting. Hand it out at a meeting or in your Discord
   - `WEB_ORIGIN` and `API_URL`: you don't know these yet, so put `https://placeholder.invalid` in both for now
4. Let the first deploy finish. Copy each service's public URL from its page.
5. Fix the two placeholders, with no trailing slash:
   - on `gwc-hub-api`, `WEB_ORIGIN` is the **web** URL
   - on `gwc-hub-web`, `API_URL` is the **API** URL

   Saving an environment variable redeploys that service.
6. Open the web URL, sign up with an address from `OFFICER_EMAILS`, and you should see Admin in the header.

`JWT_SECRET` and `FLAG_PEPPER` are generated for you. The API runs its migrations when it starts, so there's nothing to run by hand.

### Things to know

- Free web services go to sleep when nobody's using them, so the first visit after a quiet stretch is slow. While the API is waking up, the web app answers with a short "unreachable, try again" message rather than hanging.
- Check Render's current terms for the free Postgres plan. It has had a time limit before. For something people rely on, either pay for the database or use a free Postgres from somewhere that doesn't expire, like Neon: create a project, delete the `databases:` block and the `DATABASE_URL` entry from `render.yaml`, then set `DATABASE_URL` yourself and add `DATABASE_SSL=true`.
- The API sits behind Render's load balancer and then the web service. If rate limiting should work per person rather than lumping everyone together, set `TRUST_PROXY=2` on the API.
- A custom domain goes on the web service. After adding it, update `WEB_ORIGIN` on the API to match, otherwise sign in will start failing with "Cross-origin request blocked".

## Web on Vercel instead

Import the repo, set the root directory to `web`, and add `API_URL` pointing at wherever the API runs. Everything else is the same. `WEB_ORIGIN` on the API has to be your Vercel URL.

## Before real members use it

- Set `ALLOWED_EMAIL_DOMAINS` (the blueprint sets `utdallas.edu`) and think about a join code
- Don't run the seed script against the real database. It wipes every table
- The sample CTF challenges in the seed have their flags in this repo, so write your real ones from Admin, Challenges. Only a hash of the flag is stored, so the answers never end up in git
- Leave `FLAG_PEPPER` alone once challenges exist. Changing it breaks every flag
- Take a backup now and then: `pg_dump "$DATABASE_URL" > backup.sql`
