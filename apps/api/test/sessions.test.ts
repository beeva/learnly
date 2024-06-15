import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_LIMITS } from "@learnly/adaptive-engine";
import { XP_RULES, type NextItemResponse } from "@learnly/shared";
import { correctResponseFor, createHarness, wrongResponseFor, type Harness, type TestAccount } from "./support/harness.js";

async function answerNext(harness: Harness, account: TestAccount, next: NextItemResponse, correct: boolean) {
  const item = next.item && harness.store.catalog.items.get(next.item.id);
  if (!item) throw new Error("expected an item");
  const res = await harness.api
    .post("/v1/attempts")
    .set(account.auth)
    .send({
      itemId: item.id,
      sessionId: next.session.id,
      response: correct ? correctResponseFor(item) : wrongResponseFor(item),
      durationMs: 15_000,
    });
  expect(res.status).toBe(200);
  harness.clock.advance(20_000);
  return res;
}

function fractionsCourseId(harness: Harness) {
  return harness.store.catalog.courseBySlug("fractions-foundations").id;
}

describe("diagnostic sessions", () => {
  it("probes a spread of skills, stops early and summarises starting points", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const start = await harness.api
      .post("/v1/sessions")
      .set(account.auth)
      .send({ courseId: fractionsCourseId(harness), kind: "diagnostic" });
    expect(start.status).toBe(201);
    expect(start.body.item).not.toBeNull();
    expect(start.body.item).not.toHaveProperty("answer");
    expect(start.body.rationale).toMatch(/starting point/i);

    let next: NextItemResponse = start.body;
    let answered = 0;
    while (next.item) {
      // Strong on early skills, shaky on later ones.
      await answerNext(harness, account, next, answered < 6);
      answered += 1;
      next = (await harness.api.get(`/v1/sessions/${next.session.id}/next`).set(account.auth)).body;
      expect(answered).toBeLessThanOrEqual(DIAGNOSTIC_LIMITS.maxTotal);
    }
    expect(next.progress.answered).toBe(answered);

    const done = await harness.api.post(`/v1/sessions/${next.session.id}/complete`).set(account.auth);
    expect(done.status).toBe(200);
    expect(done.body.session.completedAt).not.toBeNull();
    expect(done.body.xpEarned).toBeGreaterThanOrEqual(XP_RULES.diagnosticComplete);
    expect(done.body.summary.startingPoints).toHaveLength(6);
    for (const point of done.body.summary.startingPoints) expect(point.skillName).not.toBe("");

    // Completing again is idempotent: no second diagnostic bonus.
    const again = await harness.api.post(`/v1/sessions/${next.session.id}/complete`).set(account.auth);
    expect(again.body.xpEarned).toBe(done.body.xpEarned);
  });
});

describe("practice sessions", () => {
  it("never repeats an item and ends at the target", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    let next: NextItemResponse = (
      await harness.api
        .post("/v1/sessions")
        .set(account.auth)
        .send({ courseId: fractionsCourseId(harness), kind: "practice", targetItems: 5 })
    ).body;

    const seen = new Set<string>();
    let index = 0;
    while (next.item) {
      expect(seen.has(next.item.id)).toBe(false);
      seen.add(next.item.id);
      await answerNext(harness, account, next, index % 3 !== 2);
      index += 1;
      next = (await harness.api.get(`/v1/sessions/${next.session.id}/next`).set(account.auth)).body;
    }
    expect(seen.size).toBe(5);
    expect(next.progress).toEqual({ answered: 5, target: 5 });
    expect(next.session).toMatchObject({ itemsAnswered: 5 });

    const done = await harness.api.post(`/v1/sessions/${next.session.id}/complete`).set(account.auth);
    const ledger = harness.store.progress.xp.filter((entry) => entry.sessionId === next.session.id);
    expect(done.body.xpEarned).toBe(ledger.reduce((sum, entry) => sum + entry.amount, 0));

    const late = await harness.api
      .post("/v1/attempts")
      .set(account.auth)
      .send({
        itemId: [...seen][0],
        sessionId: next.session.id,
        response: { kind: "numeric", value: 1 },
        durationMs: 1000,
      });
    expect([400, 409]).toContain(late.status);
  });

  it("keeps sessions private to their learner", async () => {
    const harness = createHarness();
    const owner = await harness.signUp();
    const stranger = await harness.signUp();
    const start = await harness.api
      .post("/v1/sessions")
      .set(owner.auth)
      .send({ courseId: fractionsCourseId(harness), kind: "practice" });
    const peek = await harness.api.get(`/v1/sessions/${start.body.session.id}/next`).set(stranger.auth);
    expect(peek.status).toBe(404);
  });
});

