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

