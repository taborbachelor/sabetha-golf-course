/** "8.25", "$8.25" or "8" -> 825. Null if it isn't a sensible price. */
export function parseDollars(input: string): number | null {
  const m = input
    .trim()
    .replace(/^\$/, "")
    .match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/**
 * Price for display, without cents when there are none: 60000 -> "$600",
 * 60050 -> "$600.50", 125000 -> "$1,250". For whole-dollar amounts like
 * membership dues; menu prices keep their cents (formatPrice).
 */
export function formatDollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
