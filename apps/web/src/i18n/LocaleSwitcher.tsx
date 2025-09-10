import { LOCALES, resolveLocale, type LocaleCode } from "@learnly/shared";
import { useEffect, useId } from "react";
import { announce } from "../a11y/announcer";
import { useUpdatePreferences } from "../api/hooks";
import { useAuth } from "../auth/AuthProvider";
import { Select } from "../ui/components";
import { GlobeIcon } from "../ui/icons";
import { setLocale, storedLocale, t, useT } from "./I18nProvider";

/**
 * Keeps the active locale in step with the learner's saved preference, falling
 * back to their last choice on this device and then the browser language.
 */
export function LocaleSync() {
  const { preferences, status } = useAuth();
  const saved = preferences?.locale;

  useEffect(() => {
    if (status === "loading") return;
    const wanted = resolveLocale(saved ?? storedLocale() ?? (typeof navigator === "undefined" ? "en" : navigator.language));
    void setLocale(wanted);
  }, [saved, status]);

  return null;
}

/** Compact language picker for the sidebar footer. */
export function LocaleSwitcher() {
  const { locale } = useT();
  const { status } = useAuth();
  const update = useUpdatePreferences();
  const id = useId();

  async function choose(code: LocaleCode) {
    await setLocale(code);
    const label = LOCALES.find((entry) => entry.code === code)?.label ?? code;
    announce(t("locale.changed", { language: label }));
    if (status === "authenticated") update.mutate({ locale: code });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-2)" }}>
      <GlobeIcon size={18} aria-hidden="true" style={{ color: "var(--color-text-subtle)", flexShrink: 0 }} />
      <label htmlFor={id} className="sr-only">
        {t("locale.label")}
      </label>
      <Select id={id} value={resolveLocale(locale)} onChange={(event) => void choose(resolveLocale(event.target.value))} style={{ minHeight: 40 }}>
        {LOCALES.map((entry) => (
          <option key={entry.code} value={entry.code} lang={entry.code}>
            {entry.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
