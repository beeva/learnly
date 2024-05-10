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

