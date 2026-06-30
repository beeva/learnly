import { expect, test, type Page } from "@playwright/test";

async function signInAsDemoStudent(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue as demo student" }).click();
  await page.waitForURL("**/home");
}

/** Answer whichever item the adaptive engine served. */
async function answerCurrentItem(page: Page) {
  const radios = page.getByRole("radio");
  if ((await radios.count()) > 0) {
    await radios.first().check({ force: true });
    return;
  }
  const input = page.getByRole("textbox");
  if ((await input.count()) > 0) {
    await input.first().fill("3");
  }
  // Ordering items can be submitted in their initial order.
}

test.describe("learner journey", () => {
  test("signs in with the demo account and lands on a personal home", async ({ page }) => {
    await signInAsDemoStudent(page);
    await expect(page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), Maya/ })).toBeVisible();
    await expect(page.getByText(/day streak/).first()).toBeVisible();
  });

  test("continues the in-progress lesson from home and paces through it", async ({ page }) => {
    await signInAsDemoStudent(page);
    await page.getByRole("link", { name: "Resume" }).click();
    await page.waitForURL(/\/lessons\/[0-9a-f-]+/);

    const article = page.locator("article[data-lesson-ready]");
    await expect(article).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Same amount, different names" })).toBeVisible();

    await page.getByRole("button", { name: "Close lesson" }).click();
    await expect(page).toHaveURL(/\/courses\/fractions-foundations|\/home/);
  });

  test("practices a question and gets encouraging feedback", async ({ page }) => {
    await signInAsDemoStudent(page);
    await page.goto("/practice/fractions-foundations");
    await page.getByRole("button", { name: "Start practice" }).click();

    await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
    await page.getByRole("button", { name: "Need a hint?" }).click();
    await expect(page.getByText("Hint 1.")).toBeVisible();

    await answerCurrentItem(page);
    await page.getByRole("button", { name: "Check" }).click();

    await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
    await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next question" })).toBeFocused();
  });

  test("keyboard users can skip straight to the content", async ({ page, isMobile }) => {
    test.skip(isMobile, "Keyboard navigation is a desktop concern");
    await signInAsDemoStudent(page);
    // Start from a fresh load so focus begins at the top of the document.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("new students are invited to find their starting point", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("What should we call you?").fill("Sam Lee");
    await page.getByText("Grades 3–5").click();
    await page.getByLabel("Email").fill(`sam-${Date.now()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("fractions2024");
    await page.getByRole("button", { name: "Start learning" }).click();
    await page.waitForURL("**/home");
    await expect(page.getByRole("heading", { name: "Welcome to Learnly!" })).toBeVisible();
    await page.getByRole("link", { name: "Set me up" }).click();
    await expect(page.getByRole("heading", { name: "Hi Sam! Let's get you started." })).toBeVisible();
  });
});
