"use client";

import { useEffect, useRef, useState } from "react";
import {
  walletPaymentRequest,
  walletTotal,
  type WalletLineItem,
} from "@/lib/payments/wallet";

/** Minimal typings for the parts of the Square Web Payments SDK we use. */
type TokenResult = {
  status: "OK" | "Cancel" | string;
  token?: string;
  errors?: { message: string }[];
};
type SquareCard = {
  attach(selector: string | HTMLElement): Promise<void>;
  tokenize(): Promise<TokenResult>;
  destroy(): Promise<boolean>;
};
type SquarePaymentRequest = {
  update(options: { total: WalletLineItem }): boolean;
};
type SquareApplePay = {
  tokenize(): Promise<TokenResult>;
  destroy(): Promise<boolean>;
};
type SquareGooglePay = SquareApplePay & {
  attach(
    selector: string | HTMLElement,
    options?: {
      buttonColor?: "default" | "black" | "white";
      buttonSizeMode?: "static" | "fill";
      buttonType?: "long" | "short";
    },
  ): Promise<void>;
};
type SquarePayments = {
  card(): Promise<SquareCard>;
  paymentRequest(
    options: NonNullable<ReturnType<typeof walletPaymentRequest>>,
  ): SquarePaymentRequest;
  applePay(request: SquarePaymentRequest): Promise<SquareApplePay>;
  googlePay(request: SquarePaymentRequest): Promise<SquareGooglePay>;
};
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
      script.remove();
      sdkPromise = null;
      reject(new Error("load failed"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/**
 * Start downloading Square's SDK now so the card form is ready by checkout.
 * Safe to call any number of times, and a no-op on the server.
 */
export function preloadSquare(): void {
  if (typeof window === "undefined") return;
  loadSdk().catch(() => {
    // SquareCard retries and shows the error when it mounts.
  });
}

export type TokenizeFn = () => Promise<
  { ok: true; token: string } | { ok: false; message: string }
>;

/**
 * Square's hosted card field. Card numbers go straight to Square; we only
 * ever see a one-time token. Calls onReady with a tokenize function.
 *
 * Apple Pay / Google Pay buttons appear above the card when the form passes
 * `onWalletToken` and a positive `amountCents`, and only if the browser
 * supports them (anything else hides them quietly). An authorized wallet
 * payment calls `onWalletToken` with a one-time token that the server charges
 * exactly like a card token. `amountCents` is only what the wallet sheet
 * shows; the server re-prices and charges its own amount.
 *
 * Google Pay works in the sandbox in Chrome/Edge. Apple Pay only shows in
 * Safari, on a domain registered with Square (see docs/DEMO.md, "Wallets").
 */
export function SquareCard({
  onReady,
  amountCents,
  label = "Sabetha Golf Club",
  onWalletToken,
  disabled = false,
}: {
  onReady: (tokenize: TokenizeFn | null) => void;
  /** Total shown in the wallet sheet, in cents. Can change while mounted. */
  amountCents?: number;
  /** Line shown with the total in the wallet sheet. */
  label?: string;
  /** Called with a one-time token after Apple Pay / Google Pay is authorized. */
  onWalletToken?: (token: string) => void | Promise<void>;
  /** Ignore wallet taps (e.g. while the form is already paying). */
  disabled?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const googlePayEl = useRef<HTMLDivElement>(null);
  // "off": payments aren't configured, so retrying won't help.
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "off">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [payments, setPayments] = useState<SquarePayments | null>(null);

  // Wallet state. Callbacks and amount live in refs so a new inline function
  // or a price change never tears down the card or the wallet buttons.
  const request = useRef<SquarePaymentRequest | null>(null);
  const applePay = useRef<SquareApplePay | null>(null);
  const googlePay = useRef<SquareGooglePay | null>(null);
  const [wallets, setWallets] = useState({ apple: false, google: false });
  const [walletError, setWalletError] = useState<string | null>(null);
  const walletBusy = useRef(false);
  const onToken = useRef(onWalletToken);
  const total = useRef(walletTotal(amountCents ?? 0, label));
  const isDisabled = useRef(disabled);
  useEffect(() => {
    onToken.current = onWalletToken;
    isDisabled.current = disabled;
  });

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
    let card: SquareCard | null = null;
    let cancelled = false;

    (async () => {
      if (!appId || !locationId) {
        setError(
          "Card payments aren't set up on this site yet. Please pay in the clubhouse.",
        );
        setStatus("off");
        return;
      }
      try {
        await loadSdk();
        const p = window.Square!.payments(appId, locationId);
        card = await p.card();
        if (cancelled || !container.current) return;
        await card.attach(container.current);
        if (cancelled) return;
        setStatus("ready");
        setPayments(p);
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
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't load the secure card form. Check your internet connection, then try again.",
          );
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      onReady(null);
      void card?.destroy();
    };
  }, [onReady, attempt]);

  const walletsWanted =
    !!onWalletToken && walletTotal(amountCents ?? 0, label) !== null;

  // Set up Apple Pay / Google Pay once the card is ready. Unsupported
  // browsers throw here; that's normal, so the buttons just stay hidden.
  useEffect(() => {
    if (!payments || !walletsWanted || !total.current) return;
    let cancelled = false;
    const req = payments.paymentRequest({
      countryCode: "US",
      currencyCode: "USD",
      total: total.current,
    });
    request.current = req;

    (async () => {
      try {
        const apple = await payments.applePay(req);
        if (cancelled) return void apple.destroy();
        applePay.current = apple;
        setWallets((w) => ({ ...w, apple: true }));
      } catch {
        // Not Safari, or the domain isn't registered with Square.
      }
    })();
    (async () => {
      try {
        const google = await payments.googlePay(req);
        if (cancelled || !googlePayEl.current) return void google.destroy();
        await google.attach(googlePayEl.current, {
          buttonColor: "black",
          buttonSizeMode: "fill",
          buttonType: "long",
        });
        if (cancelled) return void google.destroy();
        googlePay.current = google;
        setWallets((w) => ({ ...w, google: true }));
      } catch {
        // Google Pay isn't available in this browser.
      }
    })();

    return () => {
      cancelled = true;
      request.current = null;
      void applePay.current?.destroy();
      void googlePay.current?.destroy();
      applePay.current = null;
      googlePay.current = null;
      setWallets({ apple: false, google: false });
    };
  }, [payments, walletsWanted]);

  // Keep the wallet sheet's total in step with the form (players, items).
  useEffect(() => {
    total.current = walletTotal(amountCents ?? 0, label);
    if (request.current && total.current) {
      request.current.update({ total: total.current });
    }
  }, [amountCents, label]);

  async function payWithWallet(wallet: SquareApplePay | null) {
    if (!wallet || walletBusy.current || isDisabled.current) return;
    walletBusy.current = true;
    setWalletError(null);
    try {
      const result = await wallet.tokenize();
      if (result.status === "OK" && result.token) {
        await onToken.current?.(result.token);
      } else if (result.status !== "Cancel") {
        setWalletError(
          "The wallet payment didn't go through. Try again, or pay with your card below.",
        );
      }
    } catch {
      setWalletError(
        "The wallet payment didn't go through. Try again, or pay with your card below.",
      );
    } finally {
      walletBusy.current = false;
    }
  }

  const anyWallet = wallets.apple || wallets.google;

  return (
    <div>
      {walletsWanted && (
        <div
          className={`space-y-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={disabled || undefined}
        >
          {wallets.apple && (
            <button
              type="button"
              aria-label="Pay with Apple Pay"
              className="apple-pay-button"
              onClick={() => payWithWallet(applePay.current)}
            />
          )}
          {/* Square draws the Google Pay button in here; empty until then. */}
          <div
            ref={googlePayEl}
            className={wallets.google ? "h-12" : ""}
            onClick={() => payWithWallet(googlePay.current)}
          />
          {walletError && (
            <p role="alert" className="text-sm text-red-700">
              {walletError}
            </p>
          )}
          {anyWallet && (
            <div className="flex items-center gap-3 pb-3 text-sm text-stone-500">
              <span className="h-px flex-1 bg-stone-300" />
              or pay with card
              <span className="h-px flex-1 bg-stone-300" />
            </div>
          )}
        </div>
      )}
      {/* Same height loading, failed or attached, so nothing jumps. */}
      <div className="relative min-h-24">
        <div ref={container} />
        {status === "loading" && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-500"
          >
            <span className="animate-pulse">Loading secure card form…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-red-300 bg-red-50 px-4 text-center text-sm">
            <p role="alert" className="text-red-800">
              {error}
            </p>
            {status === "error" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStatus("loading");
                  setAttempt((n) => n + 1);
                }}
                className="font-semibold text-green-800 underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
