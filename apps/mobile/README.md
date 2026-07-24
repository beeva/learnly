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

