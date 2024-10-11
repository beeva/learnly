import { memo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ENCOURAGEMENT, type LessonBlock, type PublicItem, type Response } from "@learnly/shared";
import { useCopy } from "../i18n";
import { submitAnswer, type AnswerOutcome } from "../offline/learning";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";
import { describeResponse, isResponseReady, ItemView } from "./ItemView";
import { Text } from "./primitives";

const copy = {
  tip: "Tip",
  remember: "Remember",
  try: "Try it",
  example: "Worked example",
  showAnswer: "Show the answer",
  hideAnswer: "Hide the answer",
  answer: "Answer",
  step: "Step {n}",
  check: "Quick check",
  checkButton: "Check my answer",
  tryAgain: "Try again",
  saved: "Saved — we'll check it when you're back online.",
  correctWas: "The answer is {answer}.",
  missing: "This question will appear once the lesson finishes downloading.",
};

export interface LessonBlocksProps {
  blocks: LessonBlock[];
  items: PublicItem[];
  onCheckAnswered?: (outcome: AnswerOutcome) => void;
}

/** Renders every lesson block kind in reading order. */
export function LessonBlocks({ blocks, items, onCheckAnswered }: LessonBlocksProps) {
  const { spacing } = useTheme();
  const itemsById = new Map(items.map((i) => [i.id as string, i]));
  return (
    <View style={{ gap: spacing.lg }}>
      {blocks.map((block, index) => (
        <Block
          key={`${block.kind}-${index}`}
          block={block}
          item={block.kind === "check" ? (itemsById.get(block.itemId) ?? null) : null}
          onCheckAnswered={onCheckAnswered}
        />
      ))}
    </View>
  );
}

const Block = memo(function Block({
  block,
  item,
  onCheckAnswered,
}: {
  block: LessonBlock;
  item: PublicItem | null;
  onCheckAnswered?: (outcome: AnswerOutcome) => void;
}) {
  switch (block.kind) {
    case "heading":
      return (
        <Text variant="heading" style={{ marginTop: 8 }}>
          {block.text}
        </Text>
      );
    case "paragraph":
      return <Text style={{ fontSize: 17, lineHeight: 27 }}>{block.text}</Text>;
    case "callout":
      return <Callout tone={block.tone} text={block.text} />;
    case "image":
      return <LessonImage src={block.src} alt={block.alt} caption={block.caption} />;
    case "example":
      return <WorkedExample prompt={block.prompt} steps={block.steps} answer={block.answer} />;
    case "check":
      return <CheckBlock item={item} onAnswered={onCheckAnswered} />;
  }
});

function Callout({ tone, text }: { tone: "tip" | "remember" | "try"; text: string }) {
  const t = useCopy("lessonBlocks", copy);
  const { colors, radii, spacing } = useTheme();
  const styles: Record<typeof tone, { bg: string; fg: string; icon: IconName }> = {
    tip: { bg: colors.primarySoft, fg: colors.primaryText, icon: "lightbulb" },
    remember: { bg: colors.accentSoft, fg: colors.accentText, icon: "star" },
    try: { bg: colors.successSoft, fg: colors.successText, icon: "target" },
  };
  const s = styles[tone];
  return (
    <View
      accessible
      accessibilityLabel={`${t(tone)}. ${text}`}
      style={{
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.md,
        backgroundColor: s.bg,
        borderLeftWidth: 4,
        borderLeftColor: s.fg,
      }}
    >
      <Icon name={s.icon} size={22} color={s.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ color: s.fg }}>
          {t(tone).toUpperCase()}
        </Text>
        <Text variant="callout" style={{ color: s.fg }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function LessonImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const { colors, radii, spacing, reducedMotion } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Image
        source={{ uri: src }}
        accessible
        accessibilityLabel={alt}
        accessibilityRole="image"
        cachePolicy="memory-disk"
        contentFit="contain"
        transition={reducedMotion ? 0 : 200}
        placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
        style={{ width: "100%", aspectRatio: 16 / 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}
      />
      {caption ? (
        <Text variant="caption" tone="muted" align="center">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

function WorkedExample({ prompt, steps, answer }: { prompt: string; steps: string[]; answer: string }) {
  const t = useCopy("lessonBlocks", copy);
  const { colors, spacing, radii } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Icon name="book" size={18} color={colors.primaryText} />
        <Text variant="label" tone="primary">
          {t("example").toUpperCase()}
        </Text>
      </View>
      <Text variant="bodyStrong">{prompt}</Text>
      <View style={{ gap: spacing.sm }}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection: "row", gap: spacing.md }} accessible accessibilityLabel={`${t("step", { n: i + 1 })}. ${step}`}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <Text variant="label" tone="primary">
                {i + 1}
              </Text>
            </View>
            <Text variant="callout" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name={open ? "chevronUp" : "chevronDown"} size={18} color={colors.primaryText} />
        <Text variant="label" tone="primary">
          {open ? t("hideAnswer") : t("showAnswer")}
        </Text>
      </Pressable>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{ backgroundColor: colors.successSoft, borderRadius: radii.sm, padding: spacing.md }}
        >
          <Text variant="label" tone="success">
            {t("answer")}
          </Text>
          <Text variant="bodyStrong" tone="success">
            {answer}
          </Text>
        </Animated.View>
      ) : null}
    </Card>
  );
}

