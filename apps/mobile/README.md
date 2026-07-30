# @learnly/mobile

The Learnly app for iOS and Android — "learning that adapts to every student",
in your pocket and on the bus with no signal. Built with Expo SDK 51,
expo-router and TypeScript, sharing its domain model with the web app and API
through `@learnly/shared` and running the same adaptive engine
(`@learnly/adaptive-engine`) on device.

## Getting started

```bash
pnpm install                       # from the repo root
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @learnly/mobile start
```

Press `i` / `a` for a simulator, or scan the QR code with a development build.
`EXPO_PUBLIC_API_URL` points the app at a local API (`pnpm --filter @learnly/api dev`).

| script | what it does |
|---|---|
| `start` | Metro + dev server |
| `ios` / `android` | native run (requires a dev client) |
| `typecheck` | `tsc --noEmit` under `strict` + `noUncheckedIndexedAccess` |
| `test` | jest-expo unit and component tests |
| `build:preview` / `build:production` | EAS builds (see below) |

## Project tour

```
app/                      expo-router routes
  (auth)/                 sign in, sign up
  (tabs)/                 Home, Learn, Progress, Profile
  course/[slug]           units, skills, lessons, offline download
  lesson/[id]             lesson player — every LessonBlock kind
  diagnostic/[slug]       light placement check (no grades, no timer)
  practice/[slug]         adaptive practice, online or offline
  settings, join-classroom, sync-status, downloads
src/
  theme/                  tokens mirroring the web palette, light/dark, reduced motion
  components/             Button, Card, TextField, ProgressRing/Bar, Chip, Skeleton,
                          Toast, OfflineBanner, ItemView, FeedbackSheet, LessonBlocks…
  lib/api.ts              typed client for tools/API.md, secure tokens, refresh rotation
  db/                     expo-sqlite schema, migrations, repositories
  sync/                   outbox, sync engine, hardening (dead letters, expiry)
  offline/                offline-first queries, downloads, local scoring + selection
  i18n/                   copy defaults + es / fil catalogs
  notifications/          streak reminders with quiet hours
  analytics/              batched product analytics → POST /v1/events
```

Assets are authored as SVG (`assets/*.svg`); export the PNGs referenced by
`app.config.ts` with `npx @expo/image-utils` or any SVG rasteriser before a
store build (1024² icon, 1284×2778 splash, 96² monochrome notification icon).

## Offline-first, by design

Learners lose connectivity all the time — in basements, on buses, on school
wifi that blocks half the internet. Nothing in Learnly should care.

```
 answer ──► submitAnswer ──online──► POST /v1/attempts ──► AttemptResult
                │                              (answer key + mastery cached)
                └─offline / network error──► local scoring (cached key)
                                              applyAttempt() optimistic mastery
                                              outbox ◄── SyncOperation
 NetInfo / foreground / new write ──► SyncEngine.flush()
       batches of ≤200 ──► POST /v1/sync ──► SyncResponse
       results: applied|duplicate → delete · rejected → dead letter
       deltas: mastery, lessons, progress → SQLite
```

- **Every write is an operation.** Attempts, lesson completions and preference
  changes become `SyncOperation`s validated with the shared `syncOperationSchema`
  and stored in the SQLite outbox with a client `opId`, so retries are idempotent.
- **One flush at a time**, oldest first, at most 200 ops per request, looping
  until drained. An empty outbox still pulls deltas.
- **Backoff** uses the shared `syncBackoffMs` (exponential, full jitter, 5 min cap);
  reconnecting resets it immediately.
- **Conflict safety.** The server is the source of truth for mastery. Optimistic
  changes are never written over server rows — they are *replayed* on read from
  unconfirmed outbox attempts, so a delta landing mid-session can't erase them
  and can't double count them either.
- **Crash safety.** In-flight ops return to pending on launch; the server dedupes.
- **Offline practice** picks items with the engine's `selectNextItem` over cached
  items, preferring ones whose answer key is known locally so feedback stays
  instant. Unknown keys are saved and scored on sync ("we'll check this one").
- **Dead letters.** Rejected ops, ops older than `SYNC_RETENTION_DAYS`
  (`isExpiredOperation`) and ops that exhaust their retry budget move to a
  dead-letter state. They're shown under *Settings → Sync & offline data* with
  retry and remove — the learner's work is never dropped silently.

Downloaded lessons open straight from SQLite (and their images from the
expo-image disk cache), which keeps lesson load well under the 2-second budget
even on slow devices. After each sync the next recommended lessons are warmed
in the background.

