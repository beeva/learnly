import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { levelForXp, type MasteryBand, type SkillMastery, type Unit } from "@learnly/shared";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { BandChip, Chip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { EmptyState, Row, Screen, SkeletonCard, Text } from "../../src/components/primitives";
import { ProgressBar, ProgressRing } from "../../src/components/Progress";
import { useCopy } from "../../src/i18n";
import { useProgress } from "../../src/offline/data";
import { useSession } from "../../src/session/SessionProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

const copy = {
  title: "Your progress",
  subtitle: "Every bit of practice counts — here's what it's added up to.",
  levelLabel: "Level",
  levelRing: "Level {level}, {percent} percent of the way to level {next}",
  toNext: "{xp} XP to level {next}",
  totalXp: "{xp} XP total",
  streak: "Day streak",
  streakDays: "{count} days",
  longest: "Longest: {count}",
  freezes: "Streak freezes: {count}",
  freezesHint: "A freeze saves your streak if you miss a single day.",
  goal: "Today's goal",
  goalValue: "{done} / {goal} min",
  mastery: "Mastery by unit",
  masteryEmpty: "Open a course to start building mastery.",
  unitProgress: "{title}, {percent} percent mastered",
  offline: "Showing progress saved on this device. It will refresh when you're back online.",
  errorTitle: "We couldn't load your progress",
  retry: "Try again",
  band_new: "New",
  band_learning: "Learning",
  band_practicing: "Practicing",
  band_mastered: "Mastered",
  skillBand: "{skill}: {band}",
  showSkills: "Show skills",
  hideSkills: "Hide skills",
};

function StreakFlame({ lit, size = 56 }: { lit: boolean; size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lit ? brand.amber : colors.borderStrong} />
          <Stop offset="1" stopColor={lit ? brand.coral : colors.textSubtle} />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 22c4.1 0 7-2.8 7-6.6 0-3.6-2.5-6.2-3.9-8.8-.5 1.8-1.5 3-2.8 3.6C12.7 7 11.5 4 8.8 1.8c.2 3.4-1.6 5.6-3.1 7.7C4.7 11 4 12.6 4 15.1 4 19.4 7.6 22 12 22Z"
        fill="url(#flame)"
      />
      <Path
        d="M12 22c-1.9 0-3.3-1.3-3.3-3.3 0-1.8 1.3-2.9 2.2-4.2.7 1.1 1.5 1.6 2.4 1.8.6 1 .9 1.7.9 2.4 0 2-1 3.3-2.2 3.3Z"
        fill={lit ? "#FFE3A3" : colors.surfaceMuted}
      />
    </Svg>
  );
}

function unitScore(unit: Unit, mastery: Map<string, SkillMastery>): number {
  if (unit.skills.length === 0) return 0;
  const total = unit.skills.reduce((sum, skill) => {
    const m = mastery.get(skill.id);
    // Untouched skills count as zero rather than the model's prior, so rings only grow from real work.
    return sum + (m && m.attempts > 0 ? m.pKnown : 0);
  }, 0);
  return total / unit.skills.length;
}

