import { randomUUID } from "node:crypto";
import { syncOperationSchema, type SyncOperation } from "@learnly/shared";
import {
  attemptOperation,
  compactOperations,
  lessonCompleteOperation,
  partitionResults,
  preferencesOperation,
} from "../src/sync/outbox";

describe("operation builders", () => {
  it("produce operations the server schema accepts", () => {
    const ops: SyncOperation[] = [
      attemptOperation({
        itemId: randomUUID(),
        sessionId: null,
        response: { kind: "numeric", value: 0.75 },
        hintsUsed: 1,
        durationMs: 18_000,
        clientAttemptId: randomUUID(),
        answeredAt: new Date().toISOString(),
      }),
      lessonCompleteOperation(randomUUID(), 312_456.7),
      preferencesOperation({ dailyGoalMinutes: 15, locale: "fil" }),
    ];
    for (const op of ops) expect(syncOperationSchema.safeParse(op).success).toBe(true);
  });

  it("gives every operation a unique id and rounds lesson durations", () => {
    const a = lessonCompleteOperation(randomUUID(), 1000.4);
    const b = lessonCompleteOperation(randomUUID(), -20);
    expect(a.opId).not.toBe(b.opId);
    expect(a.type === "lesson.complete" && a.payload.durationMs).toBe(1000);
    expect(b.type === "lesson.complete" && b.payload.durationMs).toBe(0);
  });
});

describe("compactOperations", () => {
  const prefs = (seq: number, payload: Parameters<typeof preferencesOperation>[0]) => ({
    seq,
    op: preferencesOperation(payload),
  });

  it("merges preference updates latest-wins into the newest row", () => {
    const entries = [
      prefs(1, { dailyGoalMinutes: 10, soundEffects: false }),
      { seq: 2, op: lessonCompleteOperation(randomUUID(), 60_000) },
      prefs(3, { dailyGoalMinutes: 20 }),
      prefs(4, { locale: "es" }),
    ];
    const { keep, dropSeqs } = compactOperations(entries);
    expect(dropSeqs).toEqual([1, 3]);
    expect(keep).toHaveLength(1);
    expect(keep[0]?.seq).toBe(4);
    const op = keep[0]?.op;
    expect(op?.type).toBe("preferences.update");
    expect(op?.type === "preferences.update" && op.payload).toEqual({
      dailyGoalMinutes: 20,
      soundEffects: false,
      locale: "es",
    });
  });

  it("never touches attempts or lesson completions", () => {
    const entries = [
      { seq: 1, op: lessonCompleteOperation(randomUUID(), 60_000) },
      { seq: 2, op: lessonCompleteOperation(randomUUID(), 90_000) },
      prefs(3, { reducedMotion: true }),
    ];
    expect(compactOperations(entries)).toEqual({ keep: [], dropSeqs: [] });
  });
});

describe("partitionResults", () => {
  it("deletes applied and duplicate ops and parks rejected ones with a reason", () => {
    const result = partitionResults([
      { opId: "a", status: "applied" },
      { opId: "b", status: "duplicate" },
      { opId: "c", status: "rejected", reason: "item_retired" },
      { opId: "d", status: "rejected" },
    ]);
    expect(result.done).toEqual(["a", "b"]);
    expect(result.rejected).toEqual([
      { opId: "c", reason: "item_retired" },
      { opId: "d", reason: "rejected" },
    ]);
  });
});