/** Inline, low-stakes check: no sheet, no XP fanfare — just a gentle confirmation. */
function CheckBlock({ item, onAnswered }: { item: PublicItem | null; onAnswered?: (o: AnswerOutcome) => void }) {
  const t = useCopy("lessonBlocks", copy);
  const encouragement = useCopy("encouragement", ENCOURAGEMENT);
  const { colors, spacing, radii, reducedMotion } = useTheme();
  const [value, setValue] = useState<Response | null>(null);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const misses = useRef(0);
  const startedAt = useRef(Date.now());

  if (!item) {
    return (
      <Card tone="muted">
        <Text tone="muted">{t("missing")}</Text>
      </Card>
    );
  }

  const check = async () => {
    if (!isResponseReady(value)) return;
    setBusy(true);
    try {
      const result = await submitAnswer({
        item,
        response: value,
        hintsUsed: 0,
        durationMs: Date.now() - startedAt.current,
        correctInRow: 0,
        missesInRow: misses.current,
      });
      if (result.status === "scored" && !result.correct) misses.current += 1;
      setOutcome(result);
      onAnswered?.(result);
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setOutcome(null);
    setValue(null);
    setAttempt((a) => a + 1);
    startedAt.current = Date.now();
  };

  const scored = outcome?.status === "scored" ? outcome : null;

  return (
    <Card style={{ gap: spacing.lg, borderColor: colors.primary, borderWidth: 1.5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Icon name="target" size={18} color={colors.primaryText} />
        <Text variant="label" tone="primary">
          {t("check").toUpperCase()}
        </Text>
      </View>
      <ItemView
        key={attempt}
        item={item}
        value={value}
        onChange={setValue}
        disabled={Boolean(outcome) || busy}
        reveal={scored ? { correct: scored.correct, correctResponse: scored.correctResponse } : null}
      />
      {outcome ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(220)}
          accessibilityLiveRegion="polite"
          style={{
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: scored ? (scored.correct ? colors.successSoft : colors.warningSoft) : colors.primarySoft,
          }}
        >
          <Text variant="bodyStrong" tone={scored ? (scored.correct ? "success" : "warning") : "primary"}>
            {scored ? encouragement(scored.encouragement.key, scored.encouragement.values) : t("saved")}
          </Text>
          {scored && !scored.correct && scored.correctResponse && item.kind !== "ordering" ? (
            <Text variant="callout" tone="warning">
              {t("correctWas", { answer: describeResponse(item, scored.correctResponse) })}
            </Text>
          ) : null}
          {scored?.explanation ? <Text variant="callout">{scored.explanation}</Text> : null}
          {scored && !scored.correct ? (
            <Button label={t("tryAgain")} variant="secondary" size="sm" icon="refresh" fullWidth={false} onPress={retry} />
          ) : null}
        </Animated.View>
      ) : (
        <Button
          label={t("checkButton")}
          onPress={() => void check()}
          loading={busy}
          disabled={!isResponseReady(value)}
          testID="lesson-check"
        />
      )}
    </Card>
  );
}
