import { useEffect, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export interface ProgressRingProps {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Optional second stop for a soft gradient sweep. */
  colorEnd?: string;
  trackColor?: string;
  children?: ReactNode;
  accessibilityLabel: string;
  testID?: string;
}

/**
 * Mastery / goal ring. The arc eases into place on mount and on change so earned
 * progress feels earned; with reduced motion it simply appears at its value.
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 12,
  color,
  colorEnd,
  trackColor,
  children,
  accessibilityLabel,
  testID,
}: ProgressRingProps) {
  const { colors, reducedMotion } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = clamp01(progress);
  const animated = useSharedValue(reducedMotion ? value : 0);

  useEffect(() => {
    animated.value = reducedMotion
      ? value
      : withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [animated, reducedMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  const stroke = color ?? colors.primary;
  const gradientId = `ring-${size}-${strokeWidth}`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      testID={testID}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {colorEnd ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={stroke} />
              <Stop offset="1" stopColor={colorEnd} />
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? colors.ringTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorEnd ? `url(#${gradientId})` : stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  accessibilityLabel,
  style,
  testID,
}: ProgressBarProps) {
  const { colors, reducedMotion } = useTheme();
  const value = clamp01(progress);
  const width = useSharedValue(reducedMotion ? value : 0);

  useEffect(() => {
    width.value = reducedMotion ? value : withTiming(value, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [reducedMotion, value, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? "progressbar" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityLabel ? { min: 0, max: 100, now: Math.round(value * 100) } : undefined}
      style={[{ height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.ringTrack, overflow: "hidden" }, style]}
      testID={testID}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color ?? colors.primary }, fill]} />
    </View>
  );
}
