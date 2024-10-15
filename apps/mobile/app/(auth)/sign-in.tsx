import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { signInSchema } from "@learnly/shared";
import { Button } from "../../src/components/Button";
import { Icon } from "../../src/components/Icon";
import { Text } from "../../src/components/primitives";
import { TextField } from "../../src/components/TextField";
import { useCopy } from "../../src/i18n";
import { ApiError, isNetworkError } from "../../src/lib/api";
import { useSession } from "../../src/session/SessionProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

const copy = {
  welcome: "Welcome back",
  tagline: "Learning that adapts to you",
  email: "Email",
  password: "Password",
  signIn: "Sign in",
  noAccount: "New to Learnly?",
  createAccount: "Create an account",
  badCredentials: "That email and password don't match. Want to try again?",
  offline: "You're offline. Connect to the internet to sign in — your saved lessons will be waiting.",
  generic: "Something went wrong on our side. Please try again in a moment.",
  rateLimited: "Too many tries in a row. Take a breather and try again in a minute.",
};

/** The Learnly mark: a three-quarter mastery ring with a coral spark. */
export function BrandMark({ size = 72 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={50} cy={50} r={36} stroke={colors.primary} strokeOpacity={0.16} strokeWidth={10} fill="none" />
      <Path d="M50 14 A36 36 0 1 1 14 50" stroke={colors.primary} strokeWidth={10} strokeLinecap="round" fill="none" />
      <Path d="M43 33 V61 H62" stroke={colors.primary} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={14} cy={50} r={8} fill={brand.coral} />
    </Svg>
  );
}

type FieldErrors = Partial<Record<"email" | "password", string>>;

export default function SignInScreen() {
  const t = useCopy("auth", copy);
  const { signIn } = useSession();
  const { colors, spacing, reducedMotion } = useTheme();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "email" || field === "password") && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data);
    } catch (error) {
      if (isNetworkError(error)) setFormError(t("offline"));
      else if (error instanceof ApiError && error.code === "unauthorized") setFormError(t("badCredentials"));
      else if (error instanceof ApiError && error.code === "rate_limited") setFormError(t("rateLimited"));
      else setFormError(t("generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl }}
        >
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400)}
            style={{ alignItems: "center", gap: spacing.md }}
          >
            <BrandMark />
            <Text variant="display" align="center">
              {t("welcome")}
            </Text>
            <Text tone="muted" align="center">
              {t("tagline")}
            </Text>
          </Animated.View>

          <View style={{ gap: spacing.lg }}>
            <TextField
              label={t("email")}
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              testID="sign-in-email"
            />
            <TextField
              ref={passwordRef}
              label={t("password")}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secure
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              testID="sign-in-password"
            />
            {formError ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: 12,
                  backgroundColor: colors.warningSoft,
                }}
              >
                <Icon name="alert" size={18} color={colors.warningText} />
                <Text variant="callout" tone="warning" style={{ flex: 1 }}>
                  {formError}
                </Text>
              </View>
            ) : null}
            <Button label={t("signIn")} size="lg" onPress={() => void submit()} loading={busy} testID="sign-in-submit" />
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/(auth)/sign-up")}
            style={{ alignItems: "center", paddingVertical: spacing.sm }}
            hitSlop={8}
          >
            <Text tone="muted" align="center">
              {t("noAccount")}{" "}
              <Text variant="bodyStrong" tone="primary">
                {t("createAccount")}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
