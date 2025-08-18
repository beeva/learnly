-- Educator classrooms. Students join with a short, unambiguous code (no 0/O or 1/I).

create table classrooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 80),
  educator_id  uuid not null references users (id) on delete cascade,
  course_id    uuid not null references courses (id),
  join_code    text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index classrooms_educator_idx on classrooms (educator_id) where archived_at is null;

create table classroom_members (
  classroom_id  uuid not null references classrooms (id) on delete cascade,
  user_id       uuid not null references users (id) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create index classroom_members_user_idx on classroom_members (user_id);

-- Insights read a class's recent attempts per skill.
create index attempts_skill_answered_idx on attempts (skill_id, answered_at);
