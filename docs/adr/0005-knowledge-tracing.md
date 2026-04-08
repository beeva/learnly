# 5. Add Bayesian Knowledge Tracing and spaced review (engine v2)

Date: 2025-08-04
Status: Accepted

## Context

Students reported getting "the same question again" long after they had understood a
skill. Teachers reported "mastered" skills that students couldn't do a month later.
Engine v1 also treated a lucky multiple-choice guess as the same evidence as a worked answer.

## Decision

Keep the Rasch ability for choosing item difficulty. Derive `pKnown` from BKT with
per-skill parameters fitted nightly, and schedule reviews with an SM-2 variant. Roll
out behind `ENGINE_VERSION` with existing mastery migrated.

## Consequences

In simulation, v2 recognises mastery after 8.1 items on average, compared with 24.6 for v1.
Premature verdicts stay at 3.5%, and spaced review catches them. Review sessions are now
a first-class session kind.
