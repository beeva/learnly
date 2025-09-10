export type CsvValue = string | number | boolean | null | undefined;

/**
 * Quote per RFC 4180, and neutralise spreadsheet formula injection: a student named
 * `=HYPERLINK(...)` must not become a live formula when an educator opens the export.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  // CRLF line endings and a BOM so Excel opens UTF-8 names (José, Nguyễn) correctly.
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
