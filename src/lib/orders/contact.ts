/**
 * Name and phone remembered on this device after an order, so a second
 * order mid-round doesn't mean typing them again. A per-device convenience
 * only (localStorage): nothing breaks if it's missing, blocked or garbled.
 */

export const CONTACT_STORAGE_KEY = "sgc-order-contact";

export type RememberedContact = { name: string; phone: string };

/** Parse what was stored. Anything unexpected reads as "nothing remembered". */
export function parseRememberedContact(
  raw: string | null | undefined,
): RememberedContact | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { name, phone } = value as Record<string, unknown>;
  const clean = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const contact = { name: clean(name, 80), phone: clean(phone, 30) };
  return contact.name || contact.phone ? contact : null;
}

export function readRememberedContact(): RememberedContact | null {
  try {
    return parseRememberedContact(localStorage.getItem(CONTACT_STORAGE_KEY));
  } catch {
    return null; // Private mode, blocked storage, or no window (server).
  }
}

export function rememberContact(contact: RememberedContact): void {
  try {
    localStorage.setItem(
      CONTACT_STORAGE_KEY,
      JSON.stringify({
        name: contact.name.trim(),
        phone: contact.phone.trim(),
      }),
    );
  } catch {
    // Storage blocked or full: it's only a convenience.
  }
}