function UnitRow({ unit, mastery }: { unit: Unit; mastery: Map<string, SkillMastery> }) {
  const t = useCopy("progress", copy);
  const { colors, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const score = unitScore(unit, mastery);
  const bandLabel = (band: MasteryBand) => t(`band_${band}`);
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      <Row justify="space-between">
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
          {unit.title}
        </Text>
        <Text variant="label" tone="primary">
          {Math.round(score * 100)}%
        </Text>
      </Row>
      <ProgressBar
        progress={score}
        color={score >= 0.85 ? colors.success : colors.primary}
        accessibilityLabel={t("unitProgress", { title: unit.title, percent: Math.round(score * 100) })}
      />
      <Button
        label={open ? t("hideSkills") : t("showSkills")}
        variant="ghost"
        size="sm"
        fullWidth={false}
        icon={open ? "chevronUp" : "chevronDown"}
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel={`${open ? t("hideSkills") : t("showSkills")}: ${unit.title}`}
      />
      {open ? (
        <View style={{ gap: spacing.sm }}>
          {unit.skills.map((skill) => {
            const band = mastery.get(skill.id)?.band ?? "new";
            return (
              <Row key={skill.id} justify="space-between" gap={spacing.md}>
                <Text variant="callout" style={{ flex: 1 }}>
                  {skill.name}
                </Text>
                <BandChip band={band} label={bandLabel(band)} />
              </Row>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function ProgressScreen() {
  const t = useCopy("progress", copy);
  const session = useSession();
  const { colors, spacing, reducedMotion } = useTheme();
  const progress = useProgress(session.progress);
  const data = progress.data;
  const summary = data ?? session.progress;
  const enter = (i: number) => (reducedMotion ? undefined : FadeInDown.delay(i * 80).duration(320));

  if (!summary) {
    return (
      <Screen>
        <Text variant="title">{t("title")}</Text>
        {progress.isError ? (
          <EmptyState
            title={t("errorTitle")}
            action={<Button label={t("retry")} variant="secondary" onPress={() => void progress.refetch()} />}
          />
        ) : (
          <>
            <SkeletonCard height={200} />
            <SkeletonCard height={120} />
            <SkeletonCard height={240} />
          </>
        )}
      </Screen>
    );
  }

  // Derive from XP so locally earned (not yet synced) XP moves the ring too.
  const level = levelForXp(summary.totalXp);
  const toNext = Math.max(0, level.xpForNext - level.xpIntoLevel);
  const goalRatio = summary.minutesToday / Math.max(1, summary.dailyGoalMinutes);

  return (
    <Screen refreshing={progress.isRefetching} onRefresh={() => void progress.refetch()}>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <Text variant="title">{t("title")}</Text>
        <Text tone="muted">{t("subtitle")}</Text>
      </View>

      {data?.offline ? (
        <Card tone="warning" elevated={false} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <Icon name="cloudOff" size={18} color={colors.warningText} />
          <Text variant="caption" tone="warning" style={{ flex: 1 }}>
            {t("offline")}
          </Text>
        </Card>
      ) : null}

      <Animated.View entering={enter(0)}>
        <Card style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
          <ProgressRing
            progress={level.progress}
            size={168}
            strokeWidth={16}
            color={colors.primary}
            colorEnd={brand.coral}
            accessibilityLabel={t("levelRing", {
              level: level.level,
              percent: Math.round(level.progress * 100),
              next: level.level + 1,
            })}
          >
            <Text variant="label" tone="muted">
              {t("levelLabel").toUpperCase()}
            </Text>
            <Text variant="display">{level.level}</Text>
          </ProgressRing>
          <Text variant="bodyStrong">{t("toNext", { xp: toNext, next: level.level + 1 })}</Text>
          <Chip label={t("totalXp", { xp: summary.totalXp })} icon="sparkle" tone="primary" />
        </Card>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card
          tone={summary.streak.current > 0 ? "accent" : "muted"}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}
          accessibilityLabel={`${t("streak")}: ${t("streakDays", { count: summary.streak.current })}. ${t("longest", {
            count: summary.streak.longest,
          })}. ${t("freezes", { count: summary.streak.freezesAvailable })}`}
        >
          <StreakFlame lit={summary.streak.current > 0} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" tone={summary.streak.current > 0 ? "accent" : "muted"}>
              {t("streak").toUpperCase()}
            </Text>
            <Text variant="title">{t("streakDays", { count: summary.streak.current })}</Text>
            <Text variant="caption" tone="muted">
              {t("longest", { count: summary.streak.longest })} · {t("freezes", { count: summary.streak.freezesAvailable })}
            </Text>
            {summary.streak.freezesAvailable > 0 ? (
              <Text variant="caption" tone="subtle">
                {t("freezesHint")}
              </Text>
            ) : null}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <Card style={{ gap: spacing.sm }}>
          <Row justify="space-between">
            <Text variant="subheading">{t("goal")}</Text>
            <Text variant="label" tone="muted">
              {t("goalValue", { done: summary.minutesToday, goal: summary.dailyGoalMinutes })}
            </Text>
          </Row>
          <ProgressBar
            progress={goalRatio}
            height={10}
            color={goalRatio >= 1 ? colors.success : colors.primary}
            accessibilityLabel={`${t("goal")}: ${t("goalValue", { done: summary.minutesToday, goal: summary.dailyGoalMinutes })}`}
          />
        </Card>
      </Animated.View>

      <Text variant="heading" style={{ marginTop: spacing.sm }}>
        {t("mastery")}
      </Text>
      {!data ? (
        <SkeletonCard height={200} />
      ) : data.details.length === 0 ? (
        <Card tone="muted">
          <Text tone="muted">{t("masteryEmpty")}</Text>
        </Card>
      ) : (
        data.details.map(({ course, units }, i) => (
          <Animated.View key={course.slug} entering={enter(3 + i)}>
            <Card style={{ gap: spacing.xs }}>
              <Text variant="subheading" style={{ marginBottom: spacing.xs }}>
                {course.title}
              </Text>
              {[...units]
                .sort((a, b) => a.position - b.position)
                .map((unit) => (
                  <UnitRow key={unit.id} unit={unit} mastery={data.mastery} />
                ))}
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}