describe("progress", () => {
  it("summarises XP, streak, mastery and the last seven days", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = harness.store.catalog.itemsOfSkill("FR.1")[0]!;
    await harness.api
      .post("/v1/attempts")
      .set(account.auth)
      .send({ itemId: item.id, response: correctResponseFor(item), durationMs: 90_000 });

    const res = await harness.api.get("/v1/progress").set(account.auth);
    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBeGreaterThan(0);
    expect(res.body.level).toMatchObject({ level: 1 });
    expect(res.body.minutesToday).toBe(2);
    expect(res.body.recentActivity).toHaveLength(7);
    expect(res.body.recentActivity.at(-1)).toMatchObject({ day: "2024-03-04", itemsCorrect: 1 });
    expect(res.body.mastery).toEqual([expect.objectContaining({ skillId: item.skillId, attempts: 1 })]);

    const course = await harness.api.get("/v1/courses/fractions-foundations/mastery").set(account.auth);
    expect(course.body.mastery).toHaveLength(6);
    expect(course.body.mastery.filter((m: { band: string }) => m.band === "new")).toHaveLength(5);
  });

  it("awards lesson XP on the first completion only", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const lesson = [...harness.store.catalog.lessons.values()][0]!;
    const first = await harness.api.post(`/v1/lessons/${lesson.id}/complete`).set(account.auth).send({ durationMs: 240_000 });
    expect(first.status).toBe(200);
    expect(first.body.xpEarned).toBe(XP_RULES.lessonComplete);
    expect(first.body.progress.minutesToday).toBe(4);
    const second = await harness.api.post(`/v1/lessons/${lesson.id}/complete`).set(account.auth).send({ durationMs: 60_000 });
    expect(second.body.xpEarned).toBe(0);
  });

  it("recommends the diagnostic first, then lessons and practice", async () => {
    const harness = createHarness();
    const account = await harness.signUp({ gradeBand: "3-5" });
    const fresh = await harness.api.get("/v1/recommendations").set(account.auth);
    expect(fresh.body.next).toEqual([expect.objectContaining({ type: "diagnostic", courseSlug: "fractions-foundations" })]);

    const item = harness.store.catalog.itemsOfSkill("FR.1")[0]!;
    await harness.api.post("/v1/attempts").set(account.auth).send({ itemId: item.id, response: wrongResponseFor(item), durationMs: 5000 });
    const started = await harness.api.get("/v1/recommendations").set(account.auth);
    const types = started.body.next.map((n: { type: string }) => n.type);
    expect(types.slice(0, 2)).toEqual(["lesson", "practice"]);
    expect(started.body.next[0].lessonId).toEqual(expect.any(String));
  });
});

describe("PATCH /v1/me/preferences", () => {
  it("updates preferences and profile fields", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const res = await harness.api
      .patch("/v1/me/preferences")
      .set(account.auth)
      .send({ dailyGoalMinutes: 20, reducedMotion: true, locale: "es", displayName: "Ada L." });
    expect(res.status).toBe(200);
    expect(res.body.preferences).toEqual({ dailyGoalMinutes: 20, reducedMotion: true, soundEffects: true, locale: "es" });
    const me = await harness.api.get("/v1/me").set(account.auth);
    expect(me.body.user.displayName).toBe("Ada L.");
    expect(me.body.progress.dailyGoalMinutes).toBe(20);

    const invalid = await harness.api.patch("/v1/me/preferences").set(account.auth).send({ dailyGoalMinutes: 500 });
    expect(invalid.status).toBe(400);
  });
});
