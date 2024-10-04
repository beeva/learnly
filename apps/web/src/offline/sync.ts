import { XP_RULES, syncBackoffMs, type SyncOperation, type SyncPushInput, type SyncResponse } from "@learnly/shared";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  addRequestMiddleware,
  isApiError,
  learnerKeys,
  queryKeys,
  request,
  tokenStore,
  type ApiRequest,
  type LessonCompleteResponse,
  type MeResponse,
  type ProgressResponse,
} from "../api/client";

/*
 * Offline-first writes, mirroring the mobile app's outbox: when the network is
 * unavailable, lesson completions and preference changes are recorded as sync
 * operations and pushed to POST /v1/sync once the device is back online.
 */

const OUTBOX_KEY = "learnly.outbox";
const DEVICE_KEY = "learnly.device";
const CURSOR_KEY = "learnly.sync-cursor";

export type SyncStatus = "idle" | "syncing" | "error";

interface OutboxState {
  operations: SyncOperation[];
  status: SyncStatus;
  failures: number;
  lastSyncedAt: string | null;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function deviceId(): string {
  let id = readJson<string | null>(DEVICE_KEY, null);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(id));
    } catch {
      /* storage blocked: a per-session id still lets the server dedupe */
    }
  }
  return id;
}

let state: OutboxState = { operations: readJson<SyncOperation[]>(OUTBOX_KEY, []), status: "idle", failures: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let client: QueryClient | null = null;

function setState(patch: Partial<OutboxState>) {
  state = { ...state, ...patch };
  if (patch.operations) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(state.operations));
    } catch {
      /* storage full: keep in memory */
    }
  }
  listeners.forEach((listener) => listener());
}

export const outbox = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  enqueue(operation: SyncOperation) {
    setState({ operations: [...state.operations, operation] });
  },
  clear() {
    setState({ operations: [], failures: 0, status: "idle" });
  },
};

/** Push queued operations. Safe to call repeatedly; only one push runs at a time. */
export async function flushOutbox(): Promise<void> {
  if (state.status === "syncing" || state.operations.length === 0 || !tokenStore.has()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;

  const batch = state.operations.slice(0, 200);
  setState({ status: "syncing" });
  try {
    const body: SyncPushInput = { deviceId: deviceId(), since: readJson<string | null>(CURSOR_KEY, null), operations: batch };
    const response = await request<SyncResponse>("/sync", { method: "POST", body });
    const settled = new Set(response.results.map((result) => result.opId));
    localStorage.setItem(CURSOR_KEY, JSON.stringify(response.cursor));
    setState({
      operations: state.operations.filter((op) => !settled.has(op.opId)),
      status: "idle",
      failures: 0,
      lastSyncedAt: response.serverTime,
    });
    if (client) {
      void client.invalidateQueries({ queryKey: learnerKeys.progress });
      void client.invalidateQueries({ queryKey: learnerKeys.recommendations });
      void client.invalidateQueries({ queryKey: queryKeys.me });
    }
    if (state.operations.length > 0) void flushOutbox();
  } catch (error) {
    const failures = state.failures + 1;
    setState({ status: "error", failures });
    // Auth problems resolve on the next sign-in; everything else retries with backoff.
    if (!isApiError(error, "unauthorized")) retryTimer = setTimeout(() => void flushOutbox(), syncBackoffMs(failures));
  }
}

function isOfflineError(error: unknown): boolean {
  return isApiError(error, "network") || (typeof navigator !== "undefined" && navigator.onLine === false);
}

/** Queue writes that can safely be replayed later and answer them optimistically. */
async function offlineMiddleware(req: ApiRequest, next: (req: ApiRequest) => Promise<unknown>): Promise<unknown> {
  const lessonMatch = req.method === "POST" ? /^\/lessons\/([^/]+)\/complete$/.exec(req.path) : null;
  const isPreferences = req.method === "PATCH" && req.path === "/me/preferences";
  if (!lessonMatch && !isPreferences) return next(req);

  try {
    return await next(req);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    const createdAt = new Date().toISOString();

    if (lessonMatch) {
      const progress = client?.getQueryData<ProgressResponse>(learnerKeys.progress);
      const lessonId = decodeURIComponent(lessonMatch[1] ?? "");
      const durationMs = (req.body as { durationMs?: number } | undefined)?.durationMs ?? 0;
      if (!progress) throw error;
      outbox.enqueue({ opId: crypto.randomUUID(), type: "lesson.complete", createdAt, payload: { lessonId, durationMs } });
      const optimistic: LessonCompleteResponse = {
        xpEarned: XP_RULES.lessonComplete,
        progress: {
          totalXp: progress.totalXp + XP_RULES.lessonComplete,
          level: progress.level,
          streak: progress.streak,
          minutesToday: progress.minutesToday + Math.round(durationMs / 60_000),
          dailyGoalMinutes: progress.dailyGoalMinutes,
        },
      };
      return optimistic;
    }

    const me = client?.getQueryData<MeResponse>(queryKeys.me);
    if (!me) throw error;
    const payload = (req.body ?? {}) as Extract<SyncOperation, { type: "preferences.update" }>["payload"];
    outbox.enqueue({ opId: crypto.randomUUID(), type: "preferences.update", createdAt, payload });
    const { displayName: _name, avatarColor: _color, ...prefs } = payload;
    return { preferences: { ...me.preferences, ...Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== undefined)) } };
  }
}

/* ------------------------------------------------------------------ hooks */

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function useOutbox() {
  const snapshot = useSyncExternalStore(outbox.subscribe, outbox.getState, outbox.getState);
  return { ...snapshot, pending: snapshot.operations.length, flush: flushOutbox };
}

/* ---------------------------------------------------------------- install */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      console.warn("[learnly] service worker registration failed", error);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function linkManifest() {
  if (document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.webmanifest";
  document.head.append(link);
}

let installed = false;

export function installOfflineSupport(queryClient: QueryClient, options: { serviceWorker: boolean }): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  client = queryClient;
  linkManifest();
  addRequestMiddleware(offlineMiddleware);
  if (options.serviceWorker && import.meta.env.PROD) registerServiceWorker();

  window.addEventListener("online", () => void flushOutbox());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushOutbox();
  });

  // Signing out on a shared device clears the queue and any cached lessons.
  tokenStore.subscribe(() => {
    if (tokenStore.has()) {
      void flushOutbox();
      return;
    }
    outbox.clear();
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-user-cache" });
  });

  void flushOutbox();
}
