/**
 * Makes one $1.00 SANDBOX payment through src/lib/payments with Square's
 * test card token, to prove the credentials and adapter work end to end.
 *
 *   node scripts/square-sandbox-check.mts
 *
 * Reads .env.local. Never prints secrets. Sandbox only: no real money moves.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createSquareProvider } from "../src/lib/payments/square.ts";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8")
  .replace(/^﻿/, "")
  .split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

if (env.SQUARE_ENVIRONMENT !== "sandbox") {
  console.error("SQUARE_ENVIRONMENT must be 'sandbox'. Aborting.");
  process.exit(1);
}

const provider = createSquareProvider({
  environment: "sandbox",
  accessToken: env.SQUARE_ACCESS_TOKEN,
  locationId: env.SQUARE_LOCATION_ID,
});

const id = `check-${randomUUID()}`;
const result = await provider.charge({
  sourceToken: "cnon:card-nonce-ok", // Square sandbox test token
  amountCents: 100,
  idempotencyKey: id,
  referenceId: id,
  note: "Sandbox connectivity check",
});

console.log(
  result.ok
    ? `OK: payment ${result.paymentId} ${result.status}`
    : `FAILED: ${result.code} (${result.message})`,
);
process.exit(result.ok ? 0 : 1);
