import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js"),
);

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => {
    throw new Error("SQLite is not available in unit tests; mock the repository instead.");
  }),
}));

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "scheduled-id"),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  const Image = (props: Record<string, unknown>) => require("react").createElement(View, props);
  Image.prefetch = jest.fn(async () => true);
  return { Image };
});

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-US", languageCode: "en" }],
}));

jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiUrl: "https://api.test.learnly.app" } } }));

// Animated components trigger noisy act() warnings that say nothing about behaviour.
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = typeof args[0] === "string" ? args[0] : "";
  if (first.includes("not wrapped in act") || first.includes("useNativeDriver")) return;
  originalWarn(...args);
};

// The react-native preset stubs AccessibilityInfo without return values; the theme
// provider awaits these on mount.
const { AccessibilityInfo } = require("react-native");
jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() });
