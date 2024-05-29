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

function isSkillSettled(answers: boolean[]): boolean {
  if (answers.length >= DIAGNOSTIC_LIMITS.maxPerSkill) return true;
  if (answers.length < 2) return false;
  // Two of the same answer in a row is enough signal for a light diagnostic.
  return answers[answers.length - 1] === answers[answers.length - 2];
}

function totalAsked(state: DiagnosticState): number {
  return state.askedItemIds.size;
}

export function nextDiagnosticItem(state: DiagnosticState, items: Candidate[]): Candidate | null {
  if (totalAsked(state) >= DIAGNOSTIC_LIMITS.maxTotal) return null;
  for (const skillId of state.skillOrder) {
    const answers = state.perSkillAnswers.get(skillId) ?? [];
    if (isSkillSettled(answers)) continue;
    const ability = state.mastery.get(skillId)?.ability ?? 0;
    // Maximum information for the Rasch model is where p = 0.5.
    const pool = items.filter((i) => i.skillId === skillId && !state.askedItemIds.has(i.id));
    if (pool.length === 0) continue;
    return pool.reduce((best, item) =>
      Math.abs(probabilityCorrect(ability, item.difficulty) - 0.5) <
      Math.abs(probabilityCorrect(ability, best.difficulty) - 0.5)
        ? item
        : best,
    );
  }
  return null;
}

export function recordDiagnosticAnswer(
  state: DiagnosticState,
  item: Candidate,
  correct: boolean,
  answeredAt: string,
): DiagnosticState {
  const current = state.mastery.get(item.skillId) ?? initialMastery(item.skillId);
  const mastery = new Map(state.mastery);
  mastery.set(
    item.skillId,
    applyAttempt(current, { difficulty: item.difficulty, correct, hintsUsed: 0, answeredAt }),
  );
  const perSkillAnswers = new Map(state.perSkillAnswers);
  perSkillAnswers.set(item.skillId, [...(perSkillAnswers.get(item.skillId) ?? []), correct]);
  return {
    ...state,
    mastery,
    perSkillAnswers,
    askedItemIds: new Set([...state.askedItemIds, item.id]),
  };
}

export interface StartingPoint {
  skillId: SkillId;
  band: MasteryBand;
  pKnown: number;
}

export function summarizeDiagnostic(state: DiagnosticState): StartingPoint[] {
  return state.skillOrder.map((skillId) => {
    const m = state.mastery.get(skillId)!;
    return { skillId, band: m.band, pKnown: m.pKnown };
  });
}

/**
 * First skill (in curriculum order) the learner hasn't shown they can practise yet.
 * Skills already in the "practicing" range are refined by practice, not re-taught.
 */
export function recommendedStartSkill(points: StartingPoint[]): SkillId | null {
  return points.find((p) => p.pKnown < BAND_THRESHOLDS.practicing)?.skillId ?? null;
}
