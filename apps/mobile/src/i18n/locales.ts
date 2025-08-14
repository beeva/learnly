import { getLocales } from "expo-localization";
import { LOCALES, resolveLocale, type LocaleCode } from "@learnly/shared";
import { kvGet } from "../db/schema";
import { es } from "./es";
import { fil } from "./fil";
import { registerCatalog, setLocale } from "./index";

export const LANGUAGE_OPTIONS = LOCALES;

export function deviceLocale(): LocaleCode {
  return resolveLocale(getLocales()[0]?.languageTag ?? null);
}

/**
 * Registers translations and applies the best locale before the first screen:
 * the learner's saved preference when we have one, otherwise the device language.
 */
export async function initI18n(): Promise<LocaleCode> {
  registerCatalog("es", es);
  registerCatalog("fil", fil);
  setLocale(deviceLocale());
  const me = await kvGet<{ preferences?: { locale?: string } }>("me").catch(() => null);
  const saved = me?.preferences?.locale;
  const locale = saved ? resolveLocale(saved) : deviceLocale();
  setLocale(locale);
  return locale;
}
