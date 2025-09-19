import type { QueryClient } from "@tanstack/react-query";
import { eventsApi, type AnalyticsEvent } from "../api/client";

export type EventProps = Record<string, string | number | boolean>;

export interface TrackerOptions {
  send: (events: AnalyticsEvent[], options: { keepalive?: boolean }) => Promise<unknown>;
  /** Flush once this many events are queued. */
  maxBatch?: number;
  /** Flush at least this often while events are waiting. */
  flushIntervalMs?: number;
  /** Events kept while offline before the oldest are dropped. */
  maxQueue?: number;
  now?: () => Date;
  enabled?: boolean;
}

/**
 * Product analytics with batching: events are queued and sent to POST /v1/events
 * in small batches, on a timer, or with `keepalive` when the page is hidden.
 * Props are primitives only — never names, emails or free-text answers.
 */
export class EventTracker {
  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private readonly options: Required<Omit<TrackerOptions, "send">> & Pick<TrackerOptions, "send">;

  constructor(options: TrackerOptions) {
    this.options = {
      maxBatch: 20,
      flushIntervalMs: 10_000,
      maxQueue: 500,
      now: () => new Date(),
      enabled: true,
      ...options,
    };
  }

  get size(): number {
    return this.queue.length;
  }

  track(name: string, props?: EventProps): void {
    if (!this.options.enabled) return;
    const event: AnalyticsEvent = { name, at: this.options.now().toISOString(), ...(props && Object.keys(props).length > 0 ? { props } : {}) };
    this.queue.push(event);
    if (this.queue.length > this.options.maxQueue) this.queue.splice(0, this.queue.length - this.options.maxQueue);
    if (this.queue.length >= this.options.maxBatch) void this.flush();
    else this.schedule();
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.flushIntervalMs);
  }

  /** Send everything queued. Failed batches go back to the front of the queue. */
  async flush(options: { keepalive?: boolean } = {}): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight && !options.keepalive) return this.inFlight;
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.options.maxBatch * (options.keepalive ? 5 : 1));
    const run = (async () => {
      try {
        await this.options.send(batch, options);
      } catch {
        this.queue.unshift(...batch);
        if (this.queue.length > this.options.maxQueue) this.queue.length = this.options.maxQueue;
        this.schedule();
      } finally {
        this.inFlight = null;
      }
    })();
    this.inFlight = run;
    await run;
    if (this.queue.length >= this.options.maxBatch) await this.flush(options);
  }

  reset(): void {
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

function analyticsAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  // Learners are often children: honour Do Not Track and Global Privacy Control.
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack !== "1" && nav.globalPrivacyControl !== true;
}

export const tracker = new EventTracker({
  send: (events, options) => eventsApi.send(events, options),
  enabled: analyticsAllowed() && import.meta.env.MODE !== "test",
});

export function track(name: string, props?: EventProps): void {
  tracker.track(name, props);
}

type MutationKey = readonly unknown[] | undefined;

function keyIs(key: MutationKey, ...parts: string[]): boolean {
  return Array.isArray(key) && parts.every((part, index) => key[index] === part);
}

/** Derive learning events from mutations so screens never call analytics directly. */
export function describeMutation(key: MutationKey, data: unknown, variables: unknown): { name: string; props: EventProps } | null {
  if (keyIs(key, "attempt")) {
    const result = data as { correct?: boolean; xpEarned?: number; encouragementKey?: string } | undefined;
    const input = variables as { hintsUsed?: number; durationMs?: number; response?: { kind?: string }; sessionId?: string | null } | undefined;
    return {
      name: "item_answered",
      props: {
        correct: Boolean(result?.correct),
        hints: input?.hintsUsed ?? 0,
        durationMs: input?.durationMs ?? 0,
        kind: input?.response?.kind ?? "unknown",
        inSession: Boolean(input?.sessionId),
        mastered: result?.encouragementKey === "mastered",
      },
    };
  }
  if (keyIs(key, "lesson", "complete")) {
    const result = data as { xpEarned?: number } | undefined;
    const input = variables as { durationMs?: number } | undefined;
    return { name: "lesson_completed", props: { xp: result?.xpEarned ?? 0, durationMs: input?.durationMs ?? 0 } };
  }
  if (keyIs(key, "session", "start")) {
    const input = variables as { kind?: string } | undefined;
    return { name: "session_started", props: { kind: input?.kind ?? "practice" } };
  }
  if (keyIs(key, "session", "complete")) {
    const result = data as { xpEarned?: number; session?: { kind?: string; itemsAnswered?: number; itemsCorrect?: number } } | undefined;
    return {
      name: "session_completed",
      props: {
        kind: result?.session?.kind ?? "practice",
        xp: result?.xpEarned ?? 0,
        answered: result?.session?.itemsAnswered ?? 0,
        correct: result?.session?.itemsCorrect ?? 0,
      },
    };
  }
  if (keyIs(key, "preferences")) {
    const input = (variables ?? {}) as Record<string, unknown>;
    return { name: "preferences_updated", props: { fields: Object.keys(input).sort().join(",") } };
  }
  if (keyIs(key, "classroom", "create")) return { name: "classroom_created", props: {} };
  if (keyIs(key, "classroom", "join")) return { name: "classroom_joined", props: {} };
  return null;
}

let installed = false;

export function installAnalytics(queryClient: QueryClient): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    const description = describeMutation(event.mutation.options.mutationKey, event.action.data, event.mutation.state.variables);
    if (description) track(description.name, description.props);
  });

  // Last chance to deliver events: the page is being hidden or closed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void tracker.flush({ keepalive: true });
  });
  window.addEventListener("pagehide", () => void tracker.flush({ keepalive: true }));
}
