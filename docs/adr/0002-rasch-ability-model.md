# 2. Model ability with Rasch (1PL IRT) and Elo-style updates

Date: 2023-06-12
Status: Accepted

## Context

To adapt difficulty, we need to know how hard each item is for each learner. Full IRT
calibration needs thousands of responses per item, and at launch we have none.

## Decision

- Items get an authored difficulty on a logit scale (-3 … +3).
- Each learner has an ability estimate per skill, updated after every attempt with an
  Elo-style step whose K-factor shrinks as evidence accumulates.
- Next-item selection targets a 75% predicted success rate.

## Consequences

- It works from day one with authored difficulties, and calibration can come later.
- Mastery read straight from ability is sensitive to lucky streaks. We'll revisit this
  once we have data.
