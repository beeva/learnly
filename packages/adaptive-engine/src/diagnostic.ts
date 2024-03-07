import type { MasteryBand, SkillId, SkillMastery } from "@learnly/shared";
import { BAND_THRESHOLDS, initialMastery, applyAttempt } from "./mastery.js";
import type { Candidate } from "./select.js";
import { probabilityCorrect } from "./irt.js";

/**
 * The diagnostic is deliberately short ("light"): a few items per skill, chosen
 * at the difficulty that is most informative for the current estimate, and it
 * stops early once the estimate for a skill is confident.
 */
export interface DiagnosticState {
  skillOrder: SkillId[];
  mastery: Map<SkillId, SkillMastery>;
  askedItemIds: Set<string>;
  perSkillAnswers: Map<SkillId, boolean[]>;
}

export const DIAGNOSTIC_LIMITS = {
  maxPerSkill: 3,
  minPerSkill: 1,
  maxTotal: 12,
} as const;

export function startDiagnostic(skillIds: SkillId[]): DiagnosticState {
  return {
    skillOrder: [...skillIds],
    mastery: new Map(skillIds.map((id) => [id, initialMastery(id)])),
    askedItemIds: new Set(),
    perSkillAnswers: new Map(skillIds.map((id) => [id, []])),
  };
}

