import { useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle, View, type Text as RNText } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ENCOURAGEMENT, type MasteryBand, type PublicItem } from "@learnly/shared";
import { useCopy } from "../i18n";
import type { AnswerOutcome } from "../offline/learning";
import { usePreferences } from "../session/SessionProvider";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { BandChip, Chip } from "./Chip";
import { Icon } from "./Icon";
import { describeResponse } from "./ItemView";
import { Text } from "./primitives";

const copy = {
  continue: "Continue",
  savedTitle: "Answer saved",
  savedBody: "You're offline, so we'll check this one as soon as you reconnect. Keep going!",
  correctAnswer: "Correct answer",
  whyTitle: "Why it works",
  xp: "+{xp} XP",
  bandUp: "Skill moved up to {band}",
  band_new: "New",
  band_learning: "Learning",
  band_practicing: "Practicing",
  band_mastered: "Mastered",
  checkedOffline: "Checked on this device",
};

export interface FeedbackSheetProps {
  outcome: AnswerOutcome | null;
  item: PublicItem | null;
  onContinue: () => void;
  continueLabel?: string;
}

const BAND_ORDER: MasteryBand[] = ["new", "learning", "practicing", "mastered"];

/**
 * Slides up after an answer. Correct answers celebrate briefly; misses get a
 * warm, specific nudge and the worked explanation — amber, never red.
 */
export function FeedbackSheet({ outcome, item, onContinue, continueLabel }: FeedbackSheetProps) {
  const t = useCopy("feedback", copy);
  const encouragement = useCopy("encouragement", ENCOURAGEMENT);
  const { colors, radii, spacing, elevation, reducedMotion } = useTheme();
  const { soundEffects } = usePreferences();
  const insets = useSafeAreaInsets();
  const titleRef = useRef<RNText>(null);

  useEffect(() => {
    if (!outcome) return;
    if (soundEffects) {
      const type =
        outcome.status === "scored" && outcome.correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning;
      void Haptics.notificationAsync(type).catch(() => undefined);
    }
    const handle = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (handle) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(handle), 350);
  }, [outcome, soundEffects]);

  if (!outcome || !item) return null;

  const scored = outcome.status === "scored" ? outcome : null;
  const correct = scored?.correct ?? false;
  const accent = scored ? (correct ? colors.success : colors.warning) : colors.primary;
  const soft = scored ? (correct ? colors.successSoft : colors.warningSoft) : colors.primarySoft;
  const title = scored ? encouragement(scored.encouragement.key, scored.encouragement.values) : t("savedTitle");
  const bandUp =
    scored &&
    BAND_ORDER.indexOf(scored.mastery.band) > BAND_ORDER.indexOf(scored.previousMastery.band) &&
    scored.mastery.band !== "new"
      ? scored.mastery.band
      : null;
  const bandLabel = (band: MasteryBand) => t(`band_${band}` as const);

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(160)}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, opacity: 0.35 }}
      />
      <Animated.View
        entering={reducedMotion ? FadeIn.duration(150) : SlideInDown.springify().damping(19).stiffness(180)}
        exiting={reducedMotion ? FadeOut.duration(120) : SlideOutDown.duration(220)}
        accessibilityViewIsModal
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.md,
          shadowColor: colors.shadow,
          ...elevation.high,
        }}
        testID="feedback-sheet"
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.springify().damping(10).delay(120)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: soft,
            }}
          >
            <Icon
              name={scored ? (correct ? "check" : "lightbulb") : "cloudOff"}
              size={26}
              color={accent}
              strokeWidth={2.6}
            />
          </Animated.View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text ref={titleRef} variant="heading" accessibilityRole="header" accessibilityLiveRegion="assertive">
              {title}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              {outcome.xpEarned > 0 ? <Chip label={t("xp", { xp: outcome.xpEarned })} tone="primary" icon="sparkle" /> : null}
              {scored?.source === "local" ? <Chip label={t("checkedOffline")} icon="cloudOff" /> : null}
            </View>
          </View>
        </View>

        {!scored ? <Text tone="muted">{t("savedBody")}</Text> : null}

        {bandUp ? <BandChip band={bandUp} label={t("bandUp", { band: bandLabel(bandUp) })} /> : null}

        {scored && !correct && scored.correctResponse && item.kind !== "ordering" ? (
          <View style={{ backgroundColor: colors.successSoft, borderRadius: radii.md, padding: spacing.md, gap: 2 }}>
            <Text variant="label" tone="success">
              {t("correctAnswer")}
            </Text>
            <Text variant="bodyStrong" tone="success">
              {describeResponse(item, scored.correctResponse)}
            </Text>
          </View>
        ) : null}

        {scored?.explanation ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" tone="muted">
              {t("whyTitle")}
            </Text>
            <Text variant="callout">{scored.explanation}</Text>
          </View>
        ) : null}

        <Button
          label={continueLabel ?? t("continue")}
          icon="arrowRight"
          iconPosition="trailing"
          variant={correct ? "success" : "primary"}
          onPress={onContinue}
          testID="feedback-continue"
        />
      </Animated.View>
    </>
  );
}
