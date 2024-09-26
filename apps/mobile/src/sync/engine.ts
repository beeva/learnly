import {
  syncBackoffMs,
  syncOperationSchema,
  type SyncOperation,
  type SyncOpResult,
  type SyncPushInput,
  type SyncResponse,
} from "@learnly/shared";

/**
 * Pushes the outbox to `POST /v1/sync` and applies the deltas that come back.
 *
 * Guarantees:
 *  - one flush at a time (concurrent triggers join the running flush);
 *  - batches of at most 200 operations, oldest first, looping until drained;
 *  - transport failures return ops to the queue and back off with jitter;
 *  - every op is either confirmed, parked as rejected, or retried — never lost;
 *  - a flush with nothing to push still pulls server deltas (mastery, lessons).
 *
 * The engine is platform-free: storage, transport, connectivity and timers are
 * injected, which keeps it deterministic under test.
 */

export interface SyncStoreEntry {
  op: SyncOperation;
}

export interface SyncStore {
  takeBatch(limit: number): Promise<SyncStoreEntry[]>;
  settle(sentOpIds: string[], results: SyncOpResult[]): Promise<void>;
  release(opIds: string[], error: string): Promise<void>;
  /** Marks locally invalid ops as rejected without sending them. */
  rejectLocally(results: SyncOpResult[]): Promise<void>;
  pendingCount(): Promise<number>;
  rejectedCount(): Promise<number>;
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
  applyResponse(response: SyncResponse): Promise<void>;
}

export interface SyncTransport {
  push(input: SyncPushInput): Promise<SyncResponse>;
}

export type SyncStatus = "idle" | "syncing" | "offline" | "backoff" | "error";

export interface SyncState {
  status: SyncStatus;
  pending: number;
  rejected: number;
  failures: number;
  lastSyncedAt: string | null;
  nextRetryAt: number | null;
  lastError: string | null;
}

export interface SyncRunResult {
  pushed: number;
  applied: number;
  rejected: number;
  batches: number;
  ok: boolean;
}

export interface SyncEngineDeps {
  store: SyncStore;
  transport: SyncTransport;
  deviceId: () => Promise<string>;
  isOnline: () => Promise<boolean>;
  /** Errors that mean "stop retrying until something changes" (e.g. signed out). */
  isFatal?: (error: unknown) => boolean;
  now?: () => number;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  batchSize?: number;
  /** Debounce for bursts of local writes (e.g. answering several items quickly). */
  debounceMs?: number;
}

export type BeforeFlushHook = () => Promise<void> | void;
export type ResultsHook = (results: SyncOpResult[], response: SyncResponse) => Promise<void> | void;

export class SyncEngine {
  private state: SyncState = {
    status: "idle",
    pending: 0,
    rejected: 0,
    failures: 0,
    lastSyncedAt: null,
    nextRetryAt: null,
    lastError: null,
  };
  private listeners = new Set<(state: SyncState) => void>();
  private beforeFlushHooks: BeforeFlushHook[] = [];
  private resultsHooks: ResultsHook[] = [];
  private running: Promise<SyncRunResult> | null = null;
  private retryTimer: unknown = null;
  private debounceTimer: unknown = null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly batchSize: number;

  constructor(private readonly deps: SyncEngineDeps) {
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? Math.random;
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.batchSize = Math.min(200, Math.max(1, deps.batchSize ?? 200));
  }

