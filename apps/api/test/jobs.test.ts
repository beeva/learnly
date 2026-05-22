import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Item, UserId } from "@learnly/shared";
import { correctResponseFor, createHarness, wrongResponseFor, type Harness } from "./support/harness.js";

async function seedAnswers(harness: Harness, item: Item, pattern: boolean[], learners: number, abilityBefore = 0) {
  const start = harness.clock.now().getTime() - 10 * 86_400_000;
  for (let learner = 0; learner < learners; learner++) {
    const userId = randomUUID() as UserId;
    for (const [index, correct] of pattern.entries()) {
      await harness.store.attempts.insert({
        userId,
        itemId: item.id,
        skillId: item.skillId,
        sessionId: null,
        clientAttemptId: null,
        response: correct ? correctResponseFor(item) : wrongResponseFor(item),
        correct,
        hintsUsed: 0,
        durationMs: 10_000,
        abilityBefore,
        answeredAt: new Date(start + learner * 3_600_000 + index * 60_000).toISOString(),
      });
    }
  }
}

describe("nightly jobs", () => {
  it("fits BKT parameters for skills with enough learners", async () => {
    const harness = createHarness();
    const [item] = harness.store.catalog.itemsOfSkill("FR.1");
    const [sparse] = harness.store.catalog.itemsOfSkill("FR.2");
    await seedAnswers(harness, item!, [false, false, true, true, true], 25);
    await seedAnswers(harness, sparse!, [true, true], 3);

    const scheduler = harness.container.resolve("nightlyScheduler");
    const [result] = await scheduler.runAll({ only: ["bkt-fit"] });
    expect(result).toMatchObject({ job: "bkt-fit", status: "succeeded", details: { fitted: 1, skipped: 1, learners: 25 } });

    const fitted = harness.store.bkt.rows.get(item!.skillId);
    expect(fitted?.stats).toEqual({ learners: 25, observations: 125 });
    // Learners went from wrong to right, so learning (transit) is clearly non-zero.
    expect(fitted?.params.pTransit).toBeGreaterThan(0.05);
    expect(harness.store.bkt.rows.has(sparse!.skillId)).toBe(false);
  });

  it("runs once per night across replicas unless forced", async () => {
    const harness = createHarness();
    const scheduler = harness.container.resolve("nightlyScheduler");
    expect((await scheduler.runAll({ only: ["bkt-fit"] }))[0]?.status).toBe("succeeded");
    expect((await scheduler.runAll({ only: ["bkt-fit"] }))[0]?.status).toBe("skipped");
    expect((await scheduler.runAll({ only: ["bkt-fit"], force: true }))[0]?.status).toBe("succeeded");
    harness.clock.advanceDays(1);
    expect((await scheduler.runAll({ only: ["bkt-fit"] }))[0]?.status).toBe("succeeded");
  });

  it("recalibrates item difficulty from first attempts, within bounds", async () => {
    const harness = createHarness();
    const item = harness.store.catalog.itemsOfSkill("FR.2").find((candidate) => candidate.kind === "numeric")!;
    const authored = item.difficulty;
    // Forty average learners all missed it: it is much harder than authored.
    await seedAnswers(harness, item, [false], 40, 0);

    const [result] = await harness.container.resolve("nightlyScheduler").runAll({ only: ["calibrate-difficulty"] });
    expect(result).toMatchObject({ status: "succeeded", details: { calibrated: 1 } });
    const calibrated = harness.store.catalog.items.get(item.id)!.difficulty;
    expect(calibrated).toBeGreaterThan(authored + 0.5);
    expect(calibrated).toBeLessThanOrEqual(authored + 1.5);
  });

  it("prunes sync operations past twice the client retention window", async () => {
    const harness = createHarness();
    const userId = randomUUID() as UserId;
    const old = new Date(harness.clock.now().getTime() - 90 * 86_400_000).toISOString();
    await harness.store.sync.claim(userId, { opId: randomUUID(), deviceId: "web-1234567", type: "attempt.create", createdAt: old });
    await harness.store.sync.claim(userId, {
      opId: randomUUID(),
      deviceId: "web-1234567",
      type: "attempt.create",
      createdAt: harness.clock.now().toISOString(),
    });
    const [result] = await harness.container.resolve("nightlyScheduler").runAll({ only: ["retention"] });
    expect(result?.details).toMatchObject({ syncOperationsPruned: 1 });
    expect(harness.store.sync.operations.size).toBe(1);
  });

  it("schedules the next run at the configured UTC hour", () => {
    const harness = createHarness();
    const scheduler = harness.container.resolve("nightlyScheduler");
    expect(scheduler.msUntilNextRun(new Date("2024-03-04T16:00:00Z"), 0)).toBe(11 * 3_600_000);
    expect(scheduler.msUntilNextRun(new Date("2024-03-04T02:30:00Z"), 0)).toBe(30 * 60_000);
  });
});
