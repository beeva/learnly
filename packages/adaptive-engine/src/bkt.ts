/**
 * Bayesian Knowledge Tracing (Corbett & Anderson, 1994). Complements the Rasch
 * ability estimate: Rasch tells us *how hard* an item is for a learner, BKT tells
 * us *whether the skill has been learned*, accounting for slips and lucky guesses.
 */
export interface BktParams {
  /** P(L0): probability the skill is known before any practice. */
  pInit: number;
  /** P(T): probability of learning the skill on each practice opportunity. */
  pTransit: number;
  /** P(S): probability of a wrong answer despite knowing the skill. */
  pSlip: number;
  /** P(G): probability of a right answer without knowing the skill. */
  pGuess: number;
}

export const DEFAULT_BKT: BktParams = {
  pInit: 0.2,
  pTransit: 0.12,
  pSlip: 0.08,
  pGuess: 0.2,
};

export function bktUpdate(pKnown: number, correct: boolean, params: BktParams = DEFAULT_BKT): number {
  const { pSlip, pGuess, pTransit } = params;
  const posterior = correct
    ? (pKnown * (1 - pSlip)) / (pKnown * (1 - pSlip) + (1 - pKnown) * pGuess)
    : (pKnown * pSlip) / (pKnown * pSlip + (1 - pKnown) * (1 - pGuess));
  return posterior + (1 - posterior) * pTransit;
}

