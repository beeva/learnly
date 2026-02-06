import { View } from "react-native";
import { router, Stack } from "expo-router";
import { Button } from "../src/components/Button";
import { Icon } from "../src/components/Icon";
import { Screen, Text } from "../src/components/primitives";
import { useCopy } from "../src/i18n";
import { useTheme } from "../src/theme/ThemeProvider";

const copy = {
  title: "This page wandered off",
  body: "The link may be old, or the lesson may have moved. Let's get you back to learning.",
  home: "Back to home",
};

export default function NotFoundScreen() {
  const t = useCopy("notFound", copy);
  const { colors, spacing } = useTheme();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentStyle={{ flexGrow: 1, justifyContent: "center", gap: spacing.xl }}>
        <View
          style={{
            alignSelf: "center",
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="compass" size={40} color={colors.primaryText} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title" align="center">
            {t("title")}
          </Text>
          <Text tone="muted" align="center">
            {t("body")}
          </Text>
        </View>
        <Button label={t("home")} icon="home" onPress={() => router.replace("/(tabs)")} />
      </Screen>
    </>
  );
}
