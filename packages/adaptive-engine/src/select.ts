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

export function selectNextItem(
  candidates: Candidate[],
  masteryBySkill: Map<SkillId, SkillMastery>,
  options: SelectionOptions = {},
): Selection | null {
  const opts = {
    targetSuccess: options.targetSuccess ?? DEFAULT_TARGET_SUCCESS,
    recentItemIds: options.recentItemIds ?? [],
    recentSkillIds: options.recentSkillIds ?? [],
  };
  const random = options.random ?? Math.random;
  const seen = new Set(opts.recentItemIds);
  const pool = candidates.filter((c) => !seen.has(c.id));
  if (pool.length === 0) return null;

  const scored = pool
    .map((c) => ({ c, score: scoreCandidate(c, masteryBySkill.get(c.skillId), opts) }))
    .sort((a, b) => b.score - a.score);

  // Break ties among the top few so learners don't see a predictable sequence.
  const best = scored[0]!.score;
  const shortlist = scored.filter((s) => best - s.score < 0.03).slice(0, 4);
  const chosen = shortlist[Math.floor(random() * shortlist.length)]!.c;
  const mastery = masteryBySkill.get(chosen.skillId);
  const expectedSuccess = probabilityCorrect(mastery?.ability ?? 0, chosen.difficulty);
  return { item: chosen, expectedSuccess, reason: reasonFor(chosen, mastery, expectedSuccess, opts) };
}

function reasonFor(
  item: Candidate,
  mastery: SkillMastery | undefined,
  expected: number,
  opts: { recentSkillIds: SkillId[] },
): SelectionReason {
  if (!mastery || mastery.attempts < 2) return "warmup";
  if (mastery.band === "mastered") return "review";
  const last = opts.recentSkillIds[opts.recentSkillIds.length - 1];
  if (last && last !== item.skillId) return "interleave";
  return expected < 0.65 ? "stretch" : "reinforce";
}

export const REASON_COPY: Record<SelectionReason, string> = {
  warmup: "A warm-up to see where you are.",
  stretch: "A little stretch — you're ready for it.",
  review: "A quick review so it sticks.",
  reinforce: "One more like this to lock it in.",
  interleave: "Mixing it up helps your brain remember.",
};

