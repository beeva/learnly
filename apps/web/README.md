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

### Educator area

Educators get `/teach`: create a class (with a 6-character join code students type at
`/join`), then open class insights — completion rate, average minutes, a mastery
distribution chart, **hotspots** (the skills with the most errors and the misconception
behind them), a students × skills **mastery heatmap**, a sortable student list with a
*needs attention* filter, and one-click **CSV export**.

### Offline

A small service worker (`public/sw.js`) caches the app shell and, stale-while-revalidate,
every lesson and course a learner opens. Lesson completions and preference changes made
offline go into an outbox and are pushed to `POST /v1/sync` with exponential backoff —
the same envelope the mobile app uses — while a banner shows what's waiting to sync.

### Internationalisation

English, Spanish and Filipino. Copy lives in typed catalogs (`src/i18n/messages`); the
compiler refuses a locale that is missing a key, and a test checks placeholders match.
Non-English catalogs are separate chunks loaded on demand. Encouragement messages are
keyed in `@learnly/shared`, so a "So close — check the last step" reads naturally in
every language.

### Accessibility (WCAG 2.2 AA)

Skip link, focus moved to each page's heading on navigation (with the title announced),
live regions for feedback and background events, visible focus rings in both themes,
44px touch targets, `prefers-contrast` and forced-colors token overrides, full keyboard
support everywhere including drag-to-reorder, and real table semantics for the heatmap.
Every screen is checked with axe in the Playwright suite.

### Performance

The product promise is **lesson load under two seconds**. Route chunks and lesson data
are prefetched on hover, focus or touch of a link; the recommended next lesson is
prefetched while the learner is on home; vendor code is split (`react`, `router`,
`query`, `motion`, `charts`) so lessons never wait on chart code; and every lesson load
is timed from navigation to first render and reported as a `lesson_load` event.

### Analytics

Product events are derived from mutations (answers, lessons, sessions) rather than
sprinkled through screens, batched, and sent to `POST /v1/events`, with a `keepalive`
flush when the page is hidden. Props are primitives only — no names or answers — and
Do Not Track / Global Privacy Control turn analytics off entirely.

## Testing

```bash
pnpm --filter @learnly/web test   # unit + integration (MSW node server, mock db)
pnpm --filter @learnly/web e2e    # Playwright: learner + educator smoke, axe checks
```

Integration tests run against the same MSW handlers and adaptive engine as mock mode,
so they exercise real request/response shapes instead of hand-rolled fakes.

## Screenshots

> Captured from `pnpm dev:mock` at 1440×900 and on a 390×844 phone, light and dark.

1. **Landing** — an indigo-to-coral hero ("Learning that *adapts* to every student")
   beside a floating product preview: a fraction question card with a correct answer
   glowing mint, a 12-day streak chip, a "Mastered · Simplify fractions" ring and a
   "+15 XP" pill drifting gently.
2. **Home** — "Good afternoon, Maya", three stat cards (level ring, flickering streak
   flame with a snowflake freeze, today's goal ring) and a gradient "Continue where you
   left off" card for *Same amount, different names*, with up-next rows below.
3. **Practice** — an ordering question mid-drag, the lifted row casting a soft shadow,
   segmented progress pills across the top and an amber rationale chip reading
   "A little stretch — you're ready for it."
4. **Feedback** — the mint "You're on a roll — 3 in a row!" panel with its "+15 XP" pop,
   and beside it the coral "So close — check the last step." variant with the
   explanation expanded.
5. **Mastery moment** — confetti bursting behind a trophy card: "You've mastered Find
   equivalent fractions!"
6. **Progress** — the level ring, a week of indigo bars against a dashed goal line, and
   the skill mastery map with tiles shading from grey through coral and lavender to mint.
7. **Educator insights** — Period 2 · Fractions: completion ring, hotspot list led by
   *Add fractions with like denominators* and its misconception callout, and the
   mastery heatmap with sticky student names.
8. **Dark mode & mobile** — the same home screen in the ink-and-indigo dark theme with
   the bottom navigation bar, and the lesson player's worked example revealing step two.
