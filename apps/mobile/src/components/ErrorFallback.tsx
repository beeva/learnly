import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { analytics } from "../analytics/analytics";
import { useCopy } from "../i18n";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Text } from "./primitives";

const copy = {
  title: "Something went sideways",
  body: "That's on us, not you. Your progress is saved on this device — try again, or head home and pick up where you left off.",
  retry: "Try again",
  home: "Go to home",
  details: "Technical details",
};

export interface ErrorFallbackProps {
  error: Error;
  retry: () => Promise<void>;
}

/** Shown by the root error boundary; reports once and offers two calm ways forward. */
export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  const t = useCopy("errors", copy);
  const { colors, spacing, radii } = useTheme();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    analytics.track("app_error", { name: error.name.slice(0, 60), screen: "boundary" });
  }, [error]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl }}>
        <View
          style={{
            alignSelf: "center",
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="compass" size={40} color={colors.accentText} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title" align="center">
            {t("title")}
          </Text>
          <Text tone="muted" align="center">
            {t("body")}
          </Text>
        </View>
        <View style={{ gap: spacing.md }}>
          <Button
            label={t("retry")}
            icon="refresh"
            loading={retrying}
            onPress={() => {
              setRetrying(true);
              void retry().finally(() => setRetrying(false));
            }}
          />
          <Button label={t("home")} variant="secondary" icon="home" onPress={() => router.replace("/(tabs)")} />
        </View>
        {__DEV__ ? (
          <ScrollView
            style={{ maxHeight: 160, backgroundColor: colors.surfaceMuted, borderRadius: radii.md }}
            contentContainerStyle={{ padding: spacing.md }}
          >
            <Text variant="label" tone="muted">
              {t("details")}
            </Text>
            <Text variant="caption" tone="subtle" selectable>
              {`${error.name}: ${error.message}`}
            </Text>
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
