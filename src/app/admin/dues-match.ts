/** Lower-cased, trimmed email for matching applications to dues payments. */
export const emailKey = (email: string) => email.trim().toLowerCase();

/**
 * Dues payments grouped by email (case-insensitive), so an application card
 * can show whether that applicant has paid. Keeps the input order (newest
 * first, as the admin page loads them).
 */
export function duesByEmail<T extends { email: string }>(
  payments: T[],
): Map<string, T[]> {
  const byEmail = new Map<string, T[]>();
  for (const p of payments) {
    const key = emailKey(p.email);
    byEmail.set(key, [...(byEmail.get(key) ?? []), p]);
  }
  return byEmail;
}
