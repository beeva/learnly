import type { ConfigContext, ExpoConfig } from "expo/config";

type Variant = "development" | "preview" | "production";

const variant: Variant =
  process.env.APP_VARIANT === "development" || process.env.APP_VARIANT === "preview"
    ? process.env.APP_VARIANT
    : "production";

/** Each build variant installs side by side, so testers can keep the store build too. */
const VARIANTS: Record<Variant, { name: string; bundleId: string }> = {
  development: { name: "Learnly (Dev)", bundleId: "app.learnly.mobile.dev" },
  preview: { name: "Learnly (Preview)", bundleId: "app.learnly.mobile.preview" },
  production: { name: "Learnly", bundleId: "app.learnly.mobile" },
};

const PAPER = "#FBFAF7";
const INK = "#1C1B29";
const INDIGO = "#5B5BD6";

export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, bundleId } = VARIANTS[variant];
  return {
    ...config,
    name,
    slug: "learnly",
    scheme: "learnly",
    version: "1.4.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    backgroundColor: PAPER,
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: PAPER,
      dark: { image: "./assets/splash.png", backgroundColor: INK },
    },
    ios: {
      bundleIdentifier: bundleId,
      supportsTablet: true,
      config: { usesNonExemptEncryption: false },
      infoPlist: { UIBackgroundModes: ["fetch"] },
    },
    android: {
      package: bundleId,
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: INDIGO },
      permissions: ["POST_NOTIFICATIONS"],
      blockedPermissions: ["android.permission.RECORD_AUDIO"],
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      "expo-sqlite",
      "expo-localization",
      [
        "expo-notifications",
        { icon: "./assets/notification-icon.png", color: INDIGO, defaultChannel: "reminders" },
      ],
    ],
    experiments: { typedRoutes: false },
    extra: {
      variant,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.learnly.app",
      router: { origin: false },
      eas: { projectId: "4f0c6a8e-2d1b-4c39-9a57-58b6d1e0c9a4" },
    },
    updates: { url: "https://u.expo.dev/4f0c6a8e-2d1b-4c39-9a57-58b6d1e0c9a4" },
    runtimeVersion: { policy: "appVersion" },
  };
};
