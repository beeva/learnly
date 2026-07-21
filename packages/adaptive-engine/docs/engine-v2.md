# Adaptive engine v2

## Why change anything?

Engine v1 derived "is this skill mastered?" directly from the Rasch ability
estimate. It picked well-pitched items, but three things bothered students and educators:

1. **Slow to recognise learning.** The Elo step shrinks as attempts pile up, so a
   student who struggled early and then "got it" stayed in *practicing* for many
   more items than they needed. Students called it "the same question again".
2. **Guessing was invisible.** A correct multiple-choice answer counted the same as
   a correct free-response answer, even though a 1-in-4 guess rate makes it much
   weaker evidence.
3. **No memory model.** Once mastered, a skill was never revisited, so students
   who aced fractions in September had forgotten them by December.

## What v2 does

| Concern | v1 | v2 |
|---|---|---|
| Picking item difficulty | Rasch ability | Rasch ability (unchanged) |
| Mastery probability | `P(correct | ability, reference item)` | Bayesian Knowledge Tracing with per-skill fitted slip/guess/transit |
| Guessing | ignored | `pGuess` scaled by item kind (1/k for multiple choice) |
| Hints | partial Rasch credit | partial credit in both Rasch and BKT |
| Forgetting | none | SM-2-style review schedule + `dueAt` on every skill |

BKT parameters are fitted nightly per skill from the last 90 days of attempts
(`fitBkt`, coarse grid search — sequences are short and grid search is far more
stable than EM on sparse data). Skills with fewer than 200 sequences fall back
to `DEFAULT_BKT`.

## Simulation results

`bench/simulate.ts` runs 5,000 simulated learners per engine. Each learner either knows
the skill or doesn't, has a 15% chance of learning it on each practice item, slips 10% of
the time when they know it, and guesses (25% on multiple choice, 5% on free response) when
they don't:

| Engine | Items to mastery (mean) | Reached mastery within 40 items | Premature mastery |
|---|---|---|---|
| v1 | 24.6 | 58.7% | 0.0% |
| v2 | 8.1 | 99.9% | 3.5% |

v1 was safe but far too slow. It almost never called mastery early, but four in ten
learners who had clearly learned the skill were still being drilled on it after 40 items.
v2 recognises learning about 3× sooner while keeping premature verdicts rare. The review
schedule catches the few early verdicts that turn out to be wrong, because a missed review
item brings the skill straight back.

## Rollout

v2 shipped behind the `ENGINE_VERSION` flag, at 10% → 50% → 100% over three
weeks, with existing mastery migrated by seeding BKT `pKnown` from the v1 value.
