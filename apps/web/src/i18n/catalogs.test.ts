import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale, t, translateOr } from "./I18nProvider";
import * as en from "./messages/en";
import * as es from "./messages/es";
import * as fil from "./messages/fil";

type CatalogModule = Record<string, Record<string, string>>;

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const source = en as unknown as CatalogModule;

describe.each([
  ["es", es as unknown as CatalogModule],
  ["fil", fil as unknown as CatalogModule],
])("%s catalog", (_code, catalog) => {
  it("has exactly the same sections as English", () => {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(source).sort());
  });

  it.each(Object.keys(source))("translates every key in %s", (section) => {
    expect(Object.keys(catalog[section] ?? {}).sort()).toEqual(Object.keys(source[section] ?? {}).sort());
  });

  it("keeps placeholders identical so interpolation never breaks", () => {
    const mismatches: string[] = [];
    for (const [section, entries] of Object.entries(source)) {
      for (const [key, english] of Object.entries(entries)) {
        const translated = catalog[section]?.[key];
        if (typeof translated !== "string" || translated.trim() === "") mismatches.push(`${key}: missing`);
        else if (placeholders(translated).join() !== placeholders(String(english)).join()) mismatches.push(`${key}: ${translated}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("locale switching", () => {
  afterEach(async () => {
    await setLocale("en");
  });

  it("switches t() output and the document language", async () => {
    expect(t("common.continue")).toBe("Continue");
    await setLocale("es");
    expect(getLocale()).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(t("common.continue")).toBe(es.common["common.continue"]);
    expect(localStorage.getItem("learnly.locale")).toBe("es");
  });

  it("interpolates values in the active locale", async () => {
    await setLocale("fil");
    expect(t("home.greeting.morning", { name: "Maya" })).toContain("Maya");
    expect(t("home.greeting.morning", { name: "Maya" })).not.toContain("{name}");
  });

  it("falls back for dynamic keys that don't exist", () => {
    expect(translateOr("nav.teach", "Teach")).toBe("Classes");
    expect(translateOr("nav.does-not-exist", "Fallback")).toBe("Fallback");
  });
});
