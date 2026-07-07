import { expect, test, type Page } from "@playwright/test";

async function signInAsDemoEducator(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue as demo educator" }).click();
  // Educators land on their classes rather than the learner dashboard.
  await page.waitForURL("**/teach");
}

test.describe("educator insights", () => {
  test("lists classes with join codes", async ({ page }) => {
    await signInAsDemoEducator(page);
    await expect(page.getByRole("heading", { level: 1, name: "Your classes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Period 2 · Fractions" })).toBeVisible();
    await expect(page.getByText("FRAC24").first()).toBeVisible();
  });

  test("opens a class and explores hotspots, the heatmap and students", async ({ page }) => {
    await signInAsDemoEducator(page);
    await page.getByRole("link", { name: "Period 2 · Fractions" }).click();
    await page.waitForURL(/\/teach\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { level: 1, name: "Period 2 · Fractions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Struggle hotspots" })).toBeVisible();

    await page.getByRole("tab", { name: "Mastery heatmap" }).click();
    const heatmap = page.getByRole("table", { name: /Mastery for 24 students/ });
    await expect(heatmap).toBeVisible();
    await expect(heatmap.getByRole("rowheader")).toHaveCount(24);

    await page.getByRole("tab", { name: "Students" }).click();
    await expect(page.getByText("Showing 24 of 24 students")).toBeVisible();
  });

  test("exports the class as CSV", async ({ page }) => {
    await signInAsDemoEducator(page);
    await page.getByRole("link", { name: "Period 2 · Fractions" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^period-2-fractions-\d{4}-\d{2}-\d{2}\.csv$/);
    await expect(page.getByText("CSV downloaded").first()).toBeVisible();
  });

  test("students can't open the educator area", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Continue as demo student" }).click();
    await page.waitForURL("**/home");
    await page.goto("/teach");
    await page.waitForURL("**/home");
    await expect(page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), Maya/ })).toBeVisible();
  });
});
