import { useSession } from "../../session/SessionProvider";
import { useSystemReducedMotion } from "../../theme/ThemeProvider";
import { useCopy } from "../../i18n";
import { SettingsGroup, StepperRow, SwitchRow } from "../SettingRow";

const copy = {
  title: "Learning & comfort",
  footer: "Changes save on this device right away and sync when you're online.",
  goal: "Daily goal",
  goalHint: "A small goal you hit beats a big one you dread.",
  goalValue: "{minutes} min",
  fewer: "Fewer minutes",
  more: "More minutes",
  sound: "Sounds & haptics",
  soundHint: "Gentle taps and chimes when you answer.",
  motion: "Reduce motion",
  motionHint: "Swap slides and bounces for simple fades.",
  motionSystem: "Your device already reduces motion, so Learnly does too.",
};

export function ComfortSettings() {
  const t = useCopy("settings", copy);
  const { preferences, updatePreferences } = useSession();
  const systemReduced = useSystemReducedMotion();

  return (
    <SettingsGroup title={t("title")} footer={t("footer")}>
      <StepperRow
        icon="target"
        label={t("goal")}
        description={t("goalHint")}
        value={preferences.dailyGoalMinutes}
        display={t("goalValue", { minutes: preferences.dailyGoalMinutes })}
        min={5}
        max={120}
        step={5}
        decreaseLabel={t("fewer")}
        increaseLabel={t("more")}
        onChange={(dailyGoalMinutes) => void updatePreferences({ dailyGoalMinutes })}
      />
      <SwitchRow
        icon="bell"
        label={t("sound")}
        description={t("soundHint")}
        value={preferences.soundEffects}
        onValueChange={(soundEffects) => void updatePreferences({ soundEffects })}
      />
      <SwitchRow
        icon="sparkle"
        label={t("motion")}
        description={systemReduced ? t("motionSystem") : t("motionHint")}
        value={preferences.reducedMotion || systemReduced}
        disabled={systemReduced}
        onValueChange={(reducedMotion) => void updatePreferences({ reducedMotion })}
        last
      />
    </SettingsGroup>
  );
}
