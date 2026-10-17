create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null,
  password_hash text not null,
  role          text not null default 'member' check (role in ('member', 'officer')),
  major         text,
  grad_year     int check (grad_year between 2020 and 2040),
  created_at    timestamptz not null default now()
);
create unique index users_email_lower_idx on users (lower(email));

create table events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  location     text not null default '',
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  capacity     int check (capacity is null or capacity > 0),
  checkin_code text not null,
  created_by   uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index events_starts_at_idx on events (starts_at);

create table rsvps (
  event_id   uuid not null references events (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  status     text not null check (status in ('going', 'waitlist')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index rsvps_user_idx on rsvps (user_id);

create table attendance (
  event_id      uuid not null references events (id) on delete cascade,
  user_id       uuid not null references users (id) on delete cascade,
  method        text not null check (method in ('code', 'officer')),
  checked_in_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index attendance_user_idx on attendance (user_id);

create table ctf_challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null,
  description text not null,
  points      int not null check (points > 0),
  flag_hash   text not null,
  hint        text,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table ctf_solves (
  challenge_id uuid not null references ctf_challenges (id) on delete cascade,
  user_id      uuid not null references users (id) on delete cascade,
  solved_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index ctf_solves_user_idx on ctf_solves (user_id);

-- every submission, right or wrong. used for rate limiting and so officers
-- can see if someone is spraying guesses
create table ctf_attempts (
  id           bigserial primary key,
  challenge_id uuid not null references ctf_challenges (id) on delete cascade,
  user_id      uuid not null references users (id) on delete cascade,
  correct      boolean not null,
  created_at   timestamptz not null default now()
);
create index ctf_attempts_user_time_idx on ctf_attempts (user_id, created_at desc);
