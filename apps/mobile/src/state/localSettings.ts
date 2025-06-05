import { useSyncExternalStore } from "react";
import { kvGet, kvSet } from "../db/schema";

/**
 * Settings that belong to this device rather than the learner's account: a
 * reminder at 6:30pm makes sense on a phone, not necessarily on a shared tablet.
 */
export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  /** Quiet hours as minutes after midnight; the window may cross midnight. */
  quietStart: number;
  quietEnd: number;
}

export interface LocalSettings {
  reminders: ReminderSettings;
  analyticsEnabled: boolean;
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  reminders: { enabled: false, hour: 18, minute: 30, quietStart: 21 * 60, quietEnd: 7 * 60 + 30 },
  analyticsEnabled: true,
};

const KEY = "localSettings";
let current: LocalSettings = DEFAULT_LOCAL_SETTINGS;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getLocalSettings(): LocalSettings {
  return current;
}

export async function loadLocalSettings(): Promise<LocalSettings> {
  const stored = await kvGet<Partial<LocalSettings>>(KEY).catch(() => null);
  current = {
    ...DEFAULT_LOCAL_SETTINGS,
    ...stored,
    reminders: { ...DEFAULT_LOCAL_SETTINGS.reminders, ...stored?.reminders },
  };
  emit();
  return current;
}

export async function updateLocalSettings(
  change: Partial<LocalSettings> | ((settings: LocalSettings) => LocalSettings),
): Promise<LocalSettings> {
  current = typeof change === "function" ? change(current) : { ...current, ...change };
  emit();
  await kvSet(KEY, current);
  return current;
}

export function subscribeLocalSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocalSettings(): LocalSettings {
  return useSyncExternalStore(subscribeLocalSettings, getLocalSettings, getLocalSettings);
}
