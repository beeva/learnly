# Architecture

```
┌──────────────┐     HTTPS/JSON      ┌──────────────────────┐      SQL      ┌────────────┐
│  Web (React) │ ──────────────────▶ │  API (Node/Express)  │ ────────────▶ │  Postgres  │
└──────────────┘                     │  modules/*           │               └────────────┘
                                     │  @learnly/engine     │
                                     └──────────────────────┘
```

- **`@learnly/shared`** is the single source of truth for types and validation.
  The API validates request bodies with the same zod schemas the clients use for forms.
- **`@learnly/adaptive-engine`** is pure TypeScript with no I/O. The API loads mastery
  rows, calls the engine and persists the result in one transaction.
- **API modules** each follow `routes → service → repository`. Routes handle HTTP and
  validation, services hold the business rules, and repositories hold the SQL. No ORM: the
  queries are few and performance-sensitive, and plain SQL keeps them reviewable.

## Data model (core)

`users` → `attempts` → `skill_mastery` (one row per user × skill), and
`courses` → `units` → `skills` → `lessons` / `items`. Item answer keys never leave the API.
Clients receive `PublicItem`, and scoring happens server-side.

## Sessions and the attempt pipeline

```
POST /v1/attempts
  validate (zod) → load item + mastery row FOR UPDATE
  → scoreResponse() → engine.applyAttempt() → xpForAttempt() + advanceStreak()
  → insert attempt, upsert mastery, bump progress  (single transaction)
  → AttemptResult (correct response + explanation + encouragement key)
```

A diagnostic session rebuilds its state from the attempts already in the session,
so the API stays stateless and a student can resume on a different device.

## Offline sync

```
Device                                   API
──────                                   ───
write → SQLite + outbox(opId)
NetInfo online ─────── POST /v1/sync ──▶ for each op (tx):
                                           INSERT sync_operations(user, op_id) ON CONFLICT DO NOTHING
                                           if inserted → apply op
                       ◀── results + cursor + deltas since `since`
apply deltas, drop acked ops
```

- Operations are **idempotent** by `(user_id, op_id)`, so retries are always safe.
- Attempts made offline keep their original `answeredAt`. The server re-applies them in
  timestamp order, so mastery comes out the same as if they had been made online.
- The device shows its own optimistic mastery right away, and the server's authoritative
  values replace it on the next pull.

## Educator insights

Insights are computed from `attempts` joined to `classroom_members` over a time window
(default: last 14 days):

- **Error rate per skill** = incorrect / total attempts. A skill becomes a hotspot when its
  error rate is ≥ 35% and at least 3 students are struggling.
- **Common misconception** = the most frequent wrong response, reported only when it
  accounts for ≥ 30% of wrong answers.
- **Needs attention**: no activity for 5+ days, or accuracy down more than 20 points week over week.

Analytics events (`POST /v1/events`) are batched by the clients and written to an
append-only `analytics_events` table, partitioned by month.

## Production topology

```
CloudFront ── S3 (web assets, immutable hashed files)
     │
     └── ALB ── ECS Fargate (api × 2–6, autoscaled on CPU)
                    │
                    ├── RDS Postgres 16 (Multi-AZ)
                    └── EventBridge schedule → nightly jobs (BKT fit, difficulty calibration)
```

Engine v2 runs behind the `ENGINE_VERSION` flag; see
[engine-v2.md](../packages/adaptive-engine/docs/engine-v2.md).
