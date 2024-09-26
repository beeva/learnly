import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { randomUUID } from "expo-crypto";
import type { SyncResponse } from "@learnly/shared";
import { ApiError, syncApi } from "../lib/api";
import { kvGet, kvSet } from "../db/schema";
import { lessonRepo, masteryRepo } from "../db/repo";
import * as outbox from "./outbox";
import { SyncEngine, type SyncState, type SyncStore } from "./engine";

const CURSOR_KEY = "sync.cursor";
const DEVICE_KEY = "deviceId";
export const PROGRESS_SNAPSHOT_KEY = "sync.progress";

export type ProgressSnapshot = SyncResponse["progress"] & { at: string };

export function isOnlineState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function getDeviceId(): Promise<string> {
  const existing = await kvGet<string>(DEVICE_KEY);
  if (existing) return existing;
  const id = `${Platform.OS}-${randomUUID()}`.slice(0, 64);
  await kvSet(DEVICE_KEY, id);
  return id;
}

const sqliteStore: SyncStore = {
  takeBatch: (limit) => outbox.takeBatch(limit),
  settle: (sent, results) => outbox.settle(sent, results),
  release: (opIds, error) => outbox.release(opIds, error),
  rejectLocally: (results) => outbox.settle([], results),
  pendingCount: async () => {
    const c = await outbox.counts();
    return c.pending + c.inflight;
  },
  rejectedCount: async () => {
    const c = await outbox.counts();
    return c.rejected + c.dead;
  },
  getCursor: () => kvGet<string>(CURSOR_KEY),
  setCursor: (cursor) => kvSet(CURSOR_KEY, cursor),
  async applyResponse(response) {
    // Server state is authoritative. Optimistic mastery for attempts that are still
    // unconfirmed is replayed on read (see offline/practice.ts), so nothing is lost here.
    await masteryRepo.applyDelta(response.mastery, response.serverTime);
    await lessonRepo.applyDelta(response.lessons);
    const snapshot: ProgressSnapshot = { ...response.progress, at: response.serverTime };
    await kvSet(PROGRESS_SNAPSHOT_KEY, snapshot);
  },
};

export const syncEngine = new SyncEngine({
  store: sqliteStore,
  transport: { push: (input) => syncApi.push(input) },
  deviceId: getDeviceId,
  isOnline: async () => isOnlineState(await NetInfo.fetch()),
  isFatal: (error) => error instanceof ApiError && (error.status === 401 || error.status === 403),
});

syncEngine.onBeforeFlush(async () => {
  await outbox.compact();
});

/**
 * Starts background sync: on reconnect, on returning to the foreground, and
 * shortly after every local write. Returns a cleanup function.
 */
export function startSync(): () => void {
  let wasOnline: boolean | null = null;
  void outbox.recoverInflight().then(() => syncEngine.refreshCounts());

  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);
    if (online && wasOnline !== true) syncEngine.handleReconnect();
    if (!online && wasOnline !== false) syncEngine.handleOffline();
    wasOnline = online;
  });

  const appState = AppState.addEventListener("change", (next) => {
    if (next === "active") syncEngine.requestSync(250);
  });

  const unsubscribeOutbox = outbox.subscribeOutbox((event) => {
    if (event.type === "enqueued") syncEngine.requestSync();
    else void syncEngine.refreshCounts();
  });

  return () => {
    unsubscribeNet();
    appState.remove();
    unsubscribeOutbox();
  };
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => syncEngine.subscribe(listener),
    () => syncEngine.getState(),
    () => syncEngine.getState(),
  );
}

/** Live connectivity for UI (offline banner, disabling online-only actions). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnline, getOnline);
}

let online = true;
const onlineListeners = new Set<() => void>();
NetInfo.addEventListener((state) => {
  const next = isOnlineState(state);
  if (next !== online) {
    online = next;
    onlineListeners.forEach((l) => l());
  }
});

function subscribeOnline(listener: () => void) {
  onlineListeners.add(listener);
  return () => onlineListeners.delete(listener);
}

function getOnline() {
  return online;
}

export function isOnlineNow(): boolean {
  return online;
}