  getState(): SyncState {
    return this.state;
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Runs before every flush, e.g. to compact the outbox. */
  onBeforeFlush(hook: BeforeFlushHook): () => void {
    this.beforeFlushHooks.push(hook);
    return () => {
      this.beforeFlushHooks = this.beforeFlushHooks.filter((h) => h !== hook);
    };
  }

  /** Observes per-operation results after each successful push. */
  onResults(hook: ResultsHook): () => void {
    this.resultsHooks.push(hook);
    return () => {
      this.resultsHooks = this.resultsHooks.filter((h) => h !== hook);
    };
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  async refreshCounts(): Promise<void> {
    const [pending, rejected] = await Promise.all([this.deps.store.pendingCount(), this.deps.store.rejectedCount()]);
    this.setState({ pending, rejected });
  }

  /** Coalesces bursts of triggers into one flush shortly after the last one. */
  requestSync(debounceMs = this.deps.debounceMs ?? 1500): void {
    if (this.debounceTimer !== null) this.clearTimer(this.debounceTimer);
    this.debounceTimer = this.setTimer(() => {
      this.debounceTimer = null;
      void this.flush();
    }, debounceMs);
  }

  /** Connectivity came back: forget backoff and sync right away. */
  handleReconnect(): void {
    this.cancelRetry();
    this.setState({ failures: 0, nextRetryAt: null });
    void this.flush();
  }

  handleOffline(): void {
    this.cancelRetry();
    this.setState({ status: "offline", nextRetryAt: null });
  }

  flush(): Promise<SyncRunResult> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  dispose(): void {
    this.cancelRetry();
    if (this.debounceTimer !== null) this.clearTimer(this.debounceTimer);
    this.debounceTimer = null;
    this.listeners.clear();
  }

  private cancelRetry() {
    if (this.retryTimer !== null) this.clearTimer(this.retryTimer);
    this.retryTimer = null;
  }

  private scheduleRetry(failures: number) {
    this.cancelRetry();
    const delay = syncBackoffMs(failures, this.random);
    this.setState({ status: "backoff", nextRetryAt: this.now() + delay });
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = null;
      void this.flush();
    }, delay);
  }

  private async run(): Promise<SyncRunResult> {
    const result: SyncRunResult = { pushed: 0, applied: 0, rejected: 0, batches: 0, ok: true };
    if (!(await this.deps.isOnline())) {
      await this.refreshCounts();
      this.setState({ status: "offline" });
      return { ...result, ok: false };
    }

    this.cancelRetry();
    this.setState({ status: "syncing", lastError: null });
    const { store, transport } = this.deps;
    const deviceId = await this.deps.deviceId();

    try {
      for (const hook of this.beforeFlushHooks) await hook();

      // Always run at least once so an empty outbox still pulls deltas.
      for (;;) {
        const entries = await store.takeBatch(this.batchSize);
        const { valid, invalid } = splitValid(entries.map((e) => e.op));
        if (invalid.length) {
          await store.rejectLocally(invalid);
          result.rejected += invalid.length;
        }

        const since = await store.getCursor();
        let response: SyncResponse;
        try {
          response = await transport.push({ deviceId, since, operations: valid });
        } catch (error) {
          await store.release(
            valid.map((op) => op.opId),
            describe(error),
          );
          throw error;
        }

        await store.applyResponse(response);
        await store.settle(
          valid.map((op) => op.opId),
          response.results,
        );
        await store.setCursor(response.cursor);
        for (const hook of this.resultsHooks) await hook(response.results, response);

        result.batches += 1;
        result.pushed += valid.length;
        result.applied += response.results.filter((r) => r.status !== "rejected").length;
        result.rejected += response.results.filter((r) => r.status === "rejected").length;

        if (entries.length < this.batchSize) break;
      }

      await this.refreshCounts();
      this.setState({
        status: "idle",
        failures: 0,
        nextRetryAt: null,
        lastSyncedAt: new Date(this.now()).toISOString(),
      });
      return result;
    } catch (error) {
      await this.refreshCounts().catch(() => undefined);
      const failures = this.state.failures + 1;
      if (this.deps.isFatal?.(error)) {
        this.setState({ status: "error", failures, lastError: describe(error) });
      } else {
        this.setState({ failures, lastError: describe(error) });
        this.scheduleRetry(failures);
      }
      return { ...result, ok: false };
    }
  }
}

/** Ops that fail the shared schema are rejected locally instead of poisoning the batch. */
export function splitValid(ops: SyncOperation[]): { valid: SyncOperation[]; invalid: SyncOpResult[] } {
  const valid: SyncOperation[] = [];
  const invalid: SyncOpResult[] = [];
  for (const op of ops) {
    const parsed = syncOperationSchema.safeParse(op);
    if (parsed.success) valid.push(parsed.data);
    else invalid.push({ opId: op.opId, status: "rejected", reason: "invalid_local_operation" });
  }
  return { valid, invalid };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
