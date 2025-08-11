# @learnly/api

The Node.js API behind Learnly's web and mobile apps: accounts, the course catalog,
scoring answers and keeping each learner's mastery estimate up to date.

**Stack:** Node 20 · Express 4 · TypeScript (strict) · PostgreSQL via `pg` (raw SQL, no ORM) ·
zod (schemas shared with the apps through `@learnly/shared`) · JWT access tokens + rotating
refresh tokens · argon2id · pino · vitest + supertest.

## Getting started

```bash
docker compose up -d db          # from the repo root: Postgres 16
cp apps/api/.env.example apps/api/.env
pnpm --filter @learnly/api db:migrate
pnpm --filter @learnly/api db:seed   # courses + demo learner maya@demo.learnly.app / learnly-demo-2024
pnpm --filter @learnly/api dev       # http://localhost:4000
```

| script | what it does |
| --- | --- |
| `dev` | watch mode with pretty logs |
| `test` | unit + HTTP tests against in-memory repositories (no database needed) |
| `typecheck` | `tsc --noEmit` |
| `db:migrate` / `db:status` | apply / list SQL migrations |
| `db:seed` | idempotent seed of courses, lessons, items and demo accounts |

## Layout

```
src/
  config/        env parsing (fails fast on bad config)
  db/            pg pool + typed query helpers, migration manifest, seed content
  lib/           errors, tokens, passwords, scoring, logging
  middleware/    request ids, auth, rate limiting, error envelope
  modules/<feature>/
    repository.ts  SQL in, domain types out
    service.ts     business rules, no HTTP
    routes.ts      validation + HTTP mapping only
    index.ts       registers the feature's services and router
  app.ts         express app + ordered list of feature modules
  container.ts   tiny typed DI container
migrations/      plain SQL, applied in order by scripts/migrate.ts
```

### Services and the container

Every module registers its services in a small typed container (`src/container.ts`).
Modules extend the `Services` interface with module augmentation, so
`req.container.resolve("catalogService")` is fully typed. Tests swap every Postgres
repository for an in-memory one (`test/support/memory.ts`) and exercise the real HTTP
stack with supertest.

### Answers are scored once, the same way everywhere

`scoreResponse(item, response)` in `src/lib/scoring.ts` is pure: numeric answers use the
item's tolerance (and survive `0.1 + 0.2`), short text ignores case, spacing, curly quotes
and a trailing full stop (and forgives one typo in long words), orderings must match exactly.
It also flags *near misses* (a sign slip, an adjacent swap) so the apps can say
"So close — check the last step" instead of "Wrong".

### Errors

Every failure uses one envelope, with messages written to be shown as-is:

```json
{ "error": { "code": "validation_failed", "message": "Some fields need another look.", "details": { } } }
```


## Learning loop

`POST /v1/attempts` runs a small pipeline; each step is a decorator around the previous one:

1. **attempts** — validate, score, record (idempotent on `clientAttemptId`), update mastery
2. **sessions** — attempts inside a session must belong to an open session you own
3. **progress** — XP (`xpForAttempt`: first-try bonus, hint penalty), the daily streak with
   its forgiving freeze, and an encouragement key chosen from what just happened

Sessions are stateless on the server: the next item is recomputed from the answers so far.

- **diagnostic** — the engine's planner probes up to six skills spread across the course,
  stops a skill once two answers agree, and summarises starting points
- **practice** — `selectNextItem` over the next few unlocked skills, aiming for the success
  rate from `adaptiveTarget` (easier after two misses, harder after a hot streak)
- **review** — revisits skills that are going stale

`GET /v1/recommendations` turns mastery, lesson completions and recent pace into
"what next": a lesson at the right level, practice, a review, or the diagnostic.


## Offline sync

The mobile app records every write in a local outbox and pushes it with `POST /v1/sync`.

- Each operation is applied **in its own transaction together with its row in
  `sync_operations`** (primary key `(user_id, op_id)`), so it is applied exactly once no
  matter how many times a flaky connection retries the batch.
- Operations are applied in the order they happened on the device; offline answers keep
  their original `answeredAt`, and a late answer from yesterday never breaks today's streak.
- Business rejections (an item that no longer exists, a finished session) are recorded and
  returned as `rejected` with a reason — on every retry. Server errors fail the request so
  the client retries later.
- The response carries deltas since the client's cursor (a server timestamp): changed
  mastery, changed lessons, and deleted lessons (from `catalog_tombstones`).


## Engine v2

With `ENGINE_VERSION=v2` (the default) mastery uses Bayesian Knowledge Tracing:

- `pKnown` comes from BKT, with guess rates adjusted per item kind (1/k for k choices),
  while the Rasch ability still drives item difficulty;
- every answer reschedules the skill's next review (`skill_review_state`, SM-2 style), and
  review sessions pull what is due with `dueForReview`;
- slip/guess/transit are **fitted per skill every night** from all learners' answer
  sequences (`src/jobs/bkt-fit.ts`), and item difficulties are re-calibrated from first
  attempts using the learner's ability at the time (`src/jobs/calibrate-difficulty.ts`,
  bounded to ±1.5 logits from the author's estimate).

Nightly jobs run at `NIGHTLY_JOBS_HOUR_UTC` on whichever replica claims them first (a partial
unique index on `job_runs` guarantees one running instance). Run them by hand with
`pnpm --filter @learnly/api job [bkt-fit|calibrate-difficulty|retention] [--force]`.

## Educator insights

`GET /v1/classrooms/:id/insights` answers "where are my students struggling?":

- **hotspots** — skills ranked by error rate (≥ 5 attempts), how many students are
  struggling, and the **most common wrong answer** when it clearly dominates
  (≥ 30% of misses) — e.g. “2/8” for “What is 1/4 + 1/4?”;
- **students** — weekly minutes, streak, mastered skills and a deliberately explainable
  `needsAttention` flag: inactive 5+ days, under 50% accuracy over 8+ answers, rapid
  guessing, or stuck on two skills;
- a student × skill **heatmap** and a **CSV export** (formula-injection safe, audited).

Only a classroom's own educator (or an admin) can see its data; anyone else gets a 404.

