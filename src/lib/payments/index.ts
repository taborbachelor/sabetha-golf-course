import "server-only";
import { serverEnv } from "@/lib/env";
import { createSquareProvider } from "./square";
import type { PaymentsProvider } from "./types";

export type { ChargeRequest, ChargeResult, PaymentsProvider } from "./types";

/** The configured payments provider (Square sandbox). */
export function getPayments(): PaymentsProvider {
  const env = serverEnv();
  return createSquareProvider({
    environment: env.SQUARE_ENVIRONMENT,
    accessToken: env.SQUARE_ACCESS_TOKEN,
    locationId: env.SQUARE_LOCATION_ID,
  });
}
