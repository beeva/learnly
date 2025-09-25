import { useRef } from "react";
import { View, type Text as RNText } from "react-native";
import { router } from "expo-router";
import { useFocusOnMount } from "../src/a11y/announce";
import { IconButton } from "../src/components/Button";
import { Screen, Text } from "../src/components/primitives";
import { LinkRow, SettingsGroup, SwitchRow } from "../src/components/SettingRow";
import { ComfortSettings } from "../src/components/settings/ComfortSettings";
import { LanguageSettings } from "../src/components/settings/LanguageSettings";
import { ReminderSettings } from "../src/components/settings/ReminderSettings";
import { useCopy } from "../src/i18n";
import { updateLocalSettings, useLocalSettings } from "../src/state/localSettings";
import { useTheme } from "../src/theme/ThemeProvider";

const copy = {
  title: "Settings",
  back: "Back",
  more: "More",
  sync: "Sync & offline data",
  syncHint: "See what's waiting to upload",
  downloads: "Downloaded lessons",
  analytics: "Share anonymous usage",
  analyticsHint: "Helps us find confusing screens. Never includes your answers or name.",
};

export default function SettingsScreen() {
  const t = useCopy("settings.screen", copy);
  const { spacing } = useTheme();
  const { analyticsEnabled } = useLocalSettings();
  const titleRef = useRef<RNText>(null);
  useFocusOnMount(titleRef);

  return (
    <Screen contentStyle={{ gap: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconButton icon="arrowLeft" label={t("back")} onPress={() => router.back()} />
        <Text ref={titleRef} variant="title">
          {t("title")}
        </Text>
      </View>

      <ComfortSettings />
      <LanguageSettings />
      <ReminderSettings />

      <SettingsGroup title={t("more")}>
        <LinkRow
          icon="refresh"
          label={t("sync")}
          description={t("syncHint")}
          onPress={() => router.push("/sync-status")}
        />
        <LinkRow icon="download" label={t("downloads")} onPress={() => router.push("/downloads")} />
        <SwitchRow
          icon="chart"
          label={t("analytics")}
          description={t("analyticsHint")}
          value={analyticsEnabled}
          onValueChange={(next) => void updateLocalSettings((s) => ({ ...s, analyticsEnabled: next }))}
          last
        />
      </SettingsGroup>
    </Screen>
  );
}
