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

## 1.0.0 — 2025-06-27

- Educator classrooms with join codes
- Class insights: completion, struggle hotspots and common misconceptions
- CSV export

## 1.1.0 — 2025-08-15

- Mastery heatmap for educators
- Spanish and Filipino translations
- Streak reminder notifications on mobile, with quiet hours

## 1.2.0 — 2025-10-24

- Adaptive engine v2 (knowledge tracing and spaced review), rolled out at 10%, then 50%, then 100%
- Review sessions for skills that are due
- Nightly calibration of item difficulty

## 1.3.0 — 2026-01-16

- Accessibility pass to WCAG 2.2 AA: focus management, live feedback regions, dynamic type
- Rapid-guessing detection suggests a short break instead of penalising the student

## 1.4.0 — 2026-03-20

- Lesson load under 2s: route-level code splitting, next-lesson prefetch, ETag caching
- Sync hardening: expired operations go to a dead-letter queue and sync status is shown in settings

## 1.5.0 — 2026-05-22

- Product analytics pipeline (`/v1/events`) with batched clients
- Prometheus metrics and readiness checks
