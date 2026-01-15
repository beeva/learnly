import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { ZoomIn } from "react-native-reanimated";
import { joinClassroomSchema } from "@learnly/shared";
import { announce } from "../src/a11y/announce";
import { analytics } from "../src/analytics/analytics";
import { Button, IconButton } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Icon } from "../src/components/Icon";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { Screen, Text } from "../src/components/primitives";
import { TextField } from "../src/components/TextField";
import { useCopy } from "../src/i18n";
import { ApiError, classroomApi, isNetworkError, type JoinedClassroom } from "../src/lib/api";
import { useIsOnline } from "../src/sync";
import { useTheme } from "../src/theme/ThemeProvider";

const copy = {
  title: "Join your class",
  body: "Your teacher will share a 6-character code. Joining lets them see which skills need a little more help — never your individual answers in front of the class.",
  label: "Class code",
  hint: "Letters and numbers, like K7M2QX",
  join: "Join class",
  back: "Back",
  notFound: "We couldn't find a class with that code. Double-check it with your teacher?",
  already: "You're already in this class — nice!",
  forbidden: "Only student accounts can join a class.",
  offline: "Joining a class needs a connection. Everything else keeps working offline.",
  generic: "Something went wrong joining. Please try again.",
  joinedTitle: "You're in!",
  joinedBody: "Welcome to {name}. Your teacher can now cheer on your progress.",
  done: "Back to profile",
};

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export default function JoinClassroomScreen() {
  const t = useCopy("classroom", copy);
  const { colors, spacing } = useTheme();
  const online = useIsOnline();
  const params = useLocalSearchParams<{ code?: string }>();
  const initial = typeof params.code === "string" ? normalizeCode(params.code) : "";
  const [code, setCode] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<JoinedClassroom | null>(null);

  const submit = async () => {
    const parsed = joinClassroomSchema.safeParse({ joinCode: code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("notFound"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { classroom } = await classroomApi.join(parsed.data.joinCode);
      setJoined(classroom);
      analytics.track("classroom_joined", { viaLink: Boolean(initial) });
      announce(t("joinedBody", { name: classroom.name }));
    } catch (e) {
      if (isNetworkError(e)) setError(t("offline"));
      else if (e instanceof ApiError && e.code === "not_found") setError(t("notFound"));
      else if (e instanceof ApiError && e.code === "conflict") setError(t("already"));
      else if (e instanceof ApiError && e.code === "forbidden") setError(t("forbidden"));
      else setError(t("generic"));
    } finally {
      setBusy(false);
    }
  };

  if (joined) {
    return (
      <Screen contentStyle={{ flexGrow: 1, justifyContent: "center", gap: spacing.xl }}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignSelf: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.successSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="users" size={44} color={colors.successText} />
          </View>
        </Animated.View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title" align="center">
            {t("joinedTitle")}
          </Text>
          <Text tone="muted" align="center">
            {t("joinedBody", { name: joined.name })}
          </Text>
        </View>
        <Button label={t("done")} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen
        footer={
          <Button
            label={t("join")}
            icon="users"
            onPress={() => void submit()}
            loading={busy}
            disabled={!online || code.length !== 6}
            testID="join-submit"
          />
        }
      >
        <IconButton icon="arrowLeft" label={t("back")} onPress={() => router.back()} />
        <OfflineBanner />
        <Text variant="title">{t("title")}</Text>
        <Text tone="muted">{t("body")}</Text>
        <Card style={{ gap: spacing.md }}>
          <TextField
            label={t("label")}
            hint={online ? t("hint") : t("offline")}
            error={error}
            value={code}
            large
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            onChangeText={(next) => {
              setCode(normalizeCode(next));
              setError(null);
            }}
            testID="join-code"
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
