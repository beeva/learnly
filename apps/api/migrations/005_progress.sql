-- XP, levels, streaks and daily activity.

create table user_progress (
  user_id            uuid primary key references users (id) on delete cascade,
  total_xp           integer not null default 0 check (total_xp >= 0),
  streak_current     integer not null default 0,
  streak_longest     integer not null default 0,
  last_active_day    date,
  -- New learners start with two streak freezes: one busy evening shouldn't erase weeks of effort.
  freezes_available  smallint not null default 2 check (freezes_available >= 0),
  updated_at         timestamptz not null default now()
);

-- An append-only ledger; the unique key makes every award idempotent (retries, sync replays).
create table xp_events (
  id          bigserial primary key,
  user_id     uuid not null references users (id) on delete cascade,
  amount      integer not null check (amount >= 0),
  reason      text not null check (reason in ('attempt', 'lesson_complete', 'diagnostic_complete', 'streak_bonus')),
  source_id   text not null,
  session_id  uuid references sessions (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, reason, source_id)
);

create index xp_events_session_idx on xp_events (session_id) where session_id is not null;

-- Days are UTC calendar days.
create table daily_activity (
  user_id            uuid not null references users (id) on delete cascade,
  day                date not null,
  active_seconds     integer not null default 0,
  items_answered     integer not null default 0,
  items_correct      integer not null default 0,
  lessons_completed  integer not null default 0,
  primary key (user_id, day)
);

create table lesson_completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  lesson_id     uuid not null references lessons (id) on delete cascade,
  duration_ms   integer not null check (duration_ms >= 0),
  completed_at  timestamptz not null
);

create index lesson_completions_user_lesson_idx on lesson_completions (user_id, lesson_id);
