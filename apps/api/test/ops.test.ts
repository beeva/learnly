import { describe, expect, it } from "vitest";
import { correctResponseFor, createHarness } from "./support/harness.js";
import { TEST_FEATURES } from "./support/memory.js";

describe("health and readiness", () => {
  it("reports liveness without touching dependencies", async () => {
    const { api, store } = createHarness();
    store.ready.healthy = false;
    const res = await api.get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("fails readiness when the database is unreachable or the task is draining", async () => {
    const { api, store, container } = createHarness();
    expect((await api.get("/readyz")).body).toEqual({ status: "ready", checks: { database: "ok" } });
    store.ready.healthy = false;
    expect((await api.get("/readyz")).status).toBe(503);
    store.ready.healthy = true;
    container.resolve("lifecycle").shuttingDown = true;
    const draining = await api.get("/readyz");
    expect(draining.status).toBe(503);
    expect(draining.body.status).toBe("draining");
  });
});

describe("GET /metrics", () => {
  it("exposes request and domain metrics in prometheus format", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const item = harness.store.catalog.itemsOfSkill("FR.1")[0]!;
    await harness.api.post("/v1/attempts").set(account.auth).send({ itemId: item.id, response: correctResponseFor(item), durationMs: 3000 });

    const res = await harness.api.get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    const lines: string[] = res.text.split("\n");
    expect(lines.some((line) => /^http_request_duration_seconds_count\{.*route="(\/v1)?\/attempts".*\} 1$/.test(line))).toBe(true);
    const attempts = lines.find((line) => line.startsWith("learnly_attempts_total{"));
    expect(attempts).toMatch(/kind="multiple_choice"/);
    expect(attempts).toMatch(/correct="true"/);
    expect(attempts?.endsWith(" 1")).toBe(true);
  });

  it("requires the scrape token when one is configured", async () => {
    const harness = createHarness();
    harness.container.register("features", () => ({ ...TEST_FEATURES, METRICS_TOKEN: "scrape-token-0123456789" }));
    expect((await harness.api.get("/metrics")).status).toBe(401);
    const ok = await harness.api.get("/metrics").set("Authorization", "Bearer scrape-token-0123456789");
    expect(ok.status).toBe(200);
  });
});

describe("caching", () => {
  it("lets catalog responses be cached and revalidated, never learner data", async () => {
    const harness = createHarness();
    const courses = await harness.api.get("/v1/courses");
    expect(courses.headers["cache-control"]).toMatch(/^public, max-age=120/);

    const lesson = [...harness.store.catalog.lessons.values()][0]!;
    const first = await harness.api.get(`/v1/lessons/${lesson.id}`);
    expect(first.headers["cache-control"]).toMatch(/^public, max-age=300/);
    const etag = first.headers["etag"];
    expect(etag).toBeTruthy();
    const revalidated = await harness.api.get(`/v1/lessons/${lesson.id}`).set("If-None-Match", String(etag));
    expect(revalidated.status).toBe(304);

    const account = await harness.signUp();
    const me = await harness.api.get("/v1/me").set(account.auth);
    expect(me.headers["cache-control"]).toBe("private, no-store");
  });
});

describe("POST /v1/events", () => {
  it("accepts batched analytics, dropping stale events", async () => {
    const harness = createHarness();
    const now = harness.clock.now().toISOString();
    const res = await harness.api.post("/v1/events").send({
      events: [
        { name: "lesson.opened", at: now, props: { lessonLevel: 2, offline: false } },
        { name: "onboarding.step_viewed", at: now },
        { name: "lesson.opened", at: "2023-01-01T00:00:00.000Z" },
      ],
    });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 2, dropped: 1 });
    expect(harness.store.events.rows).toEqual([
      expect.objectContaining({ name: "lesson.opened", userId: null, props: { lessonLevel: 2, offline: false } }),
      expect.objectContaining({ name: "onboarding.step_viewed", props: {} }),
    ]);
  });

  it("attributes events to the signed-in learner and validates names", async () => {
    const harness = createHarness();
    const account = await harness.signUp();
    const now = harness.clock.now().toISOString();
    await harness.api.post("/v1/events").set(account.auth).send({ events: [{ name: "practice.started", at: now }] });
    expect(harness.store.events.rows[0]?.userId).toBe(account.user.id);
    const invalid = await harness.api.post("/v1/events").send({ events: [{ name: "Page View", at: now }] });
    expect(invalid.status).toBe(400);
  });
});

describe("audit log", () => {
  it("records security events with request context but without raw emails", async () => {
    const harness = createHarness();
    await harness.api
      .post("/v1/auth/sign-in")
      .set("x-request-id", "req-audit-0001")
      .send({ email: "intruder@example.com", password: "letmein1234" });
    const entry = harness.store.audit.rows.find((row) => row.action === "auth.sign_in_failed");
    expect(entry).toMatchObject({ requestId: "req-audit-0001", actorId: null, metadata: { email: expect.stringMatching(/^[0-9a-f]{16}$/) } });
    expect(JSON.stringify(harness.store.audit.rows)).not.toContain("intruder@example.com");
  });
});
