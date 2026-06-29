/**
 * Offline evaluation harness. Each simulated learner has a hidden knowledge state:
 * they either know the skill or they don't, and each practice opportunity gives
 * them a chance to learn it. Knowers still slip; non-knowers can guess (easily on
 * multiple choice, rarely on free response). We then measure how many items each
 * engine version needs before declaring mastery, and how often that verdict comes
 * while the learner still hasn't actually learned the skill.
 *
 *   pnpm --filter @learnly/adaptive-engine exec tsx bench/simulate.ts
 */
import type { SkillId } from "@learnly/shared";
import { paramsForItem, DEFAULT_BKT } from "../src/bkt.js";
import { applyAttempt, initialMastery } from "../src/mastery.js";
import { INITIAL_REVIEW } from "../src/spaced.js";
import { applyAttemptV2 } from "../src/v2.js";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEARN_RATE = 0.15;
const SLIP = 0.1;
const MAX_ITEMS = 40;

interface Outcome {
  itemsToMastery: number | null;
  premature: boolean;
}

function simulate(version: "v1" | "v2", seed: number): Outcome {
  const random = mulberry32(seed);
  const skillId = "sim-skill" as SkillId;
  let knows = random() < 0.15;
  let v1 = initialMastery(skillId);
  let v2 = { mastery: { ...initialMastery(skillId), pKnown: DEFAULT_BKT.pInit }, review: INITIAL_REVIEW };
  for (let n = 1; n <= MAX_ITEMS; n++) {
    const multipleChoice = random() < 0.5;
    const guess = multipleChoice ? 0.25 : 0.05;
    const correct = random() < (knows ? 1 - SLIP : guess);
    const difficulty = 0.5 + (random() - 0.5);
    const evidence = {
      difficulty,
      correct,
      hintsUsed: 0,
      durationMs: 30_000,
      answeredAt: new Date(Date.UTC(2025, 5, 1) + n * 3_600_000).toISOString(),
    };
    if (version === "v1") {
      v1 = applyAttempt(v1, evidence);
    } else {
      const params = paramsForItem(DEFAULT_BKT, multipleChoice ? "multiple_choice" : "numeric", 4);
      v2 = applyAttemptV2(v2, evidence, params);
    }
    const band = version === "v1" ? v1.band : v2.mastery.band;
    if (band === "mastered") return { itemsToMastery: n, premature: !knows };
    if (!knows && random() < LEARN_RATE) knows = true;
  }
  return { itemsToMastery: null, premature: false };
}

for (const version of ["v1", "v2"] as const) {
  const runs = Array.from({ length: 5000 }, (_, i) => simulate(version, i + 1));
  const reached = runs.filter((r) => r.itemsToMastery !== null);
  const mean = reached.reduce((s, r) => s + r.itemsToMastery!, 0) / reached.length;
  const premature = reached.filter((r) => r.premature).length / reached.length;
  console.log(
    `${version}: ${mean.toFixed(1)} items to mastery, ` +
      `${((reached.length / runs.length) * 100).toFixed(1)}% reached within ${MAX_ITEMS}, ` +
      `${(premature * 100).toFixed(1)}% premature`,
  );
}
