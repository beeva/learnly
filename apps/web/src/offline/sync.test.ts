import { levelForXp } from "@learnly/shared";
import { QueryClient } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../mocks/server";

type ClientModule = typeof import("../api/client");
type SyncModule = typeof import("./sync");

let client: ClientModule;
let sync: SyncModule;

const TOKENS = { accessToken: "access-token", refreshToken: "refresh-token-0000000000" };

function seededQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(client.learnerKeys.progress, {
    totalXp: 740,
    level: levelForXp(740),
    streak: { current: 6, longest: 14, lastActiveDay: "2026-10-25", freezesAvailable: 1 },
    minutesToday: 4,
    dailyGoalMinutes: 15,
    mastery: [],
    recentActivity: [],
  });
  queryClient.setQueryData(client.queryKeys.me, {
    user: { id: "u1", email: "maya@learnly.app", displayName: "Maya", role: "student", gradeBand: "3-5", avatarColor: "#FF7A59", locale: "en", createdAt: "" },
    preferences: { dailyGoalMinutes: 15, reducedMotion: false, soundEffects: true, locale: "en" },
  });
  return queryClient;
}

beforeEach(async () => {
  // Fresh modules per test: the outbox, middleware list and token store are module state.
  vi.resetModules();
  client = await import("../api/client");
  sync = await import("./sync");
  client.tokenStore.set(TOKENS);
});

afterEach(() => {
  client.tokenStore.clear();
});

describe("offline middleware", () => {
  it("queues a lesson completion when the network is down and answers optimistically", async () => {
    server.use(http.post("*/v1/lessons/:id/complete", () => HttpResponse.error()));
    sync.installOfflineSupport(seededQueryClient(), { serviceWorker: false });

    const result = await client.learnerApi.completeLesson("lesson-1", 120_000);

    expect(result.xpEarned).toBe(25);
    expect(result.progress.totalXp).toBe(765);
    expect(result.progress.minutesToday).toBe(6);
    const [op] = sync.outbox.getState().operations;
    expect(op).toMatchObject({ type: "lesson.complete", payload: { lessonId: "lesson-1", durationMs: 120_000 } });
    expect(JSON.parse(localStorage.getItem("learnly.outbox") ?? "[]")).toHaveLength(1);
  });

  it("queues preference changes and merges them into the cached preferences", async () => {
    server.use(http.patch("*/v1/me/preferences", () => HttpResponse.error()));
    sync.installOfflineSupport(seededQueryClient(), { serviceWorker: false });

    const result = await client.learnerApi.updatePreferences({ soundEffects: false, displayName: "Maya S." });

    expect(result.preferences).toEqual({ dailyGoalMinutes: 15, reducedMotion: false, soundEffects: false, locale: "en" });
    expect(sync.outbox.getState().operations[0]).toMatchObject({ type: "preferences.update", payload: { soundEffects: false, displayName: "Maya S." } });
  });

  it("lets real server errors through instead of queueing them", async () => {
    server.use(http.post("*/v1/lessons/:id/complete", () => HttpResponse.json({ error: { code: "internal", message: "Boom" } }, { status: 500 })));
    sync.installOfflineSupport(seededQueryClient(), { serviceWorker: false });

    await expect(client.learnerApi.completeLesson("lesson-1", 1000)).rejects.toMatchObject({ code: "internal" });
    expect(sync.outbox.getState().operations).toHaveLength(0);
  });

  it("doesn't touch unrelated requests", async () => {
    server.use(http.get("*/v1/courses", () => HttpResponse.error()));
    sync.installOfflineSupport(seededQueryClient(), { serviceWorker: false });
    await expect(client.api.courses()).rejects.toMatchObject({ code: "network" });
    expect(sync.outbox.getState().operations).toHaveLength(0);
  });
});

describe("flushOutbox", () => {
  it("pushes queued operations to /v1/sync and clears the ones the server settled", async () => {
    type SyncBody = { deviceId: string; since: string | null; operations: { opId: string }[] };
    const captured: { body: SyncBody | null } = { body: null };
    server.use(
      http.post("*/v1/sync", async ({ request }) => {
        const body = (await request.json()) as SyncBody;
        captured.body = body;
        return HttpResponse.json({
          results: body.operations.map((op) => ({ opId: op.opId, status: "applied" })),
          cursor: "1730000000000",
          serverTime: "2026-10-26T10:00:00.000Z",
          mastery: { upserted: [], deletedIds: [] },
          lessons: { upserted: [], deletedIds: [] },
          progress: { totalXp: 765, streak: 6, freezesAvailable: 1 },
        });
      }),
    );
    sync.outbox.enqueue({
      opId: crypto.randomUUID(),
      type: "lesson.complete",
      createdAt: new Date().toISOString(),
      payload: { lessonId: crypto.randomUUID(), durationMs: 60_000 },
    });

    await sync.flushOutbox();

    expect(captured.body?.deviceId).toMatch(/^web-/);
    expect(captured.body?.since).toBeNull();
    expect(captured.body?.operations).toHaveLength(1);
    const state = sync.outbox.getState();
    expect(state.operations).toHaveLength(0);
    expect(state.status).toBe("idle");
    expect(state.lastSyncedAt).toBe("2026-10-26T10:00:00.000Z");
    expect(JSON.parse(localStorage.getItem("learnly.sync-cursor") ?? "null")).toBe("1730000000000");
  });

  it("keeps operations and backs off when the push fails", async () => {
    server.use(http.post("*/v1/sync", () => HttpResponse.json({ error: { code: "internal", message: "Down" } }, { status: 503 })));
    sync.outbox.enqueue({ opId: crypto.randomUUID(), type: "preferences.update", createdAt: new Date().toISOString(), payload: { soundEffects: true } });

    await sync.flushOutbox();

    const state = sync.outbox.getState();
    expect(state.status).toBe("error");
    expect(state.failures).toBe(1);
    expect(state.operations).toHaveLength(1);
  });

  it("waits for a session before pushing", async () => {
    const push = vi.fn(() => HttpResponse.json({}));
    server.use(http.post("*/v1/sync", push));
    client.tokenStore.clear();
    sync.outbox.enqueue({ opId: crypto.randomUUID(), type: "preferences.update", createdAt: new Date().toISOString(), payload: { locale: "es" } });
    await sync.flushOutbox();
    expect(push).not.toHaveBeenCalled();
  });
});
