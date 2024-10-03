import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { Text } from "./primitives";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Milliseconds; errors linger a little longer so they can be read. */
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface ToastItem extends Required<Omit<ToastOptions, "action">> {
  id: number;
  action?: ToastOptions["action"];
}

const ToastContext = createContext<{ show: (options: ToastOptions) => void } | null>(null);

const ICONS: Record<ToastTone, IconName> = {
  info: "sparkle",
  success: "check",
  warning: "cloudOff",
  error: "alert",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    ({ message, tone = "info", duration, action }: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      const item: ToastItem = {
        id: nextId.current++,
        message,
        tone,
        duration: duration ?? (tone === "error" ? 5000 : 3200),
        action,
      };
      setToast(item);
      AccessibilityInfo.announceForAccessibility(message);
      timer.current = setTimeout(dismiss, item.duration);
    },
    [dismiss],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { colors, radii, spacing, elevation, reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const tones: Record<ToastTone, { bg: string; fg: string }> = {
    info: { bg: colors.text, fg: colors.background },
    success: { bg: colors.successSoft, fg: colors.successText },
    warning: { bg: colors.warningSoft, fg: colors.warningText },
    error: { bg: colors.dangerSoft, fg: colors.dangerText },
  };
  const t = tones[toast.tone];

  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(120) : SlideInDown.springify().damping(18)}
      exiting={reducedMotion ? FadeOut.duration(120) : SlideOutDown.duration(200)}
      pointerEvents="box-none"
      style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 72 }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: t.bg,
          borderRadius: radii.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          shadowColor: colors.shadow,
          ...elevation.medium,
        }}
      >
        <Icon name={ICONS[toast.tone]} size={20} color={t.fg} />
        <Text variant="callout" style={{ color: t.fg, flex: 1 }}>
          {toast.message}
        </Text>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.action?.onPress();
              onDismiss();
            }}
            hitSlop={8}
          >
            <Text variant="label" style={{ color: t.fg, textDecorationLine: "underline" }}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={10}>
            <Icon name="x" size={18} color={t.fg} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
