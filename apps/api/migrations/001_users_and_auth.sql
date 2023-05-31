-- Accounts, per-learner preferences and rotating refresh tokens.

create table users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  password_hash  text not null,
  display_name   text not null check (char_length(display_name) between 1 and 60),
  role           text not null default 'student' check (role in ('student', 'educator', 'admin')),
  grade_band     text check (grade_band in ('k-2', '3-5', '6-8', '9-12')),
  avatar_color   text not null default '#5B5BD6' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  locale         text not null default 'en',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Emails are compared case-insensitively everywhere.
create unique index users_email_key on users (lower(email));

create table user_preferences (
  user_id             uuid primary key references users (id) on delete cascade,
  daily_goal_minutes  smallint not null default 15 check (daily_goal_minutes between 5 and 120),
  reduced_motion      boolean not null default false,
  sound_effects       boolean not null default true,
  updated_at          timestamptz not null default now()
);

-- Refresh tokens rotate on every use. All tokens descended from one sign-in share a
-- family_id; presenting an already-rotated token revokes the whole family.
create table refresh_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  family_id       uuid not null,
  token_hash      text not null unique,
  user_agent      text,
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  rotated_at      timestamptz,
  revoked_at      timestamptz,
  revoked_reason  text
);

create index refresh_tokens_family_idx on refresh_tokens (family_id);
create index refresh_tokens_user_idx on refresh_tokens (user_id);
create index refresh_tokens_expiry_idx on refresh_tokens (expires_at) where revoked_at is null;
