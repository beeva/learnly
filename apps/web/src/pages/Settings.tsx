import { preferencesSchema, type PreferencesInput } from "@learnly/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useUpdatePreferences } from "../api/hooks";
import { setTheme, useTheme, type ThemeChoice } from "../app/AppShell";
import { useAuth, useCurrentUser } from "../auth/AuthProvider";
import { useT } from "../i18n/I18nProvider";
import { Avatar, Button, Card, ChoiceGroup, Field, Input, Switch, cx, useToast } from "../ui/components";
import { CheckIcon, LogOutIcon, MoonIcon, SettingsIcon, SunIcon } from "../ui/icons";
import styles from "./Settings.module.css";

const AVATAR_COLORS = ["#5B5BD6", "#FF7A59", "#2FB67C", "#F5A524", "#E25C9A", "#2E9CCA", "#8A63D2", "#1C1B29"];
const GOALS = ["5", "10", "15", "20", "30"] as const;
type Goal = (typeof GOALS)[number];

export function SettingsPage() {
  const { t } = useT();
  const user = useCurrentUser();
  const { preferences, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const update = useUpdatePreferences();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [nameError, setNameError] = useState<string | null>(null);

  function save(input: PreferencesInput, message = t("settings.saved")) {
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) return false;
    update.mutate(parsed.data, {
      onSuccess: () => toast({ title: message, tone: "success", durationMs: 2500 }),
      onError: () => toast({ title: t("settings.saveError"), tone: "warning" }),
    });
    return true;
  }

  function saveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError(t("settings.nameRequired"));
      return;
    }
    setNameError(null);
    if (trimmed !== user.displayName) save({ displayName: trimmed });
  }

  const goal = String(preferences?.dailyGoalMinutes ?? 15);

  return (
    <div className={styles.page}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </header>

      <Card as="section" aria-labelledby="profile-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="profile-title">{t("settings.profile")}</h2>
          <p>{t("settings.profileBody")}</p>
        </div>
        <div className={styles.profile}>
          <Avatar name={displayName || user.displayName} color={user.avatarColor} size={72} />
          <form className={styles.nameForm} onSubmit={saveName} noValidate>
            <Field label={t("settings.displayName")} error={nameError}>
              {(control) => <Input {...control} value={displayName} maxLength={60} autoComplete="nickname" onChange={(event) => setDisplayName(event.target.value)} />}
            </Field>
            <Button type="submit" variant="secondary" disabled={displayName.trim() === user.displayName} loading={update.isPending && update.variables?.displayName !== undefined}>
              {t("common.save")}
            </Button>
          </form>
        </div>
        <fieldset className={styles.swatches}>
          <legend className={styles.label}>{t("settings.avatarColor")}</legend>
          <div className={styles.swatchRow}>
            {AVATAR_COLORS.map((color) => {
              const selected = color.toLowerCase() === user.avatarColor.toLowerCase();
              return (
                <label key={color} className={cx(styles.swatch, selected && styles.swatchSelected)} style={{ background: color }}>
                  <input
                    type="radio"
                    name="avatar-color"
                    className="sr-only"
                    checked={selected}
                    onChange={() => save({ avatarColor: color })}
                    aria-label={t("settings.colorOption", { color })}
                  />
                  {selected ? <CheckIcon size={18} /> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card as="section" aria-labelledby="learning-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="learning-title">{t("settings.learning")}</h2>
          <p>{t("settings.learningBody")}</p>
        </div>
        <ChoiceGroup<Goal>
          legend={t("settings.dailyGoal")}
          name="daily-goal"
          columns={5}
          size="sm"
          value={(GOALS as readonly string[]).includes(goal) ? (goal as Goal) : null}
          onChange={(value) => save({ dailyGoalMinutes: Number(value) }, t("settings.goalSaved", { count: Number(value) }))}
          options={GOALS.map((value) => ({ value, label: t("common.minutes", { count: Number(value) }) }))}
        />
      </Card>

      <Card as="section" aria-labelledby="comfort-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="comfort-title">{t("settings.comfort")}</h2>
          <p>{t("settings.comfortBody")}</p>
        </div>
        <div className={styles.switches}>
          <Switch
            label={t("settings.reducedMotion")}
            description={t("settings.reducedMotionBody")}
            checked={preferences?.reducedMotion ?? false}
            onChange={(checked) => save({ reducedMotion: checked })}
          />
          <Switch
            label={t("settings.sound")}
            description={t("settings.soundBody")}
            checked={preferences?.soundEffects ?? false}
            onChange={(checked) => save({ soundEffects: checked })}
          />
        </div>
        <ChoiceGroup<ThemeChoice>
          legend={t("settings.theme")}
          name="theme"
          columns={3}
          size="sm"
          value={theme.choice}
          onChange={(choice) => setTheme(choice)}
          options={[
            { value: "system", label: t("settings.theme.system"), icon: SettingsIcon },
            { value: "light", label: t("settings.theme.light"), icon: SunIcon },
            { value: "dark", label: t("settings.theme.dark"), icon: MoonIcon },
          ]}
        />
      </Card>

      <Card as="section" aria-labelledby="account-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="account-title">{t("settings.account")}</h2>
          <p>{t("settings.signedInAs", { email: user.email })}</p>
        </div>
        <div>
          <Button
            variant="danger"
            leadingIcon={LogOutIcon}
            onClick={async () => {
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            {t("settings.signOut")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
