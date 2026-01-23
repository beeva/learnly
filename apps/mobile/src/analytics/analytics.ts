import { AppState } from "react-native";
import { eventsApi, type AnalyticsEvent } from "../lib/api";
import { kvGet, kvSet } from "../db/schema";
import { getLocalSettings } from "../state/localSettings";
import { isOnlineNow, syncEngine } from "../sync";
import { subscribeOutbox } from "../sync/outbox";

/**
 * Privacy-first product analytics. Events carry a name, a timestamp and a few
 * coarse properties — never names, emails or what a student typed. They are
 * queued on the device and sent in small batches to `POST /v1/events`.
 */
export type AnalyticsProps = Record<string, string | number | boolean>;

export const ANALYTICS_QUEUE_KEY = "analytics.queue";
export const MAX_QUEUE = 500;
export const BATCH_SIZE = 50;
export const FLUSH_INTERVAL_MS = 30_000;

let queue: AnalyticsEvent[] = [];
let hydrated: Promise<void> | null = null;
let flushing: Promise<number> | null = null;

function hydrate(): Promise<void> {
  if (!hydrated) {
    hydrated = kvGet<AnalyticsEvent[]>(ANALYTICS_QUEUE_KEY)
      .then((stored) => {
        if (stored?.length) queue = [...stored, ...queue].slice(-MAX_QUEUE);
      })
      .catch(() => undefined);
  }
  return hydrated;
}

/** Writes wait for hydration so events stored by a previous launch are merged, never duplicated. */
function persist(): Promise<void> {
  return hydrate()
    .then(() => kvSet(ANALYTICS_QUEUE_KEY, queue))
    .catch(() => undefined);
}

function track(name: string, props?: AnalyticsProps): void {
  if (getLocalSettings().analyticsEnabled === false) return;
  const event: AnalyticsEvent = { name, at: new Date().toISOString(), ...(props ? { props } : null) };
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  void persist();
}

async function sendQueued(): Promise<number> {
  await hydrate();
  if (getLocalSettings().analyticsEnabled === false) {
    queue = [];
    await persist();
    return 0;
  }
  let sent = 0;
  while (queue.length > 0 && isOnlineNow()) {
    const batch = queue.slice(0, BATCH_SIZE);
    try {
      await eventsApi.send(batch);
    } catch {
      break; // keep the events; try again on the next flush
    }
    queue = queue.slice(batch.length);
    sent += batch.length;
    await persist();
  }
  return sent;
}

function flush(): Promise<number> {
  if (!flushing) {
    flushing = sendQueued().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

function start(): () => void {
  void hydrate();
  track("app_opened");

  const interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  const appState = AppState.addEventListener("change", (next) => {
    if (next === "background") void flush();
  });

  const unsubscribeOutbox = subscribeOutbox((event) => {
    if (event.type !== "enqueued") return;
    switch (event.op.type) {
      case "attempt.create":
        track("attempt_recorded", { offline: !isOnlineNow(), hints: event.op.payload.hintsUsed });
        break;
      case "lesson.complete":
        track("lesson_completed", { minutes: Math.max(1, Math.round(event.op.payload.durationMs / 60_000)) });
        break;
      case "preferences.update":
        track("preferences_changed", { fields: Object.keys(event.op.payload).sort().join(",") });
        break;
    }
  });

  let lastStatus = syncEngine.getState().status;
  const unsubscribeSync = syncEngine.subscribe((state) => {
    if (state.status === lastStatus) return;
    if (lastStatus === "syncing" && state.status === "idle") track("sync_completed", { pending: state.pending });
    if (state.status === "error") track("sync_failed", { failures: state.failures });
    lastStatus = state.status;
  });

  return () => {
    clearInterval(interval);
    appState.remove();
    unsubscribeOutbox();
    unsubscribeSync();
  };
}

export const analytics = {
  track,
  flush,
  start,
  /** Visible for tests and the debug screen. */
  pending: () => queue.length,
  reset: () => {
    queue = [];
    hydrated = null;
  },
};
