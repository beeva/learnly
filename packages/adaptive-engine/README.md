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
