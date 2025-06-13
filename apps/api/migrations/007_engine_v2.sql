-- Engine v2: Bayesian Knowledge Tracing with per-skill fitted parameters, plus
-- spaced-repetition review state per learner and skill.

create table skill_review_state (
  user_id        uuid not null references users (id) on delete cascade,
  skill_id       uuid not null references skills (id) on delete cascade,
  interval_days  double precision not null default 0,
  ease           double precision not null default 2.3,
  repetitions    integer not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- Refit nightly from everyone's answer sequences (see src/jobs/bkt-fit.ts).
create table skill_bkt_params (
  skill_id      uuid primary key references skills (id) on delete cascade,
  p_init        double precision not null check (p_init between 0 and 1),
  p_transit     double precision not null check (p_transit between 0 and 1),
  p_slip        double precision not null check (p_slip between 0 and 1),
  p_guess       double precision not null check (p_guess between 0 and 1),
  learners      integer not null,
  observations  integer not null,
  fitted_at     timestamptz not null default now()
);

-- Review sessions look up what's due.
create index skill_mastery_due_idx on skill_mastery (user_id, due_at) where due_at is not null;
