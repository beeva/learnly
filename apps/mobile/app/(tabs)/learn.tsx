import { View } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Course, Subject } from "@learnly/shared";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { Icon, type IconName } from "../../src/components/Icon";
import { OfflineBanner } from "../../src/components/OfflineBanner";
import { EmptyState, Row, SkeletonCard, Text } from "../../src/components/primitives";
import { useCopy } from "../../src/i18n";
import { OfflineMissError, useCourses } from "../../src/offline/data";
import { useTheme } from "../../src/theme/ThemeProvider";
import { coverColors } from "../../src/theme/tokens";

const copy = {
  title: "Learn",
  subtitle: "Pick a course — we'll meet you where you are.",
  units: "{n} units",
  minutes: "about {n} min",
  grades: "Grades {band}",
  subject_math: "Math",
  subject_reading: "Reading",
  subject_science: "Science",
  offlineTitle: "Courses will appear here",
  offlineBody: "Connect once to load the catalog. After that, downloaded courses work offline.",
  errorTitle: "We couldn't load courses",
  errorBody: "Check your connection and try again.",
  retry: "Try again",
  open: "Opens the course",
};

const SUBJECT_ICON: Record<Subject, IconName> = {
  math: "target",
  reading: "book",
  science: "lightbulb",
};

export function CourseCover({ hue, height = 96, radius = 16 }: { hue: number; height?: number; radius?: number }) {
  const { mode } = useTheme();
  const [from, to] = coverColors(hue, mode === "dark");
  const id = `cover-${hue}-${mode}`;
  return (
    <Svg width="100%" height={height} style={{ borderTopLeftRadius: radius, borderTopRightRadius: radius }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height={height} rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

function CourseCard({ course }: { course: Course }) {
  const t = useCopy("learn", copy);
  const { colors, spacing, radii } = useTheme();
  const subject = t(`subject_${course.subject}`);
  return (
    <Card
      padding={0}
      onPress={() => router.push({ pathname: "/course/[slug]", params: { slug: course.slug } })}
      accessibilityLabel={`${course.title}. ${subject}. ${t("grades", { band: course.gradeBand })}. ${t("units", { n: course.unitCount })}`}
      accessibilityHint={t("open")}
      style={{ marginBottom: spacing.lg, overflow: "hidden" }}
    >
      <View>
        <CourseCover hue={course.coverHue} radius={radii.lg} />
        <View
          style={{
            position: "absolute",
            left: spacing.lg,
            bottom: -22,
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Icon name={SUBJECT_ICON[course.subject]} size={24} color={colors.primaryText} />
        </View>
      </View>
      <View style={{ padding: spacing.lg, paddingTop: spacing.xl + spacing.sm, gap: spacing.sm }}>
        <Text variant="heading">{course.title}</Text>
        <Text variant="callout" tone="muted" numberOfLines={2}>
          {course.description}
        </Text>
        <Row gap={spacing.sm} wrap>
          <Chip label={subject} tone="primary" />
          <Chip label={t("grades", { band: course.gradeBand })} />
          <Chip label={t("units", { n: course.unitCount })} />
          <Chip label={t("minutes", { n: course.estimatedMinutes })} icon="clock" />
        </Row>
      </View>
    </Card>
  );
}

export default function LearnScreen() {
  const t = useCopy("learn", copy);
  const courses = useCourses();
  const { colors, spacing } = useTheme();

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
      <Text variant="title">{t("title")}</Text>
      <Text tone="muted">{t("subtitle")}</Text>
      <OfflineBanner />
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      {courses.isPending ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {header}
          <SkeletonCard height={220} />
          <SkeletonCard height={220} />
        </View>
      ) : courses.isError ? (
        <View style={{ padding: spacing.xl }}>
          {header}
          <EmptyState
            icon={<Icon name="cloudOff" size={36} color={colors.textMuted} />}
            title={courses.error instanceof OfflineMissError ? t("offlineTitle") : t("errorTitle")}
            body={courses.error instanceof OfflineMissError ? t("offlineBody") : t("errorBody")}
            action={<Button label={t("retry")} variant="secondary" icon="refresh" onPress={() => void courses.refetch()} />}
          />
        </View>
      ) : (
        <FlashList
          data={courses.data}
          keyExtractor={(course) => course.slug}
          estimatedItemSize={236}
          ListHeaderComponent={header}
          contentContainerStyle={{ padding: spacing.xl }}
          onRefresh={() => void courses.refetch()}
          refreshing={courses.isRefetching}
          renderItem={({ item }) => <CourseCard course={item} />}
        />
      )}
    </SafeAreaView>
  );
}
