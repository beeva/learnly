import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { XP_RULES, streakBonus, type Item } from "@learnly/shared";
import { correctResponseFor, createHarness, wrongResponseFor, type Harness, type TestAccount } from "./support/harness.js";

function itemFor(harness: Harness, code: string, kind?: Item["kind"]): Item {
  const item = harness.store.catalog.itemsOfSkill(code).find((candidate) => !kind || candidate.kind === kind);
  if (!item) throw new Error(`no ${kind ?? "any"} item for ${code}`);
  return item;
}

function answer(harness: Harness, account: TestAccount, item: Item, correct: boolean, extra: Record<string, unknown> = {}) {
  return harness.api
    .post("/v1/attempts")
    .set(account.auth)
    .send({
      itemId: item.id,
      response: correct ? correctResponseFor(item) : wrongResponseFor(item),
      durationMs: 12_000,
      ...extra,
    });
}

describe("POST /v1/attempts", () => {
  it("scores the answer, updates mastery and awards first-try XP", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = itemFor(harness, "FR.1", "multiple_choice");

    const res = await answer(harness, account, item, true);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      correct: true,
      explanation: item.explanation,
      correctResponse: correctResponseFor(item),
      xpEarned: XP_RULES.correct + XP_RULES.correctFirstTry,
      encouragementKey: "correct",
    });
    expect(res.body.attempt).toMatchObject({ itemId: item.id, skillId: item.skillId, hintsUsed: 0 });
    expect(res.body.mastery).toMatchObject({ skillId: item.skillId, attempts: 1 });
    expect(res.body.mastery.pKnown).toBeGreaterThan(0);
  });

  it("is idempotent on clientAttemptId: same attempt, no double XP", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = itemFor(harness, "FR.1", "numeric");
    const clientAttemptId = randomUUID();

    const first = await answer(harness, account, item, true, { clientAttemptId });
    const retry = await answer(harness, account, item, true, { clientAttemptId });
    expect(retry.status).toBe(200);
    expect(retry.body.attempt.id).toBe(first.body.attempt.id);
    expect(retry.body.xpEarned).toBe(first.body.xpEarned);
    expect(retry.body.mastery.attempts).toBe(1);

    const me = await harness.api.get("/v1/me").set(account.auth);
    expect(me.body.progress.totalXp).toBe(first.body.xpEarned);
    expect(harness.store.attempts.rows).toHaveLength(1);
  });

  it("still rewards effort on a miss, with encouragement that changes as misses add up", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const [first, second] = harness.store.catalog.itemsOfSkill("FR.3").filter((item) => item.kind === "multiple_choice");
    if (!first || !second) throw new Error("fixture needs two multiple choice items");

    const miss = await answer(harness, account, first, false);
    expect(miss.body).toMatchObject({ correct: false, xpEarned: 2, encouragementKey: "incorrect_first" });
    const again = await answer(harness, account, second, false);
    expect(again.body.encouragementKey).toBe("incorrect_again");
  });

  it("applies the hint penalty and celebrates hinted answers", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = itemFor(harness, "FR.1", "short_text");
    const res = await answer(harness, account, item, true, { hintsUsed: 1 });
    expect(res.body.xpEarned).toBe(XP_RULES.correct + XP_RULES.correctFirstTry - XP_RULES.hintPenalty);
    expect(res.body.attempt.hintsUsed).toBe(1);
  });

  it("extends the streak on consecutive days and grants the streak bonus", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const [today, tomorrow] = harness.store.catalog.itemsOfSkill("FR.1");
    if (!today || !tomorrow) throw new Error("fixture needs two items");

    await answer(harness, account, today, true);
    harness.clock.advanceDays(1);
    const next = await answer(harness, account, tomorrow, true);
    expect(next.body.xpEarned).toBe(XP_RULES.correct + XP_RULES.correctFirstTry + streakBonus(2));

    const progress = await harness.api.get("/v1/progress").set(account.auth);
    expect(progress.body.streak).toMatchObject({ current: 2, longest: 2 });
  });

  it("rejects answers that don't fit the question", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = itemFor(harness, "FR.2", "numeric");

    const wrongKind = await harness.api
      .post("/v1/attempts")
      .set(account.auth)
      .send({ itemId: item.id, response: { kind: "short_text", text: "3" }, durationMs: 1000 });
    expect(wrongKind.status).toBe(400);
    expect(wrongKind.body.error.details).toMatchObject({ expected: "numeric", received: "short_text" });

    const unknown = await harness.api
      .post("/v1/attempts")
      .set(account.auth)
      .send({ itemId: randomUUID(), response: { kind: "numeric", value: 1 }, durationMs: 1000 });
    expect(unknown.status).toBe(404);

    const anonymous = await harness.api.post("/v1/attempts").send({ itemId: item.id, response: { kind: "numeric", value: 1 }, durationMs: 1 });
    expect(anonymous.status).toBe(401);
  });
});

describe("GET /v1/lessons/:id", () => {
  it("serves lesson blocks with their check items, minus answer keys", async () => {
    const harness = createHarness();
    const lesson = [...harness.store.catalog.lessons.values()][0];
    if (!lesson) throw new Error("no lessons");
    const res = await harness.api.get(`/v1/lessons/${lesson.id}`);
    expect(res.status).toBe(200);
    expect(res.body.lesson.blocks.length).toBeGreaterThan(3);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty("answer");
      expect(item).not.toHaveProperty("acceptedAnswers");
      expect(item).not.toHaveProperty("tolerance");
      expect(item).not.toHaveProperty("explanation");
      expect(item.hints.length).toBeGreaterThan(0);
    }
    expect((await harness.api.get("/v1/lessons/not-a-uuid")).status).toBe(404);
  });
});
