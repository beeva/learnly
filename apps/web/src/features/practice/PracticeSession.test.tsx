import { ENCOURAGEMENT } from "@learnly/shared";
import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/render";
import { PracticePage } from "./PracticeSession";

const encouragementPatterns = Object.values(ENCOURAGEMENT).map(
  (template) => new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\w+\}/g, ".+")}$`),
);

function renderPractice() {
  return renderWithProviders(<PracticePage />, {
    route: "/practice/fractions-foundations",
    path: "/practice/:courseSlug",
    signedInAs: "student",
  });
}

/** Give some answer to whatever item the adaptive engine picked. */
async function answerCurrentItem(user: Awaited<ReturnType<typeof renderPractice>>["user"]) {
  const radios = screen.queryAllByRole("radio");
  if (radios.length > 0) {
    await user.click(radios[0]!);
    return;
  }
  const input = screen.queryByRole("textbox");
  if (input) {
    await user.type(input, "3");
    return;
  }
  // Ordering items are always submittable in their initial order.
  expect(screen.getAllByRole("listitem", { name: /position \d of \d/ }).length).toBeGreaterThan(1);
}

describe("PracticePage", () => {
  it("introduces the session calmly before starting", async () => {
    await renderPractice();
    expect(await screen.findByRole("heading", { name: "Practice: Fractions Foundations" })).toBeInTheDocument();
    expect(screen.getByText("No timer — take your time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeEnabled();
  });

  it("serves an adaptive item, reveals hints and gives encouraging feedback", async () => {
    const { user } = await renderPractice();
    await user.click(await screen.findByRole("button", { name: "Start practice" }));

    const check = await screen.findByRole("button", { name: "Check" }, { timeout: 3000 });
    expect(screen.getByRole("progressbar", { name: "Question 1 of 8" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Need a hint?" }));
    expect(await screen.findByText("Hint 1.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Another hint|That's every hint/ })).toBeInTheDocument();

    await answerCurrentItem(user);
    await user.click(check);

    const next = await screen.findByRole("button", { name: "Next question" }, { timeout: 3000 });
    const feedback = next.closest("section");
    expect(feedback).not.toBeNull();
    const title = within(feedback as HTMLElement).getAllByText((_, element) =>
      Boolean(element?.tagName === "P" && encouragementPatterns.some((pattern) => pattern.test(element.textContent?.trim() ?? ""))),
    );
    expect(title.length).toBeGreaterThan(0);
    expect(within(feedback as HTMLElement).getByText(/XP/)).toBeInTheDocument();
  });

  it("nudges instead of submitting an empty answer", async () => {
    const { user } = await renderPractice();
    await user.click(await screen.findByRole("button", { name: "Start practice" }));
    const check = await screen.findByRole("button", { name: "Check" }, { timeout: 3000 });
    if (screen.queryAllByRole("listitem", { name: /position \d of \d/ }).length > 0) return; // orderings are never empty
    await user.click(check);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Pick an answer first\.|Type your answer first\./);
    expect(screen.queryByRole("button", { name: "Next question" })).not.toBeInTheDocument();
  });

  it("shows a friendly message for an unknown course", async () => {
    await renderWithProviders(<PracticePage />, { route: "/practice/underwater-basket-weaving", path: "/practice/:courseSlug", signedInAs: "student" });
    expect(await screen.findByText("We couldn't find that course.")).toBeInTheDocument();
  });
});
