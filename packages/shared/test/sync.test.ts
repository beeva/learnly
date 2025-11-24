import { describe, expect, it } from "vitest";
import { syncBackoffMs, syncPushSchema } from "../src/sync.js";

describe("syncPushSchema", () => {
  it("accepts a mixed batch of offline operations", () => {
    const result = syncPushSchema.safeParse({
      deviceId: "ios-3f9a2c11",
      since: null,
      operations: [
        {
          opId: "0b6c3d36-9e7f-4c1e-8b0a-6a3f2d1e4c5b",
          type: "attempt.create",
          createdAt: "2024-08-14T09:30:00.000Z",
          payload: {
            itemId: "6f1c2a8e-5b7d-4e0a-9c3f-1a2b3c4d5e6f",
            response: { kind: "numeric", value: 3 },
            durationMs: 8000,
          },
        },
        {
          opId: "1c7d4e47-0f8a-4d2f-9c1b-7b4a3e2f5d6c",
          type: "lesson.complete",
          createdAt: "2024-08-14T09:35:00.000Z",
          payload: { lessonId: "2d8e5f58-1a9b-4e3a-8d2c-8c5b4f3a6e7d", durationMs: 300000 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("syncBackoffMs", () => {
  it("grows exponentially and stays under five minutes", () => {
    expect(syncBackoffMs(0, () => 1)).toBe(1000);
    expect(syncBackoffMs(3, () => 1)).toBe(8000);
    expect(syncBackoffMs(20, () => 1)).toBe(300000);
    expect(syncBackoffMs(3, () => 0)).toBe(4000);
  });
});
import { isExpiredOperation } from "../src/sync.js";

describe("isExpiredOperation", () => {
  it("flags operations older than the retention window", () => {
    const op = {
      opId: "0b6c3d36-9e7f-4c1e-8b0a-6a3f2d1e4c5b",
      type: "preferences.update" as const,
      createdAt: "2025-01-01T00:00:00.000Z",
      payload: { dailyGoalMinutes: 15 },
    };
    expect(isExpiredOperation(op, Date.parse("2025-01-20T00:00:00Z"))).toBe(false);
    expect(isExpiredOperation(op, Date.parse("2025-03-01T00:00:00Z"))).toBe(true);
  });
});
