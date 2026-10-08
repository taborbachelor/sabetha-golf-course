"use client";

import { useEffect, useRef, useState } from "react";

/** Minimal typings for the parts of the Square Web Payments SDK we use. */
type SquareCard = {
  attach(selector: string | HTMLElement): Promise<void>;
  tokenize(): Promise<{
    status: "OK" | string;
    token?: string;
    errors?: { message: string }[];
  }>;
  destroy(): Promise<boolean>;
};
type SquarePayments = { card(): Promise<SquareCard> };
declare global {
  interface Window {
    Square?: { payments(appId: string, locationId: string): SquarePayments };
  }
}

// Sandbox only until Phase 4 (PLAN.md).
const SDK_URL = "https://sandbox.web.squarecdn.com/v1/square.js";

let sdkPromise: Promise<void> | null = null;
function loadSdk(): Promise<void> {
  if (window.Square) return Promise.resolve();
  sdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Couldn't load the card form"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export type TokenizeFn = () => Promise<
  { ok: true; token: string } | { ok: false; message: string }
>;

/**
 * Square's hosted card field. Card numbers go straight to Square; we only
 * ever see a one-time token. Calls onReady with a tokenize function.
 */
export function SquareCard({
  onReady,
}: {
  onReady: (tokenize: TokenizeFn | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
    let card: SquareCard | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (!appId || !locationId) throw new Error("Payments aren't set up");
        await loadSdk();
        card = await window.Square!.payments(appId, locationId).card();
        if (cancelled || !container.current) return;
        await card.attach(container.current);
        onReady(async () => {
          const result = await card!.tokenize();
          return result.status === "OK" && result.token
            ? { ok: true, token: result.token }
            : {
                ok: false,
                message:
                  result.errors?.[0]?.message ?? "Check your card details",
              };
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Couldn't load the card form",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      onReady(null);
      void card?.destroy();
    };
  }, [onReady]);

  return (
    <div>
      <div ref={container} className="min-h-24" />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}. Please refresh and try again.
        </p>
      )}
    </div>
  );
}
