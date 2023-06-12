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

