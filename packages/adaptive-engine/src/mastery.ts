import type { MasteryBand, SkillId, SkillMastery } from "@learnly/shared";
import { probabilityCorrect, updateAbility } from "./irt.js";

/** Difficulty of a "typical" grade-level item; mastery means handling it reliably. */
export const REFERENCE_DIFFICULTY = 0.5;

export const BAND_THRESHOLDS = {
  learning: 0.35,
  practicing: 0.6,
  mastered: 0.85,
} as const;

export function bandFor(pKnown: number, attempts: number): MasteryBand {
  if (attempts === 0) return "new";
  if (pKnown >= BAND_THRESHOLDS.mastered && attempts >= 4) return "mastered";
  if (pKnown >= BAND_THRESHOLDS.practicing) return "practicing";
  return "learning";
}

export function initialMastery(skillId: SkillId, ability = 0): SkillMastery {
  return {
    skillId,
    ability,
    pKnown: probabilityCorrect(ability, REFERENCE_DIFFICULTY),
    band: "new",
    attempts: 0,
    lastPracticedAt: null,
    dueAt: null,
  };
}

export interface AttemptEvidence {
  difficulty: number;
  correct: boolean;
  hintsUsed: number;
  answeredAt: string;
}

export function applyAttempt(state: SkillMastery, evidence: AttemptEvidence): SkillMastery {
  const { ability } = updateAbility(
    state.ability,
    evidence.difficulty,
    evidence.correct,
    state.attempts,
    evidence.hintsUsed,
  );
  const attempts = state.attempts + 1;
  const pKnown = probabilityCorrect(ability, REFERENCE_DIFFICULTY);
  return {
    ...state,
    ability,
    pKnown,
    attempts,
    band: bandFor(pKnown, attempts),
    lastPracticedAt: evidence.answeredAt,
  };
}

/**
 * Memory fades. Without practice, we slowly pull pKnown toward the band below so the
 * scheduler surfaces the skill again — but never below the learner's demonstrated
 * floor, so a returning student isn't sent back to square one.
 */
export function decayedPKnown(state: SkillMastery, now: Date, halfLifeDays = 21): number {
  if (!state.lastPracticedAt) return state.pKnown;
  const days = (now.getTime() - Date.parse(state.lastPracticedAt)) / 86_400_000;
  if (days <= 0) return state.pKnown;
  const floor = Math.min(state.pKnown, BAND_THRESHOLDS.learning);
  const retained = Math.pow(0.5, days / halfLifeDays);
  return floor + (state.pKnown - floor) * retained;
}
