import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LessonId, SyncOperation } from "@learnly/shared";
import { correctResponseFor, createHarness, type Harness, type TestAccount } from "./support/harness.js";

function attemptOp(harness: Harness, code: string, index: number, createdAt: string): SyncOperation {
  const item = harness.store.catalog.itemsOfSkill(code)[index];
  if (!item) throw new Error(`no item ${index} for ${code}`);
  return {
    opId: randomUUID(),
    type: "attempt.create",
    createdAt,
    payload: { itemId: item.id, sessionId: null, response: correctResponseFor(item), hintsUsed: 0, durationMs: 9000 },
  };
}

function push(harness: Harness, account: TestAccount, operations: SyncOperation[], since: string | null = null) {
  return harness.api.post("/v1/sync").set(account.auth).send({ deviceId: "ios-test-device", since, operations });
}

describe("POST /v1/sync", () => {
  it("applies an offline outbox and returns fresh state", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const lesson = [...harness.store.catalog.lessons.values()][0]!;
    const operations: SyncOperation[] = [
      attemptOp(harness, "FR.1", 0, "2024-03-04T09:00:00.000Z"),
      attemptOp(harness, "FR.1", 1, "2024-03-04T09:01:00.000Z"),
      { opId: randomUUID(), type: "lesson.complete", createdAt: "2024-03-04T09:10:00.000Z", payload: { lessonId: lesson.id, durationMs: 300_000 } },
      { opId: randomUUID(), type: "preferences.update", createdAt: "2024-03-04T09:11:00.000Z", payload: { dailyGoalMinutes: 25 } },
    ];

    const res = await push(harness, account, operations);
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual(operations.map((op) => ({ opId: op.opId, status: "applied" })));
    expect(res.body.cursor).toBe(res.body.serverTime);
    expect(res.body.mastery.upserted).toEqual([expect.objectContaining({ attempts: 2 })]);
    expect(res.body.lessons.upserted.length).toBe(harness.store.catalog.lessons.size);
    expect(res.body.progress.totalXp).toBeGreaterThanOrEqual(2 * 15 + 25);

    // Offline answers keep the time they were given, not the time they synced.
    expect(harness.store.attempts.rows.map((row) => row.answeredAt)).toEqual([
      "2024-03-04T09:00:00.000Z",
      "2024-03-04T09:01:00.000Z",
    ]);
    const me = await harness.api.get("/v1/me").set(account.auth);
    expect(me.body.preferences.dailyGoalMinutes).toBe(25);
  });

  it("is safe to retry: replayed operations are duplicates and change nothing", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const operations = [attemptOp(harness, "FR.1", 0, "2024-03-04T09:00:00.000Z")];
    const first = await push(harness, account, operations);
    const retry = await push(harness, account, operations);
    expect(retry.body.results).toEqual([{ opId: operations[0]!.opId, status: "duplicate" }]);
    expect(retry.body.progress.totalXp).toBe(first.body.progress.totalXp);
    expect(harness.store.attempts.rows).toHaveLength(1);
  });

  it("rejects operations that can never succeed, and keeps rejecting them", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const bad: SyncOperation = {
      opId: randomUUID(),
      type: "attempt.create",
      createdAt: "2024-03-04T09:00:00.000Z",
      payload: { itemId: randomUUID(), sessionId: null, response: { kind: "numeric", value: 3 }, hintsUsed: 0, durationMs: 1000 },
    };
    const good = attemptOp(harness, "FR.1", 2, "2024-03-04T09:02:00.000Z");

    const res = await push(harness, account, [bad, good]);
    expect(res.body.results[0]).toMatchObject({ opId: bad.opId, status: "rejected", reason: expect.stringMatching(/couldn't find/) });
    expect(res.body.results[1]).toEqual({ opId: good.opId, status: "applied" });

    const retry = await push(harness, account, [bad]);
    expect(retry.body.results[0]).toMatchObject({ status: "rejected" });
  });

  it("applies operations in the order they happened, whatever order they were sent in", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const early = attemptOp(harness, "FR.1", 0, "2024-03-04T08:00:00.000Z");
    const late = attemptOp(harness, "FR.1", 1, "2024-03-04T08:30:00.000Z");
    const res = await push(harness, account, [late, early]);
    expect(res.body.results.map((r: { opId: string }) => r.opId)).toEqual([late.opId, early.opId]);
    expect(harness.store.attempts.rows.map((row) => row.answeredAt)).toEqual([
      "2024-03-04T08:00:00.000Z",
      "2024-03-04T08:30:00.000Z",
    ]);
  });

  it("returns only what changed since the cursor, including deleted lessons", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const first = await push(harness, account, [attemptOp(harness, "FR.1", 0, "2024-03-04T09:00:00.000Z")]);
    const cursor: string = first.body.cursor;

    const quiet = await push(harness, account, [], cursor);
    expect(quiet.body.mastery.upserted).toEqual([]);
    expect(quiet.body.lessons).toEqual({ upserted: [], deletedIds: [] });

    harness.clock.advance(60_000);
    const [edited, removed] = [...harness.store.catalog.lessons.keys()] as LessonId[];
    harness.store.changes.touchLesson(edited!, harness.clock.now().toISOString());
    harness.store.changes.deleteLesson(removed!, harness.clock.now().toISOString());
    await harness.api
      .post("/v1/attempts")
      .set(account.auth)
      .send({
        itemId: harness.store.catalog.itemsOfSkill("FR.2")[0]!.id,
        response: correctResponseFor(harness.store.catalog.itemsOfSkill("FR.2")[0]!),
        durationMs: 4000,
      });
    harness.clock.advance(1000);

    const delta = await push(harness, account, [], cursor);
    expect(delta.body.mastery.upserted).toEqual([
      expect.objectContaining({ skillId: harness.store.catalog.skillByCode("FR.2").id }),
    ]);
    expect(delta.body.lessons.upserted.map((l: { id: string }) => l.id)).toEqual([edited]);
    expect(delta.body.lessons.deletedIds).toEqual([removed]);
  });

  it("validates the envelope and the cursor", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const noDevice = await harness.api.post("/v1/sync").set(account.auth).send({ since: null, operations: [] });
    expect(noDevice.status).toBe(400);
    const badCursor = await push(harness, account, [], "yesterday-ish");
    expect(badCursor.status).toBe(400);
    expect((await harness.api.post("/v1/sync").send({ deviceId: "x".repeat(10), since: null, operations: [] })).status).toBe(401);
  });
});
