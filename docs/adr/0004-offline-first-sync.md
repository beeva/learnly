# 4. Offline-first mobile with an operation outbox

Date: 2024-07-29
Status: Accepted

## Context

Many students use shared family devices with patchy connectivity: on buses, in rural
areas, or on prepaid data. The web app assumes it is online, and the mobile app can't.

## Options

1. **Cache GET responses only.** This is simple, but students can't practise offline.
2. **Full CRDT replication.** This is powerful, but heavy and unnecessary: almost every
   write is an append (an attempt), not a concurrent edit.
3. **Operation outbox + idempotent server apply + delta pull.**

## Decision

Option 3. The device records each write as a `SyncOperation` with a client-generated
`opId`. The server keeps `(user_id, op_id)` as a unique key and applies each operation
at most once. Pulls return everything changed since the last cursor.

## Consequences

- Retries are always safe, and a dropped connection can never double-count XP.
- The device runs the same adaptive engine, so offline practice still adapts.
- Lessons are downloaded per unit so students can choose what to keep offline.
