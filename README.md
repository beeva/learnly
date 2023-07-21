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
