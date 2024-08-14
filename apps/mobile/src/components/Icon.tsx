import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Rounded 24px stroke icons drawn to match the web icon set (2px strokes,
 * round caps). Icons are decorative by default; wrap them in a labelled control
 * or pass `label` when the icon carries meaning on its own.
 */
const PATHS = {
  home: ["M4 11.5 12 5l8 6.5", "M6.5 10v8.5a1 1 0 0 0 1 1H10v-5h4v5h2.5a1 1 0 0 0 1-1V10"],
  book: ["M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5v-14Z", "M5 19.5A1.5 1.5 0 0 0 6.5 21H19", "M9 8h6"],
  chart: ["M5 20V10", "M12 20V4", "M19 20v-7"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4.5 20a7.5 7.5 0 0 1 15 0"],
  flame: [
    "M12 21c3.6 0 6-2.4 6-5.8 0-3.2-2.2-5.4-3.4-7.7-.4 1.6-1.3 2.6-2.4 3.1C12.6 7.6 11.5 5 9.2 3c.2 3-1.4 4.9-2.7 6.7C5.6 11 5 12.4 5 14.6 5 18.4 8.2 21 12 21Z",
    "M12 21c-1.7 0-3-1.2-3-3 0-1.6 1.2-2.6 2-3.8.6 1 1.4 1.4 2.2 1.6.5.9.8 1.5.8 2.2 0 1.8-.9 3-2 3Z",
  ],
  check: ["M5 12.5 10 17.5 19 7"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
  arrowLeft: ["M19 12H5", "M11 6l-6 6 6 6"],
  chevronRight: ["M9 6l6 6-6 6"],
  chevronDown: ["M6 9l6 6 6-6"],
  chevronUp: ["M6 15l6-6 6 6"],
  sparkle: ["M12 3.5 13.8 9 19.5 10.5 13.8 12 12 17.5 10.2 12 4.5 10.5 10.2 9 12 3.5Z", "M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"],
  lightbulb: ["M9 18h6", "M10 21h4", "M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3Z"],
  download: ["M12 4v11", "M7 10.5l5 5 5-5", "M5 20h14"],
  cloudOff: ["M3 3l18 18", "M8.5 7.4A5.5 5.5 0 0 1 17 10.5a4 4 0 0 1 2.4 6.9", "M16.5 19H7a4.5 4.5 0 0 1-1.6-8.7"],
  refresh: ["M20 11a8 8 0 0 0-14.3-4.9L4 8", "M4 4v4h4", "M4 13a8 8 0 0 0 14.3 4.9L20 16", "M20 20v-4h-4"],
  lock: ["M7 11V8a5 5 0 0 1 10 0v3", "M5.5 11h13v9h-13z"],
  clock: ["M12 7v5l3 2"],
  star: ["M12 4l2.5 5.1 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 4Z"],
  grip: ["M9 6h.01", "M15 6h.01", "M9 12h.01", "M15 12h.01", "M9 18h.01", "M15 18h.01"],
  play: ["M8 5.5v13l10.5-6.5L8 5.5Z"],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4-2-1.6Z",
  ],
  globe: ["M3.5 12h17", "M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z"],
  bell: ["M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z", "M10 20.5a2.2 2.2 0 0 0 4 0"],
  users: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.3a3.5 3.5 0 0 1 0 6.4", "M18 14.2a6.5 6.5 0 0 1 3.5 5.8"],
  alert: ["M12 4 2.8 19.5h18.4L12 4Z", "M12 10v4.5", "M12 17.2h.01"],
  trophy: ["M8 4h8v5a4 4 0 0 1-8 0V4Z", "M8 6H5a3 3 0 0 0 3 4", "M16 6h3a3 3 0 0 1-3 4", "M12 13v4", "M8.5 20h7", "M10 17h4v3h-4z"],
  target: ["M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z", "M12 12h.01"],
  compass: ["M15.5 8.5l-2 5-5 2 2-5 5-2Z"],
  help: ["M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7", "M12 17h.01"],
  shield: ["M12 3.5 19 6v5.5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9V6l7-2.5Z", "M9 12l2 2 4-4"],
  minus: ["M6 12h12"],
  plus: ["M12 6v12", "M6 12h12"],
  eye: ["M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  eyeOff: ["M3 3l18 18", "M10.6 6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4", "M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1", "M9.9 9.9a3 3 0 0 0 4.2 4.2"],
  logout: ["M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15", "M10 8l-4 4 4 4", "M6 12h10"],
  wifi: ["M2.5 9a14 14 0 0 1 19 0", "M5.5 12.5a9.5 9.5 0 0 1 13 0", "M8.7 15.8a5 5 0 0 1 6.6 0", "M12 19h.01"],
  inbox: ["M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Z", "M4 13.5h4.5l1 2h5l1-2H20"],
  trash: ["M5 7h14", "M9.5 7V4.5h5V7", "M7 7l1 13h8l1-13"],
} as const;

const CIRCLES: Partial<Record<keyof typeof PATHS, { cx: number; cy: number; r: number }[]>> = {
  clock: [{ cx: 12, cy: 12, r: 8.5 }],
  globe: [{ cx: 12, cy: 12, r: 8.5 }],
  target: [{ cx: 12, cy: 12, r: 8.5 }],
  compass: [{ cx: 12, cy: 12, r: 8.5 }],
  help: [{ cx: 12, cy: 12, r: 8.5 }],
};

const FILLED = new Set<keyof typeof PATHS>(["play", "star"]);

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
  /** When set, the icon is announced to screen readers as an image with this label. */
  label?: string;
}

export function Icon({ name, size = 24, color, strokeWidth = 2, filled, label }: IconProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;
  const fill = (filled ?? FILLED.has(name)) ? stroke : "none";
  const paths: readonly string[] = PATHS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    >
      {CIRCLES[name]?.map((c, i) => (
        <Circle key={`c${i}`} {...c} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
      ))}
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill}
        />
      ))}
    </Svg>
  );
}
