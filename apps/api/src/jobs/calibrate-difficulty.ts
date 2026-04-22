import { calibrateDifficulty, clamp } from "@learnly/adaptive-engine";
import type { Clock } from "../lib/clock.js";
import type { Logger } from "../lib/logger.js";
import type { JobRepository } from "./repository.js";

export const CALIBRATION_RULES = {
  lookbackDays: 180,
  minResponses: 30,
  maxResponses: 5_000,
  /** Never drift further than this from the author's estimate without a human look. */
  maxShift: 1.5,
  /** Ignore changes too small to affect item selection. */
  minChange: 0.05,
} as const;

export type CalibrationRules = { [K in keyof typeof CALIBRATION_RULES]: number };

export interface CalibrationDeps {
  jobs: JobRepository;
  clock: Clock;
  logger: Logger;
}

export interface CalibrationSummary {
  [key: string]: unknown;
  calibrated: number;
  unchanged: number;
  capped: number;
}

/**
 * Nightly: re-estimate each item's Rasch difficulty from first attempts, using each
 * learner's ability *at the time they answered* (stored on the attempt).
 */
export async function runDifficultyCalibration(
  deps: CalibrationDeps,
  rules: CalibrationRules = CALIBRATION_RULES,
): Promise<CalibrationSummary> {
  const now = deps.clock.now();
  const since = new Date(now.getTime() - rules.lookbackDays * 86_400_000).toISOString();
  const summary: CalibrationSummary = { calibrated: 0, unchanged: 0, capped: 0 };

  for (const target of await deps.jobs.itemsWithResponses(since, rules.minResponses)) {
    const responses = await deps.jobs.responsesForItem(target.itemId, since, rules.maxResponses);
    if (responses.length < rules.minResponses) {
      summary.unchanged += 1;
      continue;
    }
    const estimate = calibrateDifficulty(target.authored, responses);
    const bounded = clamp(estimate, target.authored - rules.maxShift, target.authored + rules.maxShift);
    if (bounded !== estimate) {
      summary.capped += 1;
      deps.logger.warn({ itemId: target.itemId, authored: target.authored, estimate }, "item difficulty far from authored value");
    }
    if (Math.abs(bounded - target.current) < rules.minChange) {
      summary.unchanged += 1;
      continue;
    }
    await deps.jobs.saveItemDifficulty(target.itemId, Math.round(bounded * 1000) / 1000, responses.length, now.toISOString());
    summary.calibrated += 1;
  }
  return summary;
}
