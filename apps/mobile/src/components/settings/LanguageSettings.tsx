import type { LocaleCode } from "@learnly/shared";
import { setLocale, useCopy, useLocale } from "../../i18n";
import { LANGUAGE_OPTIONS } from "../../i18n/locales";
import { useSession } from "../../session/SessionProvider";
import { analytics } from "../../analytics/analytics";
import { RadioRow, SettingsGroup } from "../SettingRow";

const copy = {
  title: "Language",
  footer: "Lessons stay in the language your teacher chose; buttons, tips and encouragement follow this setting.",
};

export function LanguageSettings() {
  const t = useCopy("settings.language", copy);
  const locale = useLocale();
  const { updatePreferences } = useSession();

  const choose = (code: LocaleCode) => {
    if (code === locale) return;
    setLocale(code);
    analytics.track("language_changed", { locale: code });
    void updatePreferences({ locale: code });
  };

  return (
    <SettingsGroup title={t("title")} footer={t("footer")}>
      {LANGUAGE_OPTIONS.map((option, index) => (
        <RadioRow
          key={option.code}
          icon={index === 0 ? "globe" : undefined}
          label={option.label}
          selected={option.code === locale}
          onPress={() => choose(option.code)}
          last={index === LANGUAGE_OPTIONS.length - 1}
        />
      ))}
    </SettingsGroup>
  );
}
