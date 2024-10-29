import { useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { levelForXp } from "@learnly/shared";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { Icon, type IconName } from "../../src/components/Icon";
import { Row, Screen, Text } from "../../src/components/primitives";
import { useToast } from "../../src/components/Toast";
import { plural, translate, useCopy } from "../../src/i18n";
import { lessonRepo } from "../../src/db/repo";
import { queryKeys, useDownloadedLessons } from "../../src/offline/data";
import { useSession } from "../../src/session/SessionProvider";
import { useSyncState } from "../../src/sync";
import { useTheme } from "../../src/theme/ThemeProvider";

const copy = {
  title: "Profile",
  role_student: "Student",
  role_educator: "Educator",
  role_admin: "Admin",
  grades: "Grades {band}",
  level: "Level",
  xp: "XP",
  bestStreak: "Best streak",
  offline: "Offline learning",
  downloadsOne: "{count} lesson ready offline",
  downloadsOther: "{count} lessons ready offline",
  downloadsNone: "No lessons downloaded yet. Open a course and tap “Download for offline”.",
  removeDownloads: "Remove downloads",
  removeTitle: "Remove downloaded lessons?",
  removeBody: "Your progress stays safe. You can download them again anytime you're online.",
  removeConfirm: "Remove",
  removed: "Downloads removed",
  cancel: "Cancel",
  syncedJustNow: "Everything is synced",
  syncPendingOne: "{count} answer waiting to sync",
  syncPendingOther: "{count} answers waiting to sync",
  syncLast: "Last synced {time}",
  more: "More",
  signOut: "Sign out",
  signOutTitle: "Sign out of Learnly?",
  signOutBody: "See you soon! Your progress is saved to your account.",
  signOutPending:
    "You have {count} answers that haven't synced yet. If you sign out now they'll be lost — try connecting first.",
  opensExternal: "Opens in your browser",
};

export interface ProfileLink {
  key: string;
  icon: IconName;
  label: string;
  hint?: string;
  href?: string;
  url?: string;
}

/** Destinations listed under "More". New screens add their entry here. */
const PROFILE_LINKS: ProfileLink[] = [
  { key: "help", icon: "help", label: "Help & feedback", url: "https://beeva.site/portfolio/learnly" },
  { key: "privacy", icon: "shield", label: "Privacy", url: "https://beeva.site/portfolio/learnly#privacy" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "🙂";
}

function Stat({ value, label }: { value: string; label: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: spacing.xxs }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="heading">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function LinkRow({ link, last }: { link: ProfileLink; last: boolean }) {
  const t = useCopy("profile", copy);
  const { colors, spacing } = useTheme();
  const label = translate("profile", `link.${link.key}`, link.label);
  const hint = link.hint ? translate("profile", `link.${link.key}.hint`, link.hint) : link.url ? t("opensExternal") : undefined;
  const open = () => {
    if (link.url) void Linking.openURL(link.url);
    else if (link.href) router.push(link.href);
  };
  return (
    <Pressable
      accessibilityRole={link.url ? "link" : "button"}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={open}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 56,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Icon name={link.icon} size={20} color={colors.primaryText} />
      </View>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name={link.url ? "arrowRight" : "chevronRight"} size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const t = useCopy("profile", copy);
  const session = useSession();
  const sync = useSyncState();
  const downloads = useDownloadedLessons();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const user = session.user;
  const progress = session.progress;
  const downloadCount = downloads.data?.length ?? 0;

  const removeDownloads = () => {
    Alert.alert(t("removeTitle"), t("removeBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("removeConfirm"),
        style: "destructive",
        onPress: () =>
          void lessonRepo.removeDownloads().then(async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.downloads });
            toast.show({ message: t("removed"), tone: "success" });
          }),
      },
    ]);
  };

  const signOut = () => {
    const body = sync.pending > 0 ? t("signOutPending", { count: sync.pending }) : t("signOutBody");
    Alert.alert(t("signOutTitle"), body, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("signOut"),
        style: "destructive",
        onPress: () => {
          setSigningOut(true);
          void session.signOut().finally(() => setSigningOut(false));
        },
      },
    ]);
  };

  const syncLine =
    sync.pending > 0
      ? t(plural(sync.pending, "syncPendingOne", "syncPendingOther") as "syncPendingOne", { count: sync.pending })
      : sync.lastSyncedAt
        ? t("syncLast", { time: new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) })
        : t("syncedJustNow");

  return (
    <Screen>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        {t("title")}
      </Text>

      {user ? (
        <Card style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={user.displayName}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: user.avatarColor || colors.primary,
            }}
          >
            <Text variant="title" style={{ color: "#FFFFFF" }}>
              {initials(user.displayName)}
            </Text>
          </View>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text variant="heading">{user.displayName}</Text>
            <Text variant="callout" tone="muted">
              {user.email}
            </Text>
          </View>
          <Row gap={spacing.sm} wrap justify="center">
            <Chip label={t(`role_${user.role}`)} tone="primary" icon="user" />
            {user.gradeBand ? <Chip label={t("grades", { band: user.gradeBand })} /> : null}
          </Row>
          {progress ? (
            <Row style={{ alignSelf: "stretch", marginTop: spacing.sm }}>
              <Stat value={String(levelForXp(progress.totalXp).level)} label={t("level")} />
              <Stat value={String(progress.totalXp)} label={t("xp")} />
              <Stat value={String(progress.streak.longest)} label={t("bestStreak")} />
            </Row>
          ) : null}
        </Card>
      ) : null}

      <Text variant="heading">{t("offline")}</Text>
      <Card style={{ gap: spacing.md }}>
        <Row gap={spacing.md}>
          <Icon name="download" size={22} color={colors.successText} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {downloadCount > 0
              ? t(plural(downloadCount, "downloadsOne", "downloadsOther") as "downloadsOne", { count: downloadCount })
              : t("downloadsNone")}
          </Text>
        </Row>
        <Row gap={spacing.md}>
          <Icon name={sync.pending > 0 ? "refresh" : "check"} size={22} color={colors.textMuted} />
          <Text variant="callout" tone="muted" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {syncLine}
          </Text>
        </Row>
        {downloadCount > 0 ? (
          <Button label={t("removeDownloads")} variant="secondary" size="sm" icon="trash" onPress={removeDownloads} />
        ) : null}
      </Card>

      <Text variant="heading">{t("more")}</Text>
      <Card style={{ paddingVertical: spacing.xs }}>
        {PROFILE_LINKS.map((link, i) => (
          <LinkRow key={link.key} link={link} last={i === PROFILE_LINKS.length - 1} />
        ))}
      </Card>

      <Button label={t("signOut")} variant="danger" icon="logout" onPress={signOut} loading={signingOut} />
    </Screen>
  );
}

