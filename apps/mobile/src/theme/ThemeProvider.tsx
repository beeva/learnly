import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import {
  darkColors,
  elevation,
  lightColors,
  motion,
  radii,
  spacing,
  typography,
  type ColorTokens,
} from "./tokens";

export interface Theme {
  mode: "light" | "dark";
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  /** True when the OS or the learner's own preference asks for less motion. */
  reducedMotion: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

/** Tracks the OS "reduce motion" switch, updating live when it changes. */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export interface ThemeProviderProps {
  children: ReactNode;
  /** Learner preference from their profile; OR-ed with the OS setting. */
  reducedMotionPreference?: boolean;
  /** Force a scheme (tests, screenshots). */
  forcedMode?: "light" | "dark";
}

export function ThemeProvider({ children, reducedMotionPreference = false, forcedMode }: ThemeProviderProps) {
  const scheme = useColorScheme();
  const systemReduced = useSystemReducedMotion();
  const mode = forcedMode ?? (scheme === "dark" ? "dark" : "light");
  const reducedMotion = systemReduced || reducedMotionPreference;

  const theme = useMemo<Theme>(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      spacing,
      radii,
      typography,
      elevation,
      motion,
      reducedMotion,
    }),
    [mode, reducedMotion],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

const fallbackTheme: Theme = {
  mode: "light",
  colors: lightColors,
  spacing,
  radii,
  typography,
  elevation,
  motion,
  reducedMotion: false,
};

export function useTheme(): Theme {
  return useContext(ThemeContext) ?? fallbackTheme;
}

export function useReducedMotion(): boolean {
  return useTheme().reducedMotion;
}
