import { isWithinQuietHours, minutesOfDay, nextReminderTimes } from "../src/notifications/quietHours";

const at = (h: number, m = 0) => h * 60 + m;
const QUIET = { quietStart: at(21), quietEnd: at(7, 30) };

describe("isWithinQuietHours", () => {
  it("handles windows that cross midnight", () => {
    expect(isWithinQuietHours(at(22), QUIET.quietStart, QUIET.quietEnd)).toBe(true);
    expect(isWithinQuietHours(at(3), QUIET.quietStart, QUIET.quietEnd)).toBe(true);
    expect(isWithinQuietHours(at(7, 30), QUIET.quietStart, QUIET.quietEnd)).toBe(false);
    expect(isWithinQuietHours(at(18, 30), QUIET.quietStart, QUIET.quietEnd)).toBe(false);
  });

  it("handles same-day windows and treats an empty window as none", () => {
    expect(isWithinQuietHours(at(13), at(12), at(14))).toBe(true);
    expect(isWithinQuietHours(at(14), at(12), at(14))).toBe(false);
    expect(isWithinQuietHours(at(13), at(9), at(9))).toBe(false);
  });
});

describe("nextReminderTimes", () => {
  const morning = new Date(2024, 8, 2, 9, 15); // Monday 09:15 local

  it("schedules one reminder a day at the chosen time", () => {
    const times = nextReminderTimes({ now: morning, hour: 18, minute: 30, ...QUIET, practicedToday: false });
    expect(times).toHaveLength(7);
    expect(times[0]?.getDate()).toBe(2);
    expect(times.every((t) => minutesOfDay(t) === at(18, 30))).toBe(true);
  });

  it("skips today once the learner has practiced", () => {
    const times = nextReminderTimes({ now: morning, hour: 18, minute: 30, ...QUIET, practicedToday: true, days: 3 });
    expect(times.map((t) => t.getDate())).toEqual([3, 4]);
  });

  it("skips today when the time has already passed", () => {
    const evening = new Date(2024, 8, 2, 19, 0);
    const times = nextReminderTimes({ now: evening, hour: 18, minute: 30, ...QUIET, practicedToday: false, days: 2 });
    expect(times.map((t) => t.getDate())).toEqual([3]);
  });

  it("moves an early-morning reminder to the end of quiet hours", () => {
    const night = new Date(2024, 8, 2, 1, 0);
    const times = nextReminderTimes({ now: night, hour: 6, minute: 0, ...QUIET, practicedToday: false, days: 1 });
    expect(times).toHaveLength(1);
    expect(minutesOfDay(times[0]!)).toBe(at(7, 30));
  });

  it("never schedules inside quiet hours", () => {
    const times = nextReminderTimes({ now: morning, hour: 22, minute: 15, ...QUIET, practicedToday: false });
    expect(times).toEqual([]);
  });
});
