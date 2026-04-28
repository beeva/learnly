import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsEvent } from "../api/client";
import { normalizePath } from "./events";
import { EventTracker, describeMutation } from "./tracker";

const fixedNow = () => new Date("2026-03-04T05:06:07.000Z");

function setup(options: Partial<ConstructorParameters<typeof EventTracker>[0]> = {}) {
  const send = vi.fn<(events: AnalyticsEvent[], options: { keepalive?: boolean }) => Promise<unknown>>().mockResolvedValue(undefined);
  const tracker = new EventTracker({ send, now: fixedNow, ...options });
  return { tracker, send };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("EventTracker", () => {
  it("sends a batch as soon as it is full", async () => {
    const { tracker, send } = setup({ maxBatch: 3 });
    tracker.track("a");
    tracker.track("b", { correct: true });
    expect(send).not.toHaveBeenCalled();
    tracker.track("c");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]?.[0]).toEqual([
      { name: "a", at: "2026-03-04T05:06:07.000Z" },
      { name: "b", at: "2026-03-04T05:06:07.000Z", props: { correct: true } },
      { name: "c", at: "2026-03-04T05:06:07.000Z" },
    ]);
    expect(tracker.size).toBe(0);
  });

  it("flushes partial batches on a timer", async () => {
    vi.useFakeTimers();
    const { tracker, send } = setup({ flushIntervalMs: 1000 });
    tracker.track("page_view", { path: "/home" });
    await vi.advanceTimersByTimeAsync(999);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("puts a failed batch back at the front of the queue and retries later", async () => {
    vi.useFakeTimers();
    const { tracker, send } = setup({ flushIntervalMs: 500 });
    send.mockRejectedValueOnce(new Error("offline"));
    tracker.track("first");
    await tracker.flush();
    expect(tracker.size).toBe(1);
    tracker.track("second");
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0].map((event) => event.name)).toEqual(["first", "second"]);
    expect(tracker.size).toBe(0);
  });

  it("drops the oldest events beyond maxQueue", async () => {
    const { tracker, send } = setup({ maxQueue: 3, maxBatch: 100 });
    for (const name of ["e1", "e2", "e3", "e4", "e5"]) tracker.track(name);
    expect(tracker.size).toBe(3);
    await tracker.flush();
    expect(send.mock.calls[0]?.[0].map((event) => event.name)).toEqual(["e3", "e4", "e5"]);
  });

  it("does nothing when disabled", async () => {
    const { tracker, send } = setup({ enabled: false });
    tracker.track("page_view");
    await tracker.flush();
    expect(tracker.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("passes keepalive through for unload flushes", async () => {
    const { tracker, send } = setup();
    tracker.track("page_view");
    await tracker.flush({ keepalive: true });
    expect(send).toHaveBeenCalledWith(expect.any(Array), { keepalive: true });
  });

  it("does not send when the queue is empty", async () => {
    const { tracker, send } = setup();
    await tracker.flush();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("describeMutation", () => {
  it("maps attempts to item_answered without free-text answers", () => {
    const event = describeMutation(
      ["attempt"],
      { correct: true, xpEarned: 15, encouragementKey: "mastered" },
      { hintsUsed: 1, durationMs: 4200, response: { kind: "short_text", text: "my secret answer" }, sessionId: "s1" },
    );
    expect(event).toEqual({
      name: "item_answered",
      props: { correct: true, hints: 1, durationMs: 4200, kind: "short_text", inSession: true, mastered: true },
    });
    expect(JSON.stringify(event)).not.toContain("secret");
  });

  it("maps lessons, sessions, preferences and classrooms", () => {
    expect(describeMutation(["lesson", "complete"], { xpEarned: 25 }, { durationMs: 60_000 })).toEqual({
      name: "lesson_completed",
      props: { xp: 25, durationMs: 60_000 },
    });
    expect(describeMutation(["session", "start"], undefined, { kind: "diagnostic" })?.props).toEqual({ kind: "diagnostic" });
    expect(
      describeMutation(["session", "complete"], { xpEarned: 40, session: { kind: "practice", itemsAnswered: 8, itemsCorrect: 6 } }, "id")?.props,
    ).toEqual({ kind: "practice", xp: 40, answered: 8, correct: 6 });
    expect(describeMutation(["preferences"], {}, { soundEffects: false, dailyGoalMinutes: 10 })?.props).toEqual({ fields: "dailyGoalMinutes,soundEffects" });
    expect(describeMutation(["classroom", "join"], {}, "FRAC24")?.name).toBe("classroom_joined");
  });

  it("ignores mutations it doesn't know", () => {
    expect(describeMutation(["something", "else"], {}, {})).toBeNull();
    expect(describeMutation(undefined, {}, {})).toBeNull();
  });
});

describe("normalizePath", () => {
  it("replaces ids so page views never carry identifiers", () => {
    expect(normalizePath("/lessons/00000004-0000-4000-8000-000000000003")).toBe("/lessons/:id");
    expect(normalizePath("/teach/00000007-0000-4000-8000-000000000001/")).toBe("/teach/:id");
    expect(normalizePath("/practice/fractions-foundations")).toBe("/practice/fractions-foundations");
    expect(normalizePath("/")).toBe("/");
  });
});
