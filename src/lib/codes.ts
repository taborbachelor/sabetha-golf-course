import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: easy to read aloud and off a phone screen.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Short human-friendly code like "R-7K3Q". Not a secret: receipts use UUIDs. */
export function shortCode(prefix: string, length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${code}`;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
