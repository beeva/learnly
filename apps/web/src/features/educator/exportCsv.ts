import { educatorApi } from "../../api/client";

/** "Period 2 · Fractions" → "period-2-fractions-2026-10-26.csv" */
export function csvFilename(name: string, date = new Date()): string {
  const slug =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "classroom";
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return `${slug}-${day}.csv`;
}

/**
 * Fetch the classroom CSV with the learner's auth token (a plain link can't
 * carry it) and hand it to the browser as a download.
 */
export async function downloadClassroomCsv(classroomId: string, filename: string): Promise<void> {
  const csv = await educatorApi.exportCsv(classroomId);
  // Excel opens UTF-8 correctly only with a BOM — accented student names depend on it.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
