-- Curriculum: courses -> units -> skills (with prerequisites) -> lessons and practice items.

create table courses (
  id           uuid primary key,
  slug         text not null unique,
  title        text not null,
  subject      text not null check (subject in ('math', 'reading', 'science')),
  grade_band   text not null check (grade_band in ('k-2', '3-5', '6-8', '9-12')),
  description  text not null,
  cover_hue    smallint not null check (cover_hue between 0 and 359),
  position     integer not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table units (
  id         uuid primary key,
  course_id  uuid not null references courses (id) on delete cascade,
  position   integer not null,
  title      text not null,
  summary    text not null
);

create index units_course_idx on units (course_id, position);

create table skills (
  id        uuid primary key,
  unit_id   uuid not null references units (id) on delete cascade,
  code      text not null unique,
  name      text not null,
  position  integer not null
);

create index skills_unit_idx on skills (unit_id, position);

create table skill_prerequisites (
  skill_id         uuid not null references skills (id) on delete cascade,
  prerequisite_id  uuid not null references skills (id) on delete cascade,
  primary key (skill_id, prerequisite_id),
  check (skill_id <> prerequisite_id)
);

create table lessons (
  id                 uuid primary key,
  skill_id           uuid not null references skills (id) on delete cascade,
  slug               text not null unique,
  title              text not null,
  level              smallint not null check (level between 1 and 5),
  estimated_minutes  smallint not null check (estimated_minutes between 1 and 60),
  blocks             jsonb not null check (jsonb_typeof(blocks) = 'array'),
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index lessons_skill_idx on lessons (skill_id, level, position);

-- Kind-specific fields (choices, answer keys, tolerances, accepted answers) live in
-- `body`, so adding an item kind never needs a migration.
create table items (
  id           uuid primary key,
  skill_id     uuid not null references skills (id) on delete cascade,
  kind         text not null check (kind in ('multiple_choice', 'numeric', 'short_text', 'ordering')),
  prompt       text not null,
  difficulty   double precision not null check (difficulty between -4 and 4),
  body         jsonb not null,
  hints        jsonb not null default '[]' check (jsonb_typeof(hints) = 'array'),
  explanation  text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index items_skill_active_idx on items (skill_id) where active;
