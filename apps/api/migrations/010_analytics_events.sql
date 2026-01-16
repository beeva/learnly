-- Product analytics events, batched from the apps. Kept deliberately small: no free text,
-- primitive props only, and user ids are nulled if the account is deleted.

create table analytics_events (
  id           bigserial primary key,
  user_id      uuid references users (id) on delete set null,
  name         text not null check (name ~ '^[a-z][a-z0-9_.]{1,63}$'),
  occurred_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  props        jsonb not null default '{}'
);

create index analytics_events_name_time_idx on analytics_events (name, occurred_at);
-- Append-only and time-ordered: a BRIN index is tiny and ideal for retention deletes.
create index analytics_events_received_brin on analytics_events using brin (received_at);
