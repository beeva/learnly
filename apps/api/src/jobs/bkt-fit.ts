import { fitBkt } from "@learnly/adaptive-engine";
import type { Clock } from "../lib/clock.js";
import type { Logger } from "../lib/logger.js";
import type { BktParamsRepository } from "../modules/engine-v2/repository.js";
import type { JobRepository } from "./repository.js";

export const BKT_FIT_RULES = {
  lookbackDays: 120,
  /** Fewer learners than this and the fit chases noise; the skill keeps the defaults. */
  minLearners: 20,
  maxLearners: 2_000,
  /** A single answer says nothing about learning between opportunities. */
  minSequenceLength: 2,
} as const;

export type BktFitRules = { [K in keyof typeof BKT_FIT_RULES]: number };

export interface BktFitDeps {
  jobs: JobRepository;
  bktParams: BktParamsRepository;
  clock: Clock;
  logger: Logger;
}

export interface BktFitSummary {
  [key: string]: unknown;
  fitted: number;
  skipped: number;
  learners: number;
}

/** Nightly: refit slip, guess and transit for every skill with enough recent data. */
export async function runBktFit(deps: BktFitDeps, rules: BktFitRules = BKT_FIT_RULES): Promise<BktFitSummary> {
  const now = deps.clock.now();
  const since = new Date(now.getTime() - rules.lookbackDays * 86_400_000).toISOString();
  const summary: BktFitSummary = { fitted: 0, skipped: 0, learners: 0 };

  for (const skillId of await deps.jobs.skillsWithAnswers(since)) {
    const sequences = (await deps.jobs.answerSequences(skillId, since, rules.maxLearners)).filter(
      (sequence) => sequence.length >= rules.minSequenceLength,
    );
    if (sequences.length < rules.minLearners) {
      summary.skipped += 1;
      continue;
    }
    const params = fitBkt(sequences);
    const observations = sequences.reduce((sum, sequence) => sum + sequence.length, 0);
    await deps.bktParams.save(skillId, params, { learners: sequences.length, observations }, now.toISOString());
    deps.logger.debug({ skillId, params, learners: sequences.length }, "bkt parameters fitted");
    summary.fitted += 1;
    summary.learners += sequences.length;
  }
  return summary;
}
