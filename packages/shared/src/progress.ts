/** XP needed to go from level n to n+1 grows gently so early levels feel quick. */
export function xpForLevel(level: number): number {
  if (level < 1) return 0;
  return Math.round(80 * Math.pow(level, 1.35));
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
}

export function levelForXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  const xpForNext = xpForLevel(level);
  return { level, xpIntoLevel: remaining, xpForNext, progress: remaining / xpForNext };
}

export const XP_RULES = {
  correct: 10,
  correctFirstTry: 5,
  hintPenalty: 2,
  lessonComplete: 25,
  diagnosticComplete: 40,
  streakBonusPerDay: 2,
  streakBonusCap: 20,
} as const;

export function xpForAttempt(correct: boolean, hintsUsed: number, firstTry: boolean): number {
  if (!correct) return 2; // effort still counts
  const base = XP_RULES.correct + (firstTry ? XP_RULES.correctFirstTry : 0);
  return Math.max(4, base - hintsUsed * XP_RULES.hintPenalty);
}

