/** Minutes after local midnight. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * True when `minutes` falls inside [start, end). Windows may cross midnight
 * (21:00 → 07:30). A window where start === end means "no quiet hours".
 */
export function isWithinQuietHours(minutes: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export interface ReminderPlanInput {
  now: Date;
  hour: number;
  minute: number;
  quietStart: number;
  quietEnd: number;
  /** Already practiced today: the reminder would only nag. */
  practicedToday: boolean;
  days?: number;
}

function atMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/**
 * The next reminder times, one per day at most. A reminder that lands in quiet
 * hours moves to the end of the window on the same day when that's possible;
 * otherwise that day is skipped. Nothing is ever scheduled inside quiet hours.
 */
export function nextReminderTimes({
  now,
  hour,
  minute,
  quietStart,
  quietEnd,
  practicedToday,
  days = 7,
}: ReminderPlanInput): Date[] {
  const wanted = hour * 60 + minute;
  const times: Date[] = [];
  for (let offset = 0; offset < days; offset++) {
    if (offset === 0 && practicedToday) continue;
    const day = new Date(now);
    day.setDate(now.getDate() + offset);

    let minutes = wanted;
    if (isWithinQuietHours(minutes, quietStart, quietEnd)) {
      // Only shift forward within the same calendar day.
      if (quietEnd > minutes) minutes = quietEnd;
      else continue;
      if (isWithinQuietHours(minutes, quietStart, quietEnd)) continue;
    }

    const at = atMinutes(day, minutes);
    if (at.getTime() <= now.getTime()) continue;
    times.push(at);
  }
  return times;
}
