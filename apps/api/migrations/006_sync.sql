-- Offline-first sync: idempotent operation log, known devices, and catalog tombstones.

-- One row per operation a device pushed. The primary key is what makes replays safe:
-- an operation is applied at most once per learner, no matter how often it is retried.
create table sync_operations (
  user_id            uuid not null references users (id) on delete cascade,
  op_id              uuid not null,
  device_id          text not null,
  type               text not null,
  status             text not null check (status in ('applied', 'rejected')),
  reason             text,
  client_created_at  timestamptz not null,
  processed_at       timestamptz not null default now(),
  primary key (user_id, op_id)
);

-- Used by the retention job that prunes operations older than the client retention window.
create index sync_operations_processed_idx on sync_operations (processed_at);

create table devices (
  user_id        uuid not null references users (id) on delete cascade,
  device_id      text not null,
  first_seen_at  timestamptz not null default now(),
  last_sync_at   timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Deleted catalog rows, so devices can drop them from their offline cache.
create table catalog_tombstones (
  entity      text not null,
  entity_id   uuid not null,
  deleted_at  timestamptz not null default now(),
  primary key (entity, entity_id)
);

create index catalog_tombstones_deleted_idx on catalog_tombstones (deleted_at);

create function record_lesson_tombstone() returns trigger
language plpgsql as $$
begin
  insert into catalog_tombstones (entity, entity_id)
  values ('lesson', old.id)
  on conflict (entity, entity_id) do update set deleted_at = now();
  return old;
end;
$$;

create trigger lessons_record_tombstone
  after delete on lessons
  for each row execute function record_lesson_tombstone();

-- Delta pulls scan by modification time.
create index lessons_updated_idx on lessons (updated_at);
