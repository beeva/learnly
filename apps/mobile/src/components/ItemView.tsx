import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { PublicItem, Response } from "@learnly/shared";
import { useCopy } from "../i18n";
import { useTheme } from "../theme/ThemeProvider";
import { IconButton } from "./Button";
import { Icon } from "./Icon";
import { Text } from "./primitives";
import { TextField } from "./TextField";

const copy = {
  choiceHint: "Double tap to choose this answer",
  numericLabel: "Your answer",
  numericHint: "Numbers, decimals or fractions like 3/4",
  textLabel: "Your answer",
  orderingHelp: "Drag the handle, or use the arrows, to put these in order.",
  moveUp: "Move up",
  moveDown: "Move down",
  position: "{text}, position {position} of {total}",
  movedTo: "{text} moved to position {position}",
  correctAnswer: "Correct answer",
  yourAnswer: "Your choice",
  correctOrder: "Correct order",
};

export interface Reveal {
  correct: boolean;
  correctResponse: Response | null;
}

export interface ItemViewProps {
  item: PublicItem;
  value: Response | null;
  onChange: (value: Response | null) => void;
  disabled?: boolean;
  reveal?: Reveal | null;
  /** Hide the prompt when the caller renders it elsewhere (e.g. a larger header). */
  hidePrompt?: boolean;
}

/** Parses "0.75", "3/4" or "1 1/2" into a number; null when it isn't one. */
export function parseNumericInput(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  const mixed = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(text);
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = Number(mixed[2]) / Number(mixed[3]);
    return Number(mixed[3]) === 0 ? null : whole < 0 ? whole - frac : whole + frac;
  }
  const fraction = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(text);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  const value = Number(text);
  return Number.isFinite(value) && /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? value : null;
}

/** Human-readable version of a response, used in feedback ("Correct answer: 3/4"). */
export function describeResponse(item: PublicItem, response: Response | null): string {
  if (!response) return "";
  switch (response.kind) {
    case "multiple_choice":
      return item.kind === "multiple_choice"
        ? (item.choices.find((c) => c.id === response.choiceId)?.text ?? "")
        : "";
    case "numeric":
      return `${response.value}${item.kind === "numeric" && item.unit ? ` ${item.unit}` : ""}`;
    case "short_text":
      return response.text;
    case "ordering":
      return item.kind === "ordering"
        ? response.order.map((id) => item.entries.find((e) => e.id === id)?.text ?? id).join(" → ")
        : "";
  }
}

export function isResponseReady(value: Response | null): value is Response {
  if (!value) return false;
  if (value.kind === "short_text") return value.text.trim().length > 0;
  return true;
}

export function ItemView({ item, value, onChange, disabled = false, reveal, hidePrompt }: ItemViewProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      {hidePrompt ? null : (
        <Text variant="heading" accessibilityRole="header">
          {item.prompt}
        </Text>
      )}
      {item.kind === "multiple_choice" ? (
        <MultipleChoice item={item} value={value} onChange={onChange} disabled={disabled} reveal={reveal} />
      ) : item.kind === "numeric" ? (
        <NumericInput item={item} onChange={onChange} disabled={disabled} />
      ) : item.kind === "short_text" ? (
        <ShortText onChange={onChange} disabled={disabled} />
      ) : (
        <OrderingList item={item} value={value} onChange={onChange} disabled={disabled} reveal={reveal} />
      )}
    </View>
  );
}

/* ----------------------------------------------------------------------------
 * Multiple choice
 * ------------------------------------------------------------------------- */

type MultipleChoicePublic = Extract<PublicItem, { kind: "multiple_choice" }>;
type OrderingPublic = Extract<PublicItem, { kind: "ordering" }>;
type NumericPublic = Extract<PublicItem, { kind: "numeric" }>;

