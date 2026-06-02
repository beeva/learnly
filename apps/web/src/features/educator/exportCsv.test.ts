import { afterEach, describe, expect, it, vi } from "vitest";
import { ID_KIND, seedUuid } from "../../mocks/content";
import { signIn } from "../../test/render";
import { csvFilename, downloadClassroomCsv } from "./exportCsv";

const OCT_26 = new Date(2026, 9, 26);

describe("csvFilename", () => {
  it("slugs the class name and appends the local date", () => {
    expect(csvFilename("Period 2 · Fractions", OCT_26)).toBe("period-2-fractions-2026-10-26.csv");
  });

  it("strips accents so names stay portable", () => {
    expect(csvFilename("Matemáticas — Año 5", OCT_26)).toBe("matematicas-ano-5-2026-10-26.csv");
  });

  it("falls back to a generic name", () => {
    expect(csvFilename("¡¡!!", OCT_26)).toBe("classroom-2026-10-26.csv");
  });
});

describe("downloadClassroomCsv", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it("fetches the export with auth and hands it to the browser as a download", async () => {
    await signIn("educator");
    const create = vi.fn((_blob: Blob | MediaSource) => "blob:learnly-test");
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("period-2.csv");
      expect(this.getAttribute("href")).toBe("blob:learnly-test");
    });

    await downloadClassroomCsv(seedUuid(ID_KIND.classroom, 1), "period-2.csv");

    expect(click).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    const blob = create.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // UTF-8 byte order mark first, so Excel reads accented names correctly.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("# Period 2 · Fractions");
    expect(text).toContain("student,minutes_this_week,streak_days,mastered_skills,needs_attention,last_active");
    // The temporary anchor is removed again.
    expect(document.querySelector('a[href="blob:learnly-test"]')).toBeNull();
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:learnly-test"), { timeout: 2000 });
  });

  it("rejects when the export fails so the page can show an error", async () => {
    await expect(downloadClassroomCsv(seedUuid(ID_KIND.classroom, 1), "x.csv")).rejects.toMatchObject({ code: "unauthorized" });
  });
});
