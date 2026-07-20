import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Role = "student" | "educator" | null;

interface Screen {
  name: string;
  path: string;
  as: Role;
  ready: (page: Page) => Promise<void>;
}

async function signIn(page: Page, role: Exclude<Role, null>) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Continue as demo ${role}` }).click();
  await page.waitForURL(role === "student" ? "**/home" : "**/teach");
}

const SCREENS: Screen[] = [
  { name: "landing", path: "/", as: null, ready: (page) => expect(page.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "sign in", path: "/sign-in", as: null, ready: (page) => expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible() },
  { name: "sign up", path: "/sign-up", as: null, ready: (page) => expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible() },
  { name: "home", path: "/home", as: "student", ready: (page) => expect(page.getByRole("link", { name: "Resume" })).toBeVisible() },
  {
    name: "practice intro",
    path: "/practice/fractions-foundations",
    as: "student",
    ready: (page) => expect(page.getByRole("button", { name: "Start practice" })).toBeVisible(),
  },
  { name: "progress", path: "/progress", as: "student", ready: (page) => expect(page.getByRole("heading", { name: "Skill mastery" })).toBeVisible() },
  { name: "course detail", path: "/courses/fractions-foundations", as: "student", ready: (page) => expect(page.getByRole("heading", { name: "Skills map" })).toBeVisible() },
  { name: "settings", path: "/settings", as: "student", ready: (page) => expect(page.getByRole("switch", { name: "Reduce motion" })).toBeVisible() },
  { name: "classes", path: "/teach", as: "educator", ready: (page) => expect(page.getByRole("link", { name: "Period 2 · Fractions" })).toBeVisible() },
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      // Reduced motion lets entrance animations settle instantly before scanning.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    });

    for (const screen of SCREENS) {
      test(`${screen.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
        if (screen.as) await signIn(page, screen.as);
        await page.goto(screen.path);
        await screen.ready(page);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
      });
    }

    test("class insights have no WCAG 2.2 AA violations", async ({ page }) => {
      await signIn(page, "educator");
      await page.getByRole("link", { name: "Period 2 · Fractions" }).click();
      await expect(page.getByRole("heading", { name: "Struggle hotspots" })).toBeVisible();
      const overview = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(overview.violations.map((violation) => violation.id)).toEqual([]);

      await page.getByRole("tab", { name: "Mastery heatmap" }).click();
      await expect(page.getByRole("table", { name: /Mastery for 24 students/ })).toBeVisible();
      const heatmap = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(heatmap.violations.map((violation) => violation.id)).toEqual([]);
    });
  });
}

test.describe("motion preferences", () => {
  test("the in-app reduce motion setting calms the whole UI", async ({ page }) => {
    await signIn(page, "student");
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "Reduce motion" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

    const duration = await page.evaluate(() => getComputedStyle(document.body).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
  });

  test("the OS reduced-motion setting is honoured without any in-app change", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page.evaluate(() => getComputedStyle(document.body).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
  });
});
