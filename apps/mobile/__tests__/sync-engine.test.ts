import { randomUUID } from "node:crypto";
import { syncBackoffMs, type SyncOperation, type SyncOpResult, type SyncPushInput, type SyncResponse } from "@learnly/shared";
import { SyncEngine, type SyncStore, type SyncTransport } from "../src/sync/engine";

function lessonOp(createdAt = new Date().toISOString()): SyncOperation {
  return {
    opId: randomUUID(),
    type: "lesson.complete",
    createdAt,
    payload: { lessonId: randomUUID(), durationMs: 120_000 },
  };
}

function response(results: SyncOpResult[], cursor = "c1"): SyncResponse {
  return {
    results,
    cursor,
    serverTime: "2024-09-01T10:00:00.000Z",
    mastery: { upserted: [], deletedIds: [] },
    lessons: { upserted: [], deletedIds: [] },
    progress: { totalXp: 120, streak: 3, freezesAvailable: 1 },
  };
}

/** In-memory outbox mirroring the SQLite store's state machine. */
class MemoryStore implements SyncStore {
  rows: { op: SyncOperation; state: "pending" | "inflight" | "rejected"; error?: string }[] = [];
  cursor: string | null = null;
  applied: SyncResponse[] = [];

  add(...ops: SyncOperation[]) {
    for (const op of ops) this.rows.push({ op, state: "pending" });
  }
  async takeBatch(limit: number) {
    const batch = this.rows.filter((r) => r.state === "pending").slice(0, limit);
    batch.forEach((r) => (r.state = "inflight"));
    return batch.map((r) => ({ op: r.op }));
  }
  async settle(sent: string[], results: SyncOpResult[]) {
    for (const res of results) {
      const row = this.rows.find((r) => r.op.opId === res.opId);
      if (!row) continue;
      if (res.status === "rejected") {
        row.state = "rejected";
        row.error = res.reason;
      } else {
        this.rows = this.rows.filter((r) => r !== row);
      }
    }
    const mentioned = new Set(results.map((r) => r.opId));
    for (const id of sent) {
      const row = this.rows.find((r) => r.op.opId === id && r.state === "inflight");
      if (row && !mentioned.has(id)) row.state = "pending";
    }
  }
  async release(opIds: string[], error: string) {
    for (const row of this.rows) {
      if (opIds.includes(row.op.opId) && row.state === "inflight") {
        row.state = "pending";
        row.error = error;
      }
    }
  }
  async rejectLocally(results: SyncOpResult[]) {
    await this.settle([], results);
  }
  async pendingCount() {
    return this.rows.filter((r) => r.state !== "rejected").length;
  }
  async rejectedCount() {
    return this.rows.filter((r) => r.state === "rejected").length;
  }
  async getCursor() {
    return this.cursor;
  }
  async setCursor(cursor: string) {
    this.cursor = cursor;
  }
  async applyResponse(res: SyncResponse) {
    this.applied.push(res);
  }
}

/** Transport that applies everything it receives, recording each push. */
class AcceptingTransport implements SyncTransport {
  pushes: SyncPushInput[] = [];
  async push(input: SyncPushInput) {
    this.pushes.push(input);
    return response(
      input.operations.map((op) => ({ opId: op.opId, status: "applied" as const })),
      `cursor-${this.pushes.length}`,
    );
  }
}

function fakeTimers() {
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  return {
    timers,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (handle: unknown) => {
      timers.delete(handle as number);
    },
    runAll() {
      const pending = [...timers.entries()];
      timers.clear();
      for (const [, t] of pending) t.fn();
    },
  };
}

function makeEngine(store: SyncStore, transport: SyncTransport, extra: Partial<ConstructorParameters<typeof SyncEngine>[0]> = {}) {
  const timers = fakeTimers();
  let online = true;
  const engine = new SyncEngine({
    store,
    transport,
    deviceId: async () => "test-device-0001",
    isOnline: async () => online,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    random: () => 0.5,
    now: () => 1_700_000_000_000,
    ...extra,
  });
  return { engine, timers, setOnline: (value: boolean) => (online = value) };
}

