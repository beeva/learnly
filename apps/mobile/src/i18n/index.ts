import { useCallback, useSyncExternalStore } from "react";
import { formatMessage } from "@learnly/shared";

/**
 * Copy lives next to the screen that uses it as English defaults
 * (`useCopy("home", { greeting: "Hi {name}" })`), in the spirit of FormatJS's
 * `defaultMessage`. Translations are registered per locale as namespace → key →
 * string catalogs; anything missing falls back to the English default, so a new
 * string never renders blank while it waits for translation.
 */
export type Messages = Record<string, string>;
export type Catalog = Record<string, Messages | undefined>;
export type MessageValues = Record<string, string | number>;

const catalogs = new Map<string, Catalog>();
const listeners = new Set<() => void>();
let activeLocale = "en";

function emit() {
  for (const listener of listeners) listener();
}

export function registerCatalog(locale: string, catalog: Catalog): void {
  catalogs.set(locale, catalog);
  emit();
}

export function availableLocales(): string[] {
  return ["en", ...[...catalogs.keys()].filter((code) => code !== "en")];
}

export function getLocale(): string {
  return activeLocale;
}

export function setLocale(locale: string): void {
  const next = locale === "en" || catalogs.has(locale) ? locale : "en";
  if (next === activeLocale) return;
  activeLocale = next;
  emit();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function translate(
  namespace: string,
  key: string,
  fallback: string,
  values?: MessageValues,
  locale: string = activeLocale,
): string {
  const template = catalogs.get(locale)?.[namespace]?.[key] ?? fallback;
  return values ? formatMessage(template, values) : template;
}

export function useLocale(): string {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export type Translator<M extends Messages> = (key: keyof M & string, values?: MessageValues) => string;

export function useCopy<M extends Messages>(namespace: string, defaults: M): Translator<M> {
  const locale = useLocale();
  return useCallback(
    (key: keyof M & string, values?: MessageValues) =>
      translate(namespace, key, defaults[key] ?? key, values, locale),
    // `defaults` is a module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, locale],
  );
}

/** Pick "one"/"other" plural forms; good enough for en, es and fil UI counts. */
export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

const formatterCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function intlLocale(locale: string): string {
  // Filipino is "fil" in Intl; Hermes ships with full ICU on both platforms in SDK 51.
  return locale === "fil" ? "fil-PH" : locale;
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}, locale = activeLocale): string {
  const key = `n:${locale}:${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key) as Intl.NumberFormat | undefined;
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale(locale), options);
    formatterCache.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatPercent(ratio: number, locale = activeLocale): string {
  return formatNumber(ratio, { style: "percent", maximumFractionDigits: 0 }, locale);
}

export function formatTime(date: Date, locale = activeLocale): string {
  const key = `t:${locale}`;
  let formatter = formatterCache.get(key) as Intl.DateTimeFormat | undefined;
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" });
    formatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

const RELATIVE_FALLBACK: Record<string, { now: string; minutes: string; hours: string; days: string }> = {
  en: { now: "just now", minutes: "{n} min ago", hours: "{n} h ago", days: "{n} d ago" },
};

export function formatRelative(iso: string | null, now = Date.now(), locale = activeLocale): string {
  if (!iso) return translate("common", "never", "never", undefined, locale);
  const diffSec = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return translate("common", "justNow", RELATIVE_FALLBACK.en!.now, undefined, locale);
  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto", style: "short" });
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
    return rtf.format(Math.round(diffSec / 86_400), "day");
  } catch {
    const n = abs < 3600 ? Math.round(abs / 60) : abs < 86_400 ? Math.round(abs / 3600) : Math.round(abs / 86_400);
    const unit = abs < 3600 ? "minutes" : abs < 86_400 ? "hours" : "days";
    return formatMessage(RELATIVE_FALLBACK.en![unit], { n });
  }
}
