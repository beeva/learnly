import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GRADE_BANDS, signUpSchema, type GradeBand } from "@learnly/shared";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { Text } from "../../src/components/primitives";
import { TextField } from "../../src/components/TextField";
import { useCopy } from "../../src/i18n";
import { ApiError, isNetworkError } from "../../src/lib/api";
import { useSession } from "../../src/session/SessionProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { BrandMark } from "./sign-in";

const copy = {
  title: "Let's get you started",
  tagline: "A few details and we'll find the right starting point together.",
  name: "Your first name",
  nameHint: "This is how Learnly will greet you.",
  email: "Email",
  password: "Password",
  passwordHint: "At least 10 characters, with letters and numbers.",
  grade: "Which grades are you in?",
  gradeOptional: "Optional — it helps us suggest courses.",
  "grade.k-2": "K–2",
  "grade.3-5": "3–5",
  "grade.6-8": "6–8",
  "grade.9-12": "9–12",
  create: "Create my account",
  haveAccount: "Already learning with us?",
  signIn: "Sign in",
  exists: "There's already an account with that email. Try signing in instead.",
  offline: "You're offline. Connect to the internet to create your account.",
  generic: "Something went wrong on our side. Please try again in a moment.",
};

type Field = "displayName" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

export default function SignUpScreen() {
  const t = useCopy("auth.signUp", copy);
  const { signUp } = useSession();
  const { colors, spacing, reducedMotion } = useTheme();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gradeBand, setGradeBand] = useState<GradeBand | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const parsed = signUpSchema.safeParse({ displayName, email, password, role: "student", gradeBand });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "displayName" || field === "email" || field === "password") && !next[field]) {
          next[field] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signUp(parsed.data);
    } catch (error) {
      if (isNetworkError(error)) setFormError(t("offline"));
      else if (error instanceof ApiError && error.code === "conflict") setFormError(t("exists"));
      else if (error instanceof ApiError && error.code === "validation_failed") setFormError(error.message);
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
            <BrandMark size={60} />
            <Text variant="title" align="center">
              {t("title")}
            </Text>
            <Text tone="muted" align="center">
              {t("tagline")}
            </Text>
          </Animated.View>

          <View style={{ gap: spacing.lg }}>
            <TextField
              label={t("name")}
              hint={t("nameHint")}
              value={displayName}
              onChangeText={setDisplayName}
              error={errors.displayName}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <TextField
              ref={emailRef}
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
            />
            <TextField
              ref={passwordRef}
              label={t("password")}
              hint={t("passwordHint")}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secure
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="done"
            />

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" tone="muted">
                {t("grade")}
              </Text>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {GRADE_BANDS.map((band) => (
                  <Chip
                    key={band}
                    label={t(`grade.${band}`)}
                    selected={gradeBand === band}
                    onPress={() => setGradeBand((current) => (current === band ? null : band))}
                  />
                ))}
              </View>
              <Text variant="caption" tone="subtle">
                {t("gradeOptional")}
              </Text>
            </View>

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

            <Button label={t("create")} size="lg" onPress={() => void submit()} loading={busy} testID="sign-up-submit" />
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/(auth)/sign-in")}
            style={{ alignItems: "center", paddingVertical: spacing.sm }}
            hitSlop={8}
          >
            <Text tone="muted" align="center">
              {t("haveAccount")}{" "}
              <Text variant="bodyStrong" tone="primary">
                {t("signIn")}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
