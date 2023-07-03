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

