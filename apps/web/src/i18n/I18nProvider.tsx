import { formatMessage } from "@learnly/shared";
import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import * as en from "./messages/en";

/*
 * Copy lives in per-locale catalogs grouped into sections. Keys are flat
 * ("practice.check"), so a section can be added without touching lookups.
 */
type Sections = typeof en;
export type MessageKey = { [S in keyof Sections]: keyof Sections[S] & string }[keyof Sections];
export type Catalog = Record<MessageKey, string>;
export type MessageValues = Record<string, string | number>;

export function flattenCatalog(sections: object): Record<string, string> {
  return Object.assign({}, ...Object.values(sections)) as Record<string, string>;
}

const english = flattenCatalog(en) as Catalog;
const catalogs = new Map<string, Partial<Record<string, string>>>([["en", english]]);
let current = "en";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocale(): string {
  return current;
}

export function registerCatalog(locale: string, catalog: Partial<Record<string, string>>): void {
  catalogs.set(locale, catalog);
}

export function activateLocale(locale: string): void {
  if (!catalogs.has(locale) || locale === current) return;
  current = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
}

/** Translate a key in the active locale, falling back to English, then to the key itself. */
export function t(key: MessageKey, values?: MessageValues): string {
  const template = catalogs.get(current)?.[key] ?? english[key] ?? key;
  return values ? formatMessage(template, values) : template;
}

/** Locale-aware number formatting ("1,240 XP" / "1.240 XP"). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(current, options).format(value);
}

export function useT() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return { t, locale, formatNumber };
}

/** Re-renders the tree when the locale changes so every string updates at once. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return <Fragment key={locale}>{children}</Fragment>;
}

type LocaleCode = import("@learnly/shared").LocaleCode;

const LOCALE_KEY = "learnly.locale";

const loaders: Record<Exclude<LocaleCode, "en">, () => Promise<Record<string, string>>> = {
  es: () => import("./messages/es").then((module) => flattenCatalog(module)),
  fil: () => import("./messages/fil").then((module) => flattenCatalog(module)),
};

/** Fetch (once) and activate a locale. Catalogs are split so English users never download them. */
export async function setLocale(locale: LocaleCode): Promise<void> {
  if (locale !== "en" && !catalogs.has(locale)) registerCatalog(locale, await loaders[locale]());
  activateLocale(locale);
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function storedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

/** For dynamic keys (e.g. nav ids) that may not exist in every catalog. */
export function translateOr(key: string, fallback: string): string {
  return catalogs.get(current)?.[key] ?? (english as Record<string, string>)[key] ?? fallback;
}
