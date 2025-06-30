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

