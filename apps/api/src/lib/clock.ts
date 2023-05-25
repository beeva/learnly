/**
 * Time is injected rather than read from `Date` directly so streaks, token expiry and
 * spaced-repetition schedules can be tested deterministically.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function isoNow(clock: Clock): string {
  return clock.now().toISOString();
}
