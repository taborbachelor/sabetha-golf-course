export type Cell = string | number | boolean | null | undefined;

/**
 * One CSV field. Quotes when needed, and neutralises text a spreadsheet
 * would run as a formula (a golfer named "=HYPERLINK(...)").
 */
export function csvField(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a header row and CRLF line endings (Excel-friendly). */
export function toCsv(headers: string[], rows: Cell[][]): string {
  return (
    [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") +
    "\r\n"
  );
}

/** Cents as a plain dollar amount for spreadsheets: 1050 -> "10.50". */
export function dollars(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}
