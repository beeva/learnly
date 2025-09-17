import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { formatTime, useCopy, useLocale } from "../../i18n";
import { nextReminderTimes } from "../../notifications/quietHours";
import { getReminderPermission, requestReminderPermission } from "../../notifications/reminders";
import { updateLocalSettings, useLocalSettings, type ReminderSettings as Reminders } from "../../state/localSettings";
import { useTheme } from "../../theme/ThemeProvider";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Text } from "../primitives";
import { minutesToDate, SettingsGroup, StepperRow, SwitchRow } from "../SettingRow";

const copy = {
  title: "Streak reminders",
  footer: "One friendly nudge a day, only if you haven't practiced yet — and never during quiet hours.",
  enabled: "Daily reminder",
  enabledHint: "We'll skip it on days you've already practiced.",
  time: "Remind me at",
  earlier: "Earlier",
  later: "Later",
  quietStart: "Quiet hours start",
  quietEnd: "Quiet hours end",
  denied: "Notifications are turned off for Learnly in your device settings.",
  openSettings: "Open settings",
  next: "Next reminder: {time}",
};

const STEP = 15;
const DAY = 24 * 60;

export function ReminderSettings() {
  const t = useCopy("settings.reminders", copy);
  const { colors, spacing, radii } = useTheme();
  const locale = useLocale();
  const { reminders } = useLocalSettings();
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");

  useEffect(() => {
    void getReminderPermission().then(setPermission);
  }, []);

  const save = (patch: Partial<Reminders>) =>
    void updateLocalSettings((s) => ({ ...s, reminders: { ...s.reminders, ...patch } }));

  const toggle = async (enabled: boolean) => {
    if (enabled && permission !== "granted") {
      const result = await requestReminderPermission();
      setPermission(result);
      if (result !== "granted") return;
    }
    save({ enabled });
  };

  const timeMinutes = reminders.hour * 60 + reminders.minute;
  const label = (minutes: number) => formatTime(minutesToDate(((minutes % DAY) + DAY) % DAY));
  const nextTime = useMemo(
    () =>
      reminders.enabled
        ? nextReminderTimes({
            now: new Date(),
            hour: reminders.hour,
            minute: reminders.minute,
            quietStart: reminders.quietStart,
            quietEnd: reminders.quietEnd,
            practicedToday: false,
            days: 1,
          })[0]
        : undefined,
    [reminders],
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <SettingsGroup title={t("title")} footer={t("footer")}>
        <SwitchRow
          icon="bell"
          label={t("enabled")}
          description={t("enabledHint")}
          value={reminders.enabled && permission === "granted"}
          onValueChange={(next) => void toggle(next)}
          last={!reminders.enabled}
        />
        {reminders.enabled ? (
          <>
            <StepperRow
              icon="clock"
              label={t("time")}
              value={timeMinutes}
              display={label(timeMinutes)}
              min={0}
              max={DAY - STEP}
              step={STEP}
              decreaseLabel={t("earlier")}
              increaseLabel={t("later")}
              onChange={(m) => save({ hour: Math.floor(m / 60), minute: m % 60 })}
            />
            <StepperRow
              label={t("quietStart")}
              value={reminders.quietStart}
              display={label(reminders.quietStart)}
              min={0}
              max={DAY - STEP}
              step={STEP}
              decreaseLabel={t("earlier")}
              increaseLabel={t("later")}
              onChange={(quietStart) => save({ quietStart })}
            />
            <StepperRow
              label={t("quietEnd")}
              value={reminders.quietEnd}
              display={label(reminders.quietEnd)}
              min={0}
              max={DAY - STEP}
              step={STEP}
              decreaseLabel={t("earlier")}
              increaseLabel={t("later")}
              onChange={(quietEnd) => save({ quietEnd })}
              last
            />
          </>
        ) : null}
      </SettingsGroup>

      {nextTime ? (
        <Text variant="caption" tone="primary" style={{ marginHorizontal: spacing.xs }} accessibilityLiveRegion="polite">
          {t("next", {
            time: `${nextTime.toLocaleDateString(locale === "fil" ? "fil-PH" : locale, { weekday: "short" })} ${formatTime(nextTime)}`,
          })}
        </Text>
      ) : null}

      {permission === "denied" ? (
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            alignItems: "center",
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.warningSoft,
          }}
        >
          <Icon name="alert" size={18} color={colors.warningText} />
          <Text variant="caption" tone="warning" style={{ flex: 1 }}>
            {t("denied")}
          </Text>
          <Button
            label={t("openSettings")}
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={() => void Linking.openSettings()}
          />
        </View>
      ) : null}
    </View>
  );
}
