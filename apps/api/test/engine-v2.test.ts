import { describe, expect, it } from "vitest";
import { DEFAULT_BKT, REASON_COPY } from "@learnly/adaptive-engine";
import type { Item } from "@learnly/shared";
import { correctResponseFor, createHarness, type Harness } from "./support/harness.js";
import { TEST_FEATURES } from "./support/memory.js";

async function answerCorrectly(harness: Harness, token: { Authorization: string }, item: Item) {
  const res = await harness.api
    .post("/v1/attempts")
    .set(token)
    .send({ itemId: item.id, response: correctResponseFor(item), durationMs: 12_000 });
  expect(res.status).toBe(200);
  return res.body;
}

function firstNumeric(harness: Harness, code: string): Item {
  const item = harness.store.catalog.itemsOfSkill(code).find((candidate) => candidate.kind === "numeric");
  if (!item) throw new Error(`no numeric item in ${code}`);
  return item;
}

describe("engine v2", () => {
  it("schedules the next review and stores spaced-repetition state", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = firstNumeric(harness, "FR.1");
    const body = await answerCorrectly(harness, account.auth, item);
    // A clean first success comes back tomorrow.
    expect(body.mastery.dueAt).toBe("2024-03-05T16:00:00.000Z");
    expect(harness.store.reviews.rows.get(`${account.user.id}:${item.skillId}`)).toMatchObject({ repetitions: 1, intervalDays: 1 });
  });

  it("uses nightly-fitted BKT parameters when a skill has them", async () => {
    const baseline = createHarness();
    const fitted = createHarness();
    const item = firstNumeric(fitted, "FR.1");
    fitted.store.bkt.rows.set(item.skillId, {
      params: { ...DEFAULT_BKT, pTransit: 0.4 },
      stats: { learners: 120, observations: 900 },
      at: "2024-03-04T03:00:00.000Z",
    });

    const a = await answerCorrectly(baseline, (await baseline.signUp()).auth, item);
    const b = await answerCorrectly(fitted, (await fitted.signUp()).auth, item);
    expect(b.mastery.pKnown).toBeGreaterThan(a.mastery.pKnown);
  });

  it("falls back to the v1 rasch engine when ENGINE_VERSION=v1", async () => {
    const harness = createHarness();
    harness.container.register("features", () => ({ ...TEST_FEATURES, ENGINE_VERSION: "v1" }));
    const account = await harness.signUp();
    const body = await answerCorrectly(harness, account.auth, firstNumeric(harness, "FR.1"));
    expect(body.mastery.dueAt).toBeNull();
    expect(harness.store.reviews.rows.size).toBe(0);
  });

  it("builds review sessions from what is actually due", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const courseId = harness.store.catalog.courseBySlug("fractions-foundations").id;
    await answerCorrectly(harness, account.auth, firstNumeric(harness, "FR.1"));

    const tooSoon = await harness.api.post("/v1/sessions").set(account.auth).send({ courseId, kind: "review" });
    expect(tooSoon.body.item).toBeNull();
    expect(tooSoon.body.rationale).toMatch(/caught up/);

    harness.clock.advanceDays(2);
    const due = await harness.api.post("/v1/sessions").set(account.auth).send({ courseId, kind: "review" });
    expect(due.body.item).toMatchObject({ skillId: harness.store.catalog.skillByCode("FR.1").id });
    expect(due.body.rationale).toBe(REASON_COPY.review);
  });
});
