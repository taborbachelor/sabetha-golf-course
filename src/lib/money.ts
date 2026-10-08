/** "8.25", "$8.25" or "8" -> 825. Null if it isn't a sensible price. */
export function parseDollars(input: string): number | null {
  const m = input
    .trim()
    .replace(/^\$/, "")
    .match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
