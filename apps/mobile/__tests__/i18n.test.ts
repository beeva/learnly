import {
  availableLocales,
  getLocale,
  registerCatalog,
  setLocale,
  translate,
  type Catalog,
} from "../src/i18n";
import { es } from "../src/i18n/es";
import { fil } from "../src/i18n/fil";

function keySet(catalog: Catalog): string[] {
  return Object.entries(catalog)
    .flatMap(([ns, messages]) => Object.keys(messages ?? {}).map((key) => `${ns}.${key}`))
    .sort();
}

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
}

afterEach(() => setLocale("en"));

describe("translate", () => {
  it("falls back to the English default and interpolates values", () => {
    expect(translate("home", "missingKey", "Hi {name}, ready?", { name: "Ana" })).toBe("Hi Ana, ready?");
  });

  it("leaves unknown placeholders visible rather than blank", () => {
    expect(translate("home", "missingKey", "{count} lessons", {})).toBe("{count} lessons");
  });

  it("switches language when a registered locale becomes active", () => {
    registerCatalog("xx", { home: { greeting: "Kumusta {name}" } });
    setLocale("xx");
    expect(getLocale()).toBe("xx");
    expect(availableLocales()).toContain("xx");
    expect(translate("home", "greeting", "Hello {name}", { name: "Lea" })).toBe("Kumusta Lea");
    expect(translate("home", "other", "Still English")).toBe("Still English");
  });

  it("ignores locales that have no catalog", () => {
    setLocale("de");
    expect(getLocale()).toBe("en");
  });
});

describe("shipped catalogs", () => {
  it("Spanish and Filipino translate exactly the same keys", () => {
    expect(keySet(fil)).toEqual(keySet(es));
  });

  it("keep every {placeholder} from one language to the other", () => {
    for (const [ns, messages] of Object.entries(es)) {
      for (const [key, template] of Object.entries(messages ?? {})) {
        const other = fil[ns]?.[key];
        expect({ key: `${ns}.${key}`, placeholders: placeholders(other ?? "") }).toEqual({
          key: `${ns}.${key}`,
          placeholders: placeholders(template),
        });
      }
    }
  });

  it("have no empty strings", () => {
    for (const catalog of [es, fil]) {
      for (const messages of Object.values(catalog)) {
        for (const value of Object.values(messages ?? {})) expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
