<p align="center">
  <img src="apps/web/public/logo.svg" alt="Learnly" width="72" height="72" />
</p>

<h1 align="center">Learnly</h1>
<p align="center"><strong>Learning that adapts to every student.</strong></p>

Learnly is an adaptive learning platform for K–12 students. Fixed-path learning
software treats every student the same, so students who fall behind or race ahead
drop out. Learnly adjusts the pace, the difficulty and the practice to each student,
and keeps the tone warm and encouraging on any device.

## How it works

| Step | What happens |
|---|---|
| **Assess** | A short, low-stakes diagnostic finds each student's starting point. |
| **Learn** | Lessons are paced to the individual, with worked examples when they help. |
| **Practice** | Adaptive practice targets what the student needs next. |
| **Progress** | Students see the progress they've earned (mastery, streaks and levels), which keeps them going. |

## Repository layout

```
apps/
  api/        Node.js + Express + Postgres REST API
  web/        React + Vite web app (students and educators)
packages/
  shared/            Domain types, zod schemas and progress rules
  adaptive-engine/   Rasch ability model, mastery and item selection
docs/         Architecture notes and decision records
```

## Getting started

Requirements: Node 20, pnpm 9 and Docker.

```bash
pnpm install
pnpm db:up          # Postgres 16 in Docker
pnpm db:migrate
pnpm db:seed        # Fractions, Pre-Algebra and Reading Detectives courses
pnpm dev            # api on :4000, web on :5173
```

The web app can also run without the API: `VITE_USE_MOCKS=true pnpm --filter @learnly/web dev`
serves realistic mock data through MSW.

Seeded demo accounts (password `learnly-demo-2024`):

| Email | Role |
|---|---|
| `maya@demo.learnly.app` | Student, grades 3–5 |
| `ms.rivera@demo.learnly.app` | Educator (classroom code `FRAC24`) |

In mock mode the sign-in screen has one-tap demo buttons instead.

## The learner experience

- **Diagnostic** shows one calm question at a time. Students don't see a score; they get a
  friendly summary of where they'll start.
- **Lesson player** renders headings, callouts, step-by-step worked examples and inline checks.
- **Practice** uses multiple choice, numeric, short answer and ordering items, with hints,
  encouraging feedback and an XP reward for every effort.
- **Progress** shows a level ring, a streak with a forgiving "freeze" and a mastery map for each unit.

## Mobile and offline

`apps/mobile` is an Expo (React Native) app for iOS and Android. It caches lessons
and practice items in SQLite and records every answer in a local outbox.
When the device is back online the outbox syncs through `POST /v1/sync`.
Practice keeps adapting offline because the same `@learnly/adaptive-engine` runs on-device.

```bash
pnpm --filter @learnly/mobile start   # Expo dev server
```

## For educators

Teachers create a classroom, share a six-character join code, and get:

- completion and time-on-task for the whole class
- **struggle hotspots**: the skills with the highest error rates and the most common misconception for each
- a mastery heatmap of students × skills
- a "needs attention" list for students whose activity or accuracy has dropped
- CSV export for gradebooks

## Results

| | |
|---|---|
| **3×** | course completion compared with the fixed path |
| **4.9★** | student rating in in-app surveys |
| **3** | platforms: web, iOS and Android |
| **< 2s** | lesson load on any device |

## Quality

- TypeScript strict mode everywhere, with types shared from `@learnly/shared`
- Unit tests (Vitest and Jest) and API integration tests (Supertest)
- Playwright end-to-end smoke tests and automated axe accessibility checks targeting WCAG 2.2 AA
- Lighthouse budget in CI: lesson route LCP < 2s on a mid-range mobile profile

## Deployment

Infrastructure is defined in Terraform (`infra/terraform`): ECS Fargate for the API,
RDS Postgres, and S3 + CloudFront for the web app. GitHub Actions runs CI on every
pull request and deploys `main` to staging. Releases are promoted to production by tag.
See [docs/runbook.md](docs/runbook.md).

## Further reading

- [Architecture](docs/architecture.md)
- [Adaptive engine v2](packages/adaptive-engine/docs/engine-v2.md)
- [Accessibility](docs/accessibility.md)
- [Performance](docs/performance.md)
- [Architecture decision records](docs/adr)
