# Changelog

All notable changes to Learnly are listed here, oldest release first.

## 0.1.0 — 2023-10-20

- Monorepo with the API, the web app, shared types and the adaptive engine
- Email and password accounts with refresh-token rotation
- Course catalog with Fractions Foundations, Pre-Algebra and Reading Detectives
- Rasch-based ability estimates and next-item selection (engine v1)
- Web design system and app shell, with light and dark themes

## 0.2.0 — 2024-06-18

- Placement diagnostic: short and adaptive, with no scores shown
- Lesson player with worked examples and inline checks
- Adaptive practice for all four item types, with hints and encouraging feedback
- XP, levels and streaks (with a one-day freeze)
- Progress page and home recommendations

## 0.3.0 — 2024-10-29

- iOS and Android app (Expo)
- Offline-first: lessons downloaded to SQLite, answers queued in an outbox
- `POST /v1/sync` with idempotent operations and delta pulls
- On-device item selection while offline
- Web: installable PWA with offline lesson caching
