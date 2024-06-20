<p align="center"><img src="public/favicon.svg" width="72" alt="" /></p>

# @learnly/web

The Learnly web app — **learning that adapts to every student.** A calm diagnostic finds
where each learner starts (**Assess**), short lessons arrive one idea at a time (**Learn**),
practice targets exactly what they need next (**Practice**), and streaks, mastery rings and XP
make the effort visible (**Progress**).

Built with React 18, Vite 5, TypeScript (strict), React Router 6 data routers, TanStack Query 5,
framer-motion and a hand-made design system in plain CSS modules. Types, validation schemas and
copy keys come from [`@learnly/shared`](../../packages/shared), so the web, mobile and API agree
on what a lesson, an attempt or an encouragement message is.

## Quick start

```bash
pnpm install
pnpm --filter @learnly/web dev:mock   # fully working demo, no API needed
pnpm --filter @learnly/web dev        # against the API on :4000 (proxied at /v1)
```

Mock mode (`vite --mode mock` or `VITE_USE_MOCKS=true`) starts an
[MSW](https://mswjs.io) service worker that implements the whole REST contract from
[`tools/API.md`](../../tools/API.md) in the browser. It isn't a stub: item selection and
mastery updates run through the real [`@learnly/adaptive-engine`](../../packages/adaptive-engine),
so practice genuinely adapts while you click around. State persists in `localStorage`;
run `learnlyDemo.reset()` in the console to start over.

| Demo account | Email | Password |
|---|---|---|
| Student (Maya, grades 3–5) | `maya@learnly.app` | `learnly-demo-1` |
| Educator (Ms. Rivera) | `rivera@learnly.app` | `learnly-demo-1` |

The sign-in screen shows one-tap "Continue as demo …" buttons in mock mode.

## Scripts

| Script | What it does |
|---|---|
| `dev` / `dev:mock` | Vite dev server (real API proxy / in-browser mock API) |
| `build` | Type-check, then production build to `dist/` |
| `build:demo` | Production build that ships the mock API — used for the portfolio demo |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:watch` | Vitest + Testing Library in jsdom |
| `e2e` | Playwright smoke and accessibility suite |
| `lint` | ESLint (typescript-eslint, react-hooks, jsx-a11y) |

## How it's put together

```
src/
  main.tsx            composition root: providers, boot tasks, router creation
  app/                router, app shell (sidebar ↔ bottom nav), error screens
  api/                fetch client with token refresh, TanStack Query hooks
  auth/               session context, route guards
  ui/                 design system: components, icons (inline SVG)
  styles/             tokens.css (palette, type, spacing, themes), global.css
  pages/              landing, auth, catalog, home, progress, settings
  features/           diagnostic, lesson player, practice, progress widgets
  i18n/               catalogs and the tiny t() runtime
  mocks/              seed curriculum, mock database, MSW handlers
```

- **The composition root is extensible.** Feature areas append routes to the router's
  route groups and register their own nav items and shell slots, and `main.tsx` collects
  async boot tasks (mock API, catalogs) before creating the router. Adding an area never
  means editing the shell.
- **Pages are code-split per route** with React Router's `lazy`, so the landing page and
  sign-in never download the lesson player.
- **Tokens, not values.** Components only read semantic CSS custom properties
  (`--color-surface`, `--mastery-practicing`, …). Light and dark themes swap those tokens;
  nothing else changes.
- **Warm by design.** "Not yet" is coral, never red. Feedback always explains, hints are
  free, the diagnostic never shows a score and the practice summary celebrates effort.
- **Motion with manners.** framer-motion drives the micro-interactions (XP pops, mastery
  confetti, step reveals), all of which collapse when the OS or the learner's own
  *Reduce motion* setting asks.

### Learner flows

| Screen | Highlights |
|---|---|
| Onboarding (`/welcome`) | Daily-goal picker, grade-matched course choice, reassurance before the check-in |
| Diagnostic (`/assess/:course`) | One question at a time, gentle progress dots, no right/wrong shown, warm "starting points" summary |
| Lesson player (`/lessons/:id`) | Paced steps, worked examples revealed step by step, inline checks that gate progress |
| Practice (`/practice/:course`) | All four item kinds, hints, rationale chip ("why this question"), encouraging feedback, XP pop, mastery celebration, session summary |
| Progress (`/progress`) | Level ring, streak flame with freezes, weekly minutes vs goal, skill mastery map by unit |
| Home (`/home`) | "Continue where you left off", recommended next steps, daily goal ring |

The ordering item works with a mouse, touch, arrow buttons or the keyboard
(Space to pick up, arrows to move, Space to drop, Escape to cancel) and announces every
move to screen readers.