function MultipleChoice({
  item,
  value,
  onChange,
  disabled,
  reveal,
}: {
  item: MultipleChoicePublic;
  value: Response | null;
  onChange: (r: Response) => void;
  disabled: boolean;
  reveal?: Reveal | null;
}) {
  const t = useCopy("items", copy);
  const { colors, radii, spacing } = useTheme();
  const selected = value?.kind === "multiple_choice" ? value.choiceId : null;
  const correctId = reveal?.correctResponse?.kind === "multiple_choice" ? reveal.correctResponse.choiceId : null;

  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.sm + 2 }}>
      {item.choices.map((choice, index) => {
        const isSelected = selected === choice.id;
        const isCorrect = reveal && correctId === choice.id;
        const isMissed = reveal && isSelected && !reveal.correct;
        const border = isCorrect
          ? colors.success
          : isMissed
            ? colors.warning
            : isSelected
              ? colors.primary
              : colors.border;
        const bg = isCorrect
          ? colors.successSoft
          : isMissed
            ? colors.warningSoft
            : isSelected
              ? colors.primarySoft
              : colors.surface;
        const letter = String.fromCharCode(65 + index);
        const status = isCorrect ? t("correctAnswer") : isMissed ? t("yourAnswer") : undefined;
        return (
          <Pressable
            key={choice.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled }}
            accessibilityLabel={[`${letter}. ${choice.text}`, status].filter(Boolean).join(", ")}
            accessibilityHint={disabled ? undefined : t("choiceHint")}
            disabled={disabled}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              onChange({ kind: "multiple_choice", choiceId: choice.id });
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: 56,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radii.md,
              borderWidth: isSelected || isCorrect ? 2 : 1.5,
              borderColor: border,
              backgroundColor: pressed && !disabled ? colors.surfaceMuted : bg,
            })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isSelected || isCorrect ? border : colors.surfaceMuted,
              }}
            >
              {isCorrect ? (
                <Icon name="check" size={18} color={colors.onPrimary} strokeWidth={3} />
              ) : (
                <Text variant="label" style={{ color: isSelected ? colors.onPrimary : colors.textMuted }}>
                  {letter}
                </Text>
              )}
            </View>
            <Text variant="callout" style={{ flex: 1 }}>
              {choice.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------------------------
 * Numeric and short text
 * ------------------------------------------------------------------------- */

function NumericInput({
  item,
  onChange,
  disabled,
}: {
  item: NumericPublic;
  onChange: (r: Response | null) => void;
  disabled: boolean;
}) {
  const t = useCopy("items", copy);
  const [text, setText] = useState("");
  return (
    <TextField
      label={t("numericLabel")}
      hint={t("numericHint")}
      value={text}
      large
      suffix={item.unit}
      editable={!disabled}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      autoCorrect={false}
      onChangeText={(next) => {
        setText(next);
        const parsed = parseNumericInput(next);
        onChange(parsed === null ? null : { kind: "numeric", value: parsed });
      }}
      testID="numeric-input"
    />
  );
}

function ShortText({
  onChange,
  disabled,
}: {
  onChange: (r: Response | null) => void;
  disabled: boolean;
}) {
  const t = useCopy("items", copy);
  const [text, setText] = useState("");
  return (
    <TextField
      label={t("textLabel")}
      value={text}
      large
      editable={!disabled}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="done"
      onChangeText={(next) => {
        setText(next);
        onChange(next.trim() ? { kind: "short_text", text: next } : null);
      }}
      testID="short-text-input"
    />
  );
}

/* ----------------------------------------------------------------------------
 * Ordering: drag with a long-press handle, or move up/down with buttons and
 * screen-reader actions. Both paths call the same `move`.
 * ------------------------------------------------------------------------- */

export function moveEntry(order: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= order.length) return order;
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(order.length - 1, to)), 0, moved!);
  return next;
}

const ROW_GAP = 10;

