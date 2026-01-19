import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { kvGet, kvSet } from "../db/schema";
import { translate } from "../i18n";
import type { MeResponse } from "../lib/api";
import { getLocalSettings, loadLocalSettings, subscribeLocalSettings } from "../state/localSettings";
import { subscribeOutbox } from "../sync/outbox";
import { PROGRESS_SNAPSHOT_KEY, type ProgressSnapshot } from "../sync";
import { nextReminderTimes } from "./quietHours";

const ID_PREFIX = "streak-";
const CHANNEL_ID = "reminders";
const LAST_PRACTICE_KEY = "reminders.lastPracticeDay";

export type ReminderPermission = "granted" | "denied" | "undetermined";

/** Shows reminders as a banner even when the app is open (they're gentle, not urgent). */
export function configureReminderHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Streak reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      lightColor: "#5B5BD6",
    }).catch(() => undefined);
  }
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  const current = await getReminderPermission();
  if (current !== "undetermined") return current;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return status === "granted" ? "granted" : "denied";
}

function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

async function currentStreak(): Promise<number> {
  const [snapshot, me] = await Promise.all([
    kvGet<ProgressSnapshot>(PROGRESS_SNAPSHOT_KEY).catch(() => null),
    kvGet<MeResponse>("me").catch(() => null),
  ]);
  return Math.max(snapshot?.streak ?? 0, me?.progress.streak.current ?? 0);
}

/** Copy varies so a daily reminder doesn't turn into wallpaper. */
export function reminderCopy(streak: number, dayIndex: number): { title: string; body: string } {
  if (streak >= 2) {
    return {
      title: translate("reminders", "streakTitle", "Keep your {count}-day streak glowing", { count: streak }),
      body: translate("reminders", "streakBody", "One quick practice keeps it going. You've got this!"),
    };
  }
  const variants = [
    {
      title: translate("reminders", "lessonTitle", "A 5-minute lesson is waiting"),
      body: translate("reminders", "lessonBody", "Pick up right where you left off."),
    },
    {
      title: translate("reminders", "practiceTitle", "Ready for a quick warm-up?"),
      body: translate("reminders", "practiceBody", "A few questions, picked just for you."),
    },
  ];
  return variants[dayIndex % variants.length]!;
}

export async function cancelReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Replaces our scheduled reminders with the next week's worth. Returns how many were scheduled. */
export async function rescheduleReminders(options: { practicedToday?: boolean; now?: Date } = {}): Promise<number> {
  await cancelReminders();
  const { reminders } = getLocalSettings();
  if (!reminders.enabled) return 0;
  if ((await getReminderPermission()) !== "granted") return 0;

  const now = options.now ?? new Date();
  const practicedToday =
    options.practicedToday ?? (await kvGet<string>(LAST_PRACTICE_KEY).catch(() => null)) === localDay(now);
  const streak = await currentStreak();
  const times = nextReminderTimes({ now, ...reminders, practicedToday });

  for (const [index, date] of times.entries()) {
    const { title, body } = reminderCopy(streak, index);
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${localDay(date)}`,
      content: { title, body, data: { url: "/(tabs)" }, sound: false },
      trigger: date,
    });
  }
  return times.length;
}

/**
 * Keeps reminders honest: practicing today cancels today's nudge, changing the
 * time or quiet hours reschedules, and tapping a reminder opens Home.
 */
export function bootReminders(): () => void {
  let disposed = false;
  void loadLocalSettings()
    .then(() => (disposed ? 0 : rescheduleReminders()))
    .catch(() => undefined);

  const unsubscribeOutbox = subscribeOutbox((event) => {
    if (event.type !== "enqueued") return;
    if (event.op.type !== "attempt.create" && event.op.type !== "lesson.complete") return;
    const today = localDay(new Date());
    void kvGet<string>(LAST_PRACTICE_KEY)
      .then(async (last) => {
        if (last === today) return;
        await kvSet(LAST_PRACTICE_KEY, today);
        await rescheduleReminders({ practicedToday: true });
      })
      .catch(() => undefined);
  });

  let previous = JSON.stringify(getLocalSettings().reminders);
  const unsubscribeSettings = subscribeLocalSettings(() => {
    const next = JSON.stringify(getLocalSettings().reminders);
    if (next === previous) return;
    previous = next;
    void rescheduleReminders().catch(() => undefined);
  });

  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const url = event.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) router.push(url);
  });

  return () => {
    disposed = true;
    unsubscribeOutbox();
    unsubscribeSettings();
    response.remove();
  };
}
