/**
 * Design tokens shared by every screen. Values mirror the web design system so a
 * learner moving between laptop and phone sees the same Learnly: indigo for
 * primary actions, coral for warmth, mint for wins, amber for gentle warnings.
 */
export const brand = {
  indigo: "#5B5BD6",
  coral: "#FF7A59",
  mint: "#2FB67C",
  amber: "#F5A524",
  ink: "#1C1B29",
  paper: "#FBFAF7",
} as const;

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryText: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  successSoft: string;
  successText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  ringTrack: string;
  overlay: string;
  shadow: string;
}

export const lightColors: ColorTokens = {
  background: brand.paper,
  surface: "#FFFFFF",
  surfaceMuted: "#F3F1EC",
  surfaceSunken: "#ECE9E2",
  border: "#E6E2D9",
  borderStrong: "#CFCAD9",
  text: brand.ink,
  textMuted: "#5E5C70",
  textSubtle: "#68667C",
  primary: brand.indigo,
  primaryPressed: "#4A4AC2",
  primarySoft: "#ECECFB",
  primaryText: "#4646BE",
  onPrimary: "#FFFFFF",
  accent: brand.coral,
  accentSoft: "#FFEDE6",
  accentText: "#A93F24",
  success: brand.mint,
  successSoft: "#E2F5EB",
  successText: "#18704A",
  warning: brand.amber,
  warningSoft: "#FEF2DA",
  warningText: "#7F5200",
  danger: "#E5484D",
  dangerSoft: "#FDECEC",
  dangerText: "#B42318",
  ringTrack: "#ECEAF5",
  overlay: "rgba(28, 27, 41, 0.45)",
  shadow: "#2B2A55",
};

export const darkColors: ColorTokens = {
  background: "#14131F",
  surface: "#1E1D2C",
  surfaceMuted: "#272638",
  surfaceSunken: "#181724",
  border: "#34324A",
  borderStrong: "#4A4766",
  text: "#F4F2EE",
  textMuted: "#BAB7CB",
  textSubtle: "#A3A0B8",
  primary: brand.indigo,
  primaryPressed: "#6B6BE0",
  primarySoft: "#2B2A57",
  primaryText: "#AFAFFA",
  onPrimary: "#FFFFFF",
  accent: "#FF8C6E",
  accentSoft: "#3D2620",
  accentText: "#FFB49F",
  success: "#3CC48A",
  successSoft: "#173528",
  successText: "#7EE0B5",
  warning: "#F7B23F",
  warningSoft: "#3A2E14",
  warningText: "#FFCF73",
  danger: "#F26B6F",
  dangerSoft: "#3D1E22",
  dangerText: "#FFA3A3",
  ringTrack: "#2E2D44",
  overlay: "rgba(5, 5, 12, 0.6)",
  shadow: "#000000",
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  heading: "Nunito_800ExtraBold",
  headingBold: "Nunito_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
} as const;

export type TypographyVariant =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "bodyStrong"
  | "callout"
  | "caption"
  | "label";

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const typography: Record<TypographyVariant, TypeStyle> = {
  display: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.headingBold, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: fonts.headingBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 24 },
  callout: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 16, letterSpacing: 0.3 },
};

export const elevation = {
  low: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  medium: { shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  high: { shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
} as const;

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  bouncy: { damping: 11, stiffness: 180, mass: 0.8 },
  duration: { fast: 140, base: 240, slow: 420 },
} as const;

/** Hue-based course covers, matching the web's `coverHue` gradients. */
export function coverColors(hue: number, dark: boolean): [string, string] {
  return dark
    ? [`hsl(${hue}, 42%, 30%)`, `hsl(${(hue + 28) % 360}, 48%, 22%)`]
    : [`hsl(${hue}, 85%, 92%)`, `hsl(${(hue + 28) % 360}, 80%, 84%)`];
}

/** Soft background + readable foreground for each mastery band. */
export function bandColors(
  band: "new" | "learning" | "practicing" | "mastered",
  colors: ColorTokens,
): { bg: string; fg: string; solid: string } {
  switch (band) {
    case "mastered":
      return { bg: colors.successSoft, fg: colors.successText, solid: colors.success };
    case "practicing":
      return { bg: colors.primarySoft, fg: colors.primaryText, solid: colors.primary };
    case "learning":
      return { bg: colors.warningSoft, fg: colors.warningText, solid: colors.warning };
    default:
      return { bg: colors.surfaceMuted, fg: colors.textMuted, solid: colors.borderStrong };
  }
}

