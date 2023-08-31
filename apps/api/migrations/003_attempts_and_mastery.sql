-- Every answer a learner gives, and the per-skill mastery estimate derived from them.

create table attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  item_id            uuid not null references items (id),
  skill_id           uuid not null references skills (id),
  -- Practice sessions arrive in a later release; the column exists now so attempts
  -- never need a backfill.
  session_id         uuid,
  client_attempt_id  uuid,
  response           jsonb not null,
  correct            boolean not null,
  hints_used         smallint not null default 0 check (hints_used between 0 and 5),
  duration_ms        integer not null check (duration_ms >= 0),
  -- Ability estimate right before this answer, so item difficulty can be recalibrated.
  ability_before     double precision not null,
  answered_at        timestamptz not null,
  created_at         timestamptz not null default now()
);

-- Retried submissions from flaky mobile networks carry the same client id.
create unique index attempts_client_attempt_key
  on attempts (user_id, client_attempt_id)
  where client_attempt_id is not null;

create index attempts_user_answered_idx on attempts (user_id, answered_at desc);
create index attempts_user_item_idx on attempts (user_id, item_id);
create index attempts_item_idx on attempts (item_id);

create table skill_mastery (
  user_id            uuid not null references users (id) on delete cascade,
  skill_id           uuid not null references skills (id) on delete cascade,
  p_known            double precision not null check (p_known between 0 and 1),
  ability            double precision not null,
  band               text not null check (band in ('new', 'learning', 'practicing', 'mastered')),
  attempts           integer not null default 0,
  last_practiced_at  timestamptz,
  due_at             timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create index skill_mastery_updated_idx on skill_mastery (user_id, updated_at);
