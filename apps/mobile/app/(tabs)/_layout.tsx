import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../src/components/Icon";
import { Text } from "../../src/components/primitives";
import { useCopy } from "../../src/i18n";
import { useTheme } from "../../src/theme/ThemeProvider";
import { fonts } from "../../src/theme/tokens";

const copy = {
  home: "Home",
  learn: "Learn",
  progress: "Progress",
  profile: "Profile",
};

const TABS: { name: string; key: keyof typeof copy; icon: IconName }[] = [
  { name: "index", key: "home", icon: "home" },
  { name: "learn", key: "learn", icon: "book" },
  { name: "progress", key: "progress", icon: "chart" },
  { name: "profile", key: "profile", icon: "user" },
];

export default function TabsLayout() {
  const t = useCopy("tabs", copy);
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 12 },
        tabBarAllowFontScaling: true,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarAccessibilityLabel: t(tab.key),
            tabBarLabel: ({ color }) => (
              <Text variant="label" maxFontSizeMultiplier={1.4} style={{ color, fontSize: 12 }} numberOfLines={1}>
                {t(tab.key)}
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <Icon name={tab.icon} size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
