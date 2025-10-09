/**
 * One-parameter logistic (Rasch) model. Ability and difficulty share a logit
 * scale, so a student whose ability equals an item's difficulty has a 50% chance
 * of answering it correctly.
 */
export function probabilityCorrect(ability: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(ability - difficulty)));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const ABILITY_RANGE = { min: -4, max: 4 } as const;

/**
 * The step size shrinks as we see more evidence: early answers move the estimate a
 * lot (so the diagnostic converges in a handful of items), later ones fine-tune it.
 */
export function kFactor(attempts: number): number {
  return clamp(1.2 / Math.sqrt(1 + attempts * 0.6), 0.15, 1.2);
}

export interface AbilityUpdate {
  ability: number;
  expected: number;
  surprise: number;
}

export function updateAbility(
  ability: number,
  difficulty: number,
  correct: boolean,
  attempts: number,
  hintsUsed = 0,
): AbilityUpdate {
  const expected = probabilityCorrect(ability, difficulty);
  // A correct answer that needed hints is partial evidence of mastery.
  const observed = correct ? Math.max(0.55, 1 - hintsUsed * 0.15) : 0;
  const surprise = observed - expected;
  const next = clamp(ability + kFactor(attempts) * surprise, ABILITY_RANGE.min, ABILITY_RANGE.max);
  return { ability: next, expected, surprise };
}

/**
 * Re-calibrates an item's difficulty from logged responses using a few Newton
 * iterations of the Rasch likelihood, with a weak prior toward the authored value
 * so a handful of responses can't swing a new item wildly.
 */
export function calibrateDifficulty(
  authored: number,
  responses: { ability: number; correct: boolean }[],
  priorWeight = 4,
): number {
  let b = authored;
  for (let iter = 0; iter < 20; iter++) {
    let gradient = (authored - b) * (1 / priorWeight);
    let hessian = -1 / priorWeight;
    for (const r of responses) {
      const p = probabilityCorrect(r.ability, b);
      gradient += p - (r.correct ? 1 : 0);
      hessian -= p * (1 - p);
    }
    const step = gradient / hessian;
    b = clamp(b - step, -4, 4);
    if (Math.abs(step) < 1e-4) break;
  }
  return b;
}
