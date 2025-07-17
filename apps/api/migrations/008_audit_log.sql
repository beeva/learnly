-- Append-only audit trail for security-relevant and privacy-relevant actions
-- (sign-ins, token reuse, classroom membership, data exports).

create table audit_log (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid references users (id) on delete set null,
  action       text not null,
  target_type  text,
  target_id    text,
  request_id   text,
  ip           text,
  user_agent   text,
  metadata     jsonb not null default '{}'
);

create index audit_log_actor_idx on audit_log (actor_id, occurred_at desc);
create index audit_log_action_idx on audit_log (action, occurred_at desc);

-- The application role may add audit rows but never rewrite history.
revoke update, delete on audit_log from public;
