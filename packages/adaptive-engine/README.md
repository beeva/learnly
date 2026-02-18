# @learnly/adaptive-engine

The pure, dependency-free core that makes Learnly adaptive. It runs on the API
for authoritative updates and on-device in the mobile app for instant, offline
feedback — the same code in both places, so a learner never sees two different
answers to "what should I do next?".

## Model

Learner ability and item difficulty share a logit scale (Rasch / 1PL IRT):

```
P(correct) = 1 / (1 + e^-(ability - difficulty))
```

After every attempt `updateAbility` nudges the estimate by an Elo-style step
whose size shrinks as evidence accumulates. `selectNextItem` then picks the
item whose predicted success is closest to **75%** — hard enough to learn from,
easy enough to stay motivated — while avoiding repeats and gently interleaving skills.

```ts
import { applyAttempt, selectNextItem } from "@learnly/adaptive-engine";

const next = selectNextItem(candidates, masteryBySkill, { recentItemIds });
```

## Engine v2

v2 adds Bayesian Knowledge Tracing for mastery and a spaced-repetition review
schedule. See [docs/engine-v2.md](docs/engine-v2.md) for the design and the
simulation results.

| Module | Purpose |
|---|---|
| `irt.ts` | Rasch probability, ability updates, nightly difficulty calibration |
| `mastery.ts` | Mastery bands and forgetting decay |
| `select.ts` | Next-item selection and adaptive success targets |
| `diagnostic.ts` | Short adaptive placement diagnostic |
| `pacing.ts` | Lesson pacing and rapid-guessing detection |
| `bkt.ts` | Knowledge tracing and per-skill parameter fitting |
| `spaced.ts` | Review intervals and due-skill ranking |
| `v2.ts` | `applyAttemptV2`, combining all of the above |

## Benchmarks

```bash
pnpm --filter @learnly/adaptive-engine bench          # selection latency
pnpm --filter @learnly/adaptive-engine exec tsx bench/simulate.ts   # v1 vs v2
```

Selection over a 1,000-item bank runs in well under a millisecond, so the mobile
app can choose items locally without a network round-trip.
