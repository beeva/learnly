import type { SkillMastery } from "@learnly/shared";
import { bktUpdate, DEFAULT_BKT, type BktParams } from "./bkt.js";
import { updateAbility } from "./irt.js";
import { bandFor } from "./mastery.js";
import { dueAtFrom, nextReview, qualityFromAttempt, type ReviewState } from "./spaced.js";

export interface V2Evidence {
  difficulty: number;
  correct: boolean;
  hintsUsed: number;
  durationMs: number;
  answeredAt: string;
}

export interface V2State {
  mastery: SkillMastery;
  review: ReviewState;
}

/**
 * Engine v2 keeps the Rasch ability (used for picking item difficulty) but
 * derives pKnown from BKT, which handles slips and guesses better, and stamps a
 * spaced-repetition due date on every update.
 */
export function applyAttemptV2(state: V2State, evidence: V2Evidence, params: BktParams = DEFAULT_BKT): V2State {
  const { mastery } = state;
  const { ability } = updateAbility(
    mastery.ability,
    evidence.difficulty,
    evidence.correct,
    mastery.attempts,
    evidence.hintsUsed,
  );
  // A hinted correct answer is weaker evidence: blend toward the prior.
  const bkt = bktUpdate(mastery.pKnown, evidence.correct, params);
  const pKnown = evidence.correct && evidence.hintsUsed > 0 ? (bkt + mastery.pKnown) / 2 : bkt;
  const attempts = mastery.attempts + 1;
  const review = nextReview(
    state.review,
    qualityFromAttempt(evidence.correct, evidence.hintsUsed, evidence.durationMs),
  );
  return {
    review,
    mastery: {
      ...mastery,
      ability,
      pKnown,
      attempts,
      band: bandFor(pKnown, attempts),
      lastPracticedAt: evidence.answeredAt,
      dueAt: dueAtFrom(evidence.answeredAt, review),
    },
  };
}
