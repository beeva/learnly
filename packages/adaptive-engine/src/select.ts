import type { ItemId, SkillId, SkillMastery } from "@learnly/shared";
import { probabilityCorrect } from "./irt.js";

export interface Candidate {
  id: ItemId;
  skillId: SkillId;
  difficulty: number;
}

export interface SelectionOptions {
  /**
   * Desired probability of success. ~0.75 keeps practice in the "desirable
   * difficulty" zone: challenging, but with enough wins to stay motivated.
   */
  targetSuccess?: number;
  /** Items answered in this session (most recent last) — never repeat these. */
  recentItemIds?: ItemId[];
  /** Skills seen in the last few items, used to interleave practice. */
  recentSkillIds?: SkillId[];
  random?: () => number;
}

export interface Selection {
  item: Candidate;
  expectedSuccess: number;
  reason: SelectionReason;
}

export type SelectionReason = "warmup" | "stretch" | "review" | "reinforce" | "interleave";

export const DEFAULT_TARGET_SUCCESS = 0.75;

function scoreCandidate(
  candidate: Candidate,
  mastery: SkillMastery | undefined,
  options: Required<Omit<SelectionOptions, "random">>,
): number {
  const ability = mastery?.ability ?? 0;
  const p = probabilityCorrect(ability, candidate.difficulty);
  let score = -Math.abs(p - options.targetSuccess);
  const recentIndex = options.recentSkillIds.lastIndexOf(candidate.skillId);
  if (recentIndex >= 0) {
    // Gently prefer switching skills; same-skill blocks feel easy but stick less.
    const distance = options.recentSkillIds.length - recentIndex;
    score -= 0.08 / distance;
  }
  if (mastery?.band === "mastered") score -= 0.05;
  return score;
}

