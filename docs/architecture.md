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
