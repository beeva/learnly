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