function OrderingList({
  item,
  value,
  onChange,
  disabled,
  reveal,
}: {
  item: OrderingPublic;
  value: Response | null;
  onChange: (r: Response) => void;
  disabled: boolean;
  reveal?: Reveal | null;
}) {
  const t = useCopy("items", copy);
  const { spacing, colors } = useTheme();
  const order = value?.kind === "ordering" ? value.order : item.entries.map((e) => e.id);
  const textFor = (id: string) => item.entries.find((e) => e.id === id)?.text ?? id;

  // The initial arrangement is already a valid answer; surface it so "Check" enables.
  useEffect(() => {
    if (value?.kind !== "ordering") onChange({ kind: "ordering", order: item.entries.map((e) => e.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const rowHeight = useSharedValue(64);
  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const move = (from: number, to: number, announce = true) => {
    const next = moveEntry(order, from, to);
    if (next === order) return;
    onChange({ kind: "ordering", order: next });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (announce) {
      const id = order[from]!;
      AccessibilityInfo.announceForAccessibility(
        t("movedTo", { text: textFor(id), position: next.indexOf(id) + 1 }),
      );
    }
  };

  const correctOrder = reveal?.correctResponse?.kind === "ordering" ? reveal.correctResponse.order : null;

  return (
    <View style={{ gap: spacing.md }}>
      {disabled ? null : (
        <Text variant="caption" tone="muted">
          {t("orderingHelp")}
        </Text>
      )}
      <View style={{ gap: ROW_GAP }}>
        {order.map((id, index) => (
          <OrderingRow
            key={id}
            index={index}
            total={order.length}
            text={textFor(id)}
            disabled={disabled}
            status={correctOrder ? (correctOrder[index] === id ? "right" : "wrong") : null}
            rowHeight={rowHeight}
            activeIndex={activeIndex}
            hoverIndex={hoverIndex}
            dragY={dragY}
            onMove={move}
            labels={{
              up: t("moveUp"),
              down: t("moveDown"),
              position: t("position", { text: textFor(id), position: index + 1, total: order.length }),
            }}
          />
        ))}
      </View>
      {correctOrder && reveal && !reveal.correct ? (
        <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: 12, backgroundColor: colors.successSoft }}>
          <Text variant="label" tone="success">
            {t("correctOrder")}
          </Text>
          {correctOrder.map((id, i) => (
            <Text key={id} variant="callout" tone="success">
              {`${i + 1}. ${textFor(id)}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OrderingRow({
  index,
  total,
  text,
  disabled,
  status,
  rowHeight,
  activeIndex,
  hoverIndex,
  dragY,
  onMove,
  labels,
}: {
  index: number;
  total: number;
  text: string;
  disabled: boolean;
  status: "right" | "wrong" | null;
  rowHeight: SharedValue<number>;
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onMove: (from: number, to: number, announce?: boolean) => void;
  labels: { up: string; down: string; position: string };
}) {
  const { colors, radii, spacing, reducedMotion, elevation } = useTheme();

  const onLayout = (e: LayoutChangeEvent) => {
    rowHeight.value = e.nativeEvent.layout.height + ROW_GAP;
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(180)
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const target = Math.round(index + e.translationY / rowHeight.value);
      hoverIndex.value = Math.max(0, Math.min(total - 1, target));
    })
    .onEnd(() => {
      const to = hoverIndex.value;
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragY.value = 0;
      if (to !== index) runOnJS(onMove)(index, to, true);
    })
    .onFinalize(() => {
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragY.value = 0;
    });

  const style = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === index) {
      return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10 };
    }
    let shift = 0;
    const hover = hoverIndex.value;
    if (active >= 0) {
      if (active < index && hover >= index) shift = -rowHeight.value;
      else if (active > index && hover <= index) shift = rowHeight.value;
    }
    return {
      transform: [
        { translateY: reducedMotion ? shift : withSpring(shift, { damping: 20, stiffness: 240 }) },
        { scale: withTiming(1) },
      ],
      zIndex: 0,
    };
  });

  const tone =
    status === "right"
      ? { border: colors.success, bg: colors.successSoft }
      : status === "wrong"
        ? { border: colors.warning, bg: colors.warningSoft }
        : { border: colors.border, bg: colors.surface };

  return (
    <Animated.View style={style} onLayout={onLayout}>
      <View
        accessible
        accessibilityLabel={labels.position}
        accessibilityActions={
          disabled
            ? []
            : [
                ...(index > 0 ? [{ name: "moveUp", label: labels.up }] : []),
                ...(index < total - 1 ? [{ name: "moveDown", label: labels.down }] : []),
              ]
        }
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "moveUp") onMove(index, index - 1);
          if (e.nativeEvent.actionName === "moveDown") onMove(index, index + 1);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 56,
          paddingLeft: spacing.sm,
          paddingRight: spacing.sm,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: tone.border,
          backgroundColor: tone.bg,
          shadowColor: colors.shadow,
          ...elevation.low,
        }}
      >
        <GestureDetector gesture={pan}>
          <View
            style={{ width: 36, height: 48, alignItems: "center", justifyContent: "center" }}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Icon name="grip" size={20} color={colors.textSubtle} strokeWidth={3} />
          </View>
        </GestureDetector>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Text variant="label" tone="primary">
            {index + 1}
          </Text>
        </View>
        <Text variant="callout" style={{ flex: 1, paddingVertical: spacing.sm }}>
          {text}
        </Text>
        {disabled ? null : (
          <View style={{ flexDirection: "row", gap: spacing.xs }} importantForAccessibility="no-hide-descendants">
            <IconButton
              icon="chevronUp"
              label={labels.up}
              size={36}
              tone="muted"
              disabled={index === 0}
              onPress={() => onMove(index, index - 1)}
            />
            <IconButton
              icon="chevronDown"
              label={labels.down}
              size={36}
              tone="muted"
              disabled={index === total - 1}
              onPress={() => onMove(index, index + 1)}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}
