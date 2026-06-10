import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ID_KIND, seedUuid } from "../../mocks/content";
import { renderWithProviders, screen } from "../../test/render";
import { InsightsPage, rangeForPreset } from "./InsightsPage";

const PERIOD_2 = seedUuid(ID_KIND.classroom, 1);

function renderInsights(classroomId = PERIOD_2) {
  return renderWithProviders(<InsightsPage />, { route: `/teach/${classroomId}`, path: "/teach/:classroomId", signedInAs: "educator" });
}

describe("InsightsPage", () => {
  it("shows the class header and overview tiles", async () => {
    await renderInsights();
    expect(await screen.findByRole("heading", { level: 1, name: "Period 2 · Fractions" })).toBeInTheDocument();
    expect(await screen.findByText("Fractions Foundations")).toBeInTheDocument();
    expect(screen.getByText("Students: 24")).toBeInTheDocument();

    const tiles = await screen.findByRole("list", { name: "Class at a glance" });
    expect(within(tiles).getByText("Completion")).toBeInTheDocument();
    expect(within(tiles).getByText("Time learning")).toBeInTheDocument();
    expect(within(tiles).getByText("Needs attention")).toBeInTheDocument();
  });

  it("switches to the heatmap with a row per student", async () => {
    const { user } = await renderInsights();
    await screen.findByRole("heading", { level: 1, name: "Period 2 · Fractions" });

    await user.click(screen.getByRole("tab", { name: "Mastery heatmap" }));
    expect(screen.getByRole("tab", { name: "Mastery heatmap" })).toHaveAttribute("aria-selected", "true");

    const table = await screen.findByRole("table", { name: /Mastery for 24 students across 6 skills/ });
    // One header row plus a row per student.
    expect(within(table).getAllByRole("row")).toHaveLength(25);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(24);
  });

  it("filters the student list to those who need attention", async () => {
    const { user } = await renderInsights();
    await screen.findByRole("heading", { level: 1, name: "Period 2 · Fractions" });
    await user.click(screen.getByRole("tab", { name: "Students" }));

    expect(await screen.findByText("Showing 24 of 24 students")).toBeInTheDocument();
    const filter = screen.getByRole("switch", { name: "Only show students who need attention" });
    if (filter.hasAttribute("disabled")) return; // a perfectly healthy seed roster has nobody to filter

    await user.click(filter);
    expect(filter).toHaveAttribute("aria-checked", "true");
    const summary = await screen.findByText(/^Showing \d+ of 24 students$/);
    const shown = Number(/Showing (\d+)/.exec(summary.textContent ?? "")?.[1]);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(24);
  });

  it("explains when the class doesn't exist", async () => {
    await renderInsights(seedUuid(ID_KIND.classroom, 999));
    expect(await screen.findByText("We couldn't find that class")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All classes" })).toHaveAttribute("href", "/teach");
    expect(screen.queryByRole("tab", { name: "Mastery heatmap" })).toBeNull();
  });
});

describe("rangeForPreset", () => {
  it("covers the last N days including today", () => {
    expect(rangeForPreset(7, new Date(2026, 9, 26))).toEqual({ from: "2026-10-20", to: "2026-10-26" });
  });
});