describe("SyncEngine — draining", () => {
  it("pushes the outbox oldest-first in batches of at most 200", async () => {
    const store = new MemoryStore();
    const ops = Array.from({ length: 450 }, () => lessonOp());
    store.add(...ops);
    const transport = new AcceptingTransport();
    const { engine } = makeEngine(store, transport);

    const result = await engine.flush();

    expect(result.ok).toBe(true);
    expect(transport.pushes.map((p) => p.operations.length)).toEqual([200, 200, 50]);
    expect(transport.pushes[0]?.operations[0]?.opId).toBe(ops[0]?.opId);
    expect(store.rows).toHaveLength(0);
    expect(engine.getState()).toMatchObject({ status: "idle", pending: 0, failures: 0 });
    expect(engine.getState().lastSyncedAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("still pulls server deltas when there is nothing to push", async () => {
    const store = new MemoryStore();
    const transport = new AcceptingTransport();
    const { engine } = makeEngine(store, transport);

    await engine.flush();

    expect(transport.pushes).toHaveLength(1);
    expect(transport.pushes[0]?.operations).toEqual([]);
    expect(store.applied).toHaveLength(1);
  });

  it("sends the stored cursor and saves the new one after applying deltas", async () => {
    const store = new MemoryStore();
    store.cursor = "previous";
    store.add(lessonOp());
    const transport = new AcceptingTransport();
    const { engine } = makeEngine(store, transport);

    await engine.flush();

    expect(transport.pushes[0]?.since).toBe("previous");
    expect(transport.pushes[0]?.deviceId).toBe("test-device-0001");
    expect(store.cursor).toBe("cursor-1");
    expect(store.applied[0]?.progress.streak).toBe(3);
  });

  it("parks rejected operations and keeps them out of the next batch", async () => {
    const store = new MemoryStore();
    const [good, bad] = [lessonOp(), lessonOp()];
    store.add(good, bad);
    const transport: SyncTransport = {
      push: async (input) =>
        response(
          input.operations.map((op) =>
            op.opId === bad.opId
              ? { opId: op.opId, status: "rejected" as const, reason: "lesson_not_found" }
              : { opId: op.opId, status: "duplicate" as const },
          ),
        ),
    };
    const { engine } = makeEngine(store, transport);

    const result = await engine.flush();

    expect(result).toMatchObject({ applied: 1, rejected: 1 });
    expect(store.rows).toEqual([{ op: bad, state: "rejected", error: "lesson_not_found" }]);
    expect(engine.getState().rejected).toBe(1);
  });

  it("returns ops the server didn't mention to the queue", async () => {
    const store = new MemoryStore();
    const [a, b] = [lessonOp(), lessonOp()];
    store.add(a, b);
    const transport: SyncTransport = {
      push: async () => response([{ opId: a.opId, status: "applied" }]),
    };
    const { engine } = makeEngine(store, transport);

    await engine.flush();

    expect(store.rows.map((r) => [r.op.opId, r.state])).toEqual([[b.opId, "pending"]]);
  });
});

describe("SyncEngine — failures and backoff", () => {
  it("releases the batch and schedules a jittered retry when the push fails", async () => {
    const store = new MemoryStore();
    store.add(lessonOp(), lessonOp());
    const transport: SyncTransport = {
      push: jest.fn(async () => {
        throw new Error("Network request failed");
      }),
    };
    const { engine, timers } = makeEngine(store, transport);

    const result = await engine.flush();

    expect(result.ok).toBe(false);
    expect(store.rows.every((r) => r.state === "pending" && r.error === "Network request failed")).toBe(true);
    const state = engine.getState();
    expect(state.status).toBe("backoff");
    expect(state.failures).toBe(1);
    const [timer] = [...timers.timers.values()];
    expect(timer?.ms).toBe(syncBackoffMs(1, () => 0.5));
    expect(state.nextRetryAt).toBe(1_700_000_000_000 + syncBackoffMs(1, () => 0.5));
  });

  it("grows the delay with consecutive failures and recovers on success", async () => {
    const store = new MemoryStore();
    store.add(lessonOp());
    let fail = true;
    const accepting = new AcceptingTransport();
    const transport: SyncTransport = {
      push: async (input) => {
        if (fail) throw new Error("timeout");
        return accepting.push(input);
      },
    };
    const { engine, timers } = makeEngine(store, transport);

    await engine.flush();
    const first = [...timers.timers.values()][0]?.ms ?? 0;
    timers.runAll();
    await engine.flush();
    const second = [...timers.timers.values()][0]?.ms ?? 0;
    expect(second).toBeGreaterThan(first);
    expect(engine.getState().failures).toBe(2);

    fail = false;
    timers.runAll();
    await engine.flush();
    expect(engine.getState()).toMatchObject({ status: "idle", failures: 0, nextRetryAt: null });
    expect(store.rows).toHaveLength(0);
  });

  it("does nothing but report offline when there is no connection", async () => {
    const store = new MemoryStore();
    store.add(lessonOp());
    const transport = new AcceptingTransport();
    const { engine, setOnline } = makeEngine(store, transport);
    setOnline(false);

    const result = await engine.flush();

    expect(result.ok).toBe(false);
    expect(transport.pushes).toHaveLength(0);
    expect(engine.getState()).toMatchObject({ status: "offline", pending: 1 });
  });

  it("forgets backoff and syncs immediately on reconnect", async () => {
    const store = new MemoryStore();
    store.add(lessonOp());
    let fail = true;
    const accepting = new AcceptingTransport();
    const transport: SyncTransport = {
      push: async (input) => {
        if (fail) throw new Error("offline");
        return accepting.push(input);
      },
    };
    const { engine, timers } = makeEngine(store, transport);
    await engine.flush();
    expect(timers.timers.size).toBe(1);

    fail = false;
    engine.handleReconnect();
    expect(timers.timers.size).toBe(0);
    await engine.flush();
    expect(engine.getState()).toMatchObject({ status: "idle", failures: 0 });
    expect(accepting.pushes).toHaveLength(1);
  });
});

