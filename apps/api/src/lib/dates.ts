const DAY_MS = 86_400_000;

/** The UTC calendar day (YYYY-MM-DD) of an instant. */
export function utcDay(at: Date | string): string {
  return (typeof at === "string" ? new Date(at) : at).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The `count` days ending on (and including) `lastDay`, oldest first. */
export function dayRange(lastDay: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(lastDay, index - count + 1));
}

export function hoursAgo(now: Date, at: string | null): number {
  return at === null ? Number.POSITIVE_INFINITY : (now.getTime() - Date.parse(at)) / 3_600_000;
}
