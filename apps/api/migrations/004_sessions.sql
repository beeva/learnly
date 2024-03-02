-- Diagnostic, practice and review sessions.

create table sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  course_id       uuid not null references courses (id),
  kind            text not null check (kind in ('diagnostic', 'practice', 'review')),
  target_items    smallint not null check (target_items between 1 and 30),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  items_answered  integer not null default 0,
  items_correct   integer not null default 0,
  -- Diagnostic sessions store their starting-point summary once completed.
  summary         jsonb
);

create index sessions_user_started_idx on sessions (user_id, started_at desc);
create index sessions_user_course_kind_idx on sessions (user_id, course_id, kind) where completed_at is not null;

-- attempts.session_id has existed since 003; now that sessions exist, enforce it.
-- Any ids clients sent before sessions shipped can't refer to a real session.
update attempts set session_id = null where session_id is not null;

alter table attempts
  add constraint attempts_session_fk foreign key (session_id) references sessions (id) on delete set null;

create index attempts_session_idx on attempts (session_id, answered_at) where session_id is not null;
