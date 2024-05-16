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

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDay: string | null;
  freezesAvailable: number;
}

function dayDiff(fromDay: string, toDay: string): number {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Advance a streak for activity on `today` (YYYY-MM-DD in the learner's timezone).
 * A missed single day is forgiven automatically when a freeze is available so one
 * busy evening doesn't wipe out weeks of effort.
 */
export function advanceStreak(state: StreakState, today: string): StreakState {
  if (state.lastActiveDay === today) return state;
  if (state.lastActiveDay === null) {
    return { ...state, current: 1, longest: Math.max(1, state.longest), lastActiveDay: today };
  }
  const gap = dayDiff(state.lastActiveDay, today);
  let current = 1;
  let freezesAvailable = state.freezesAvailable;
  if (gap === 1) current = state.current + 1;
  else if (gap === 2 && freezesAvailable > 0) {
    current = state.current + 1;
    freezesAvailable -= 1;
  }
  return {
    current,
    longest: Math.max(state.longest, current),
    lastActiveDay: today,
    freezesAvailable,
  };
}

export function streakBonus(streak: number): number {
  return Math.min(XP_RULES.streakBonusCap, streak * XP_RULES.streakBonusPerDay);
}

