"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import {
  SquareCard,
  preloadSquare,
  type TokenizeFn,
} from "@/components/SquareCard";
import { formatPrice } from "@/content/menu";
import { readRememberedContact, rememberContact } from "@/lib/orders/contact";
import {
  MAX_QTY_PER_ITEM,
  orderSchema,
  type MenuRow,
  type OrderInput,
  type UnavailableItem,
} from "@/lib/orders/order";
import { CallClubhouse } from "./CallClubhouse";
import { DROPPED_MESSAGE } from "@/lib/rounds/checkout";
import { placeOrder } from "./actions";

type Props = {
  items: MenuRow[];
  initialHole: number | null;
  drinksOnly: boolean;
  /** Clubhouse phone, from settings. */
  clubPhone: string;
};

type Field = "hole" | "name" | "phone";
/** Page order, so the first invalid field is the one we jump to. */
const FIELDS: Field[] = ["hole", "name", "phone"];
const HOLES = Array.from({ length: 9 }, (_, i) => i + 1);

const subscribeNothing = () => () => {};
/** False in the server HTML and until React hydrates; true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

function HolePicker({
  hole,
  onPick,
  labelledBy,
  errorId,
  pickerRef,
}: {
  hole: number | null;
  onPick: (hole: number) => void;
  labelledBy: string;
  errorId?: string;
  pickerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={pickerRef}
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={errorId}
      tabIndex={-1}
      className="mt-3 grid scroll-mt-24 grid-cols-3 gap-2 outline-none"
    >
      {HOLES.map((h) => (
        <button
          key={h}
          type="button"
          aria-pressed={hole === h}
          onClick={() => onPick(h)}
          className={`chip justify-center text-xl font-bold ${hole === h ? "chip-on" : ""}`}
        >
          {h}
        </button>
      ))}
    </div>
  );
}

/** "Change", sized for a gloved thumb (44px+). */
function ChangeHoleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mr-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 font-semibold text-green-800 underline hover:bg-green-50"
    >
      Change<span className="sr-only"> hole</span>
    </button>
  );
}

export function OrderForm({
  items,
  initialHole,
  drinksOnly,
  clubPhone,
}: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [hole, setHole] = useState<number | null>(initialHole);
  const [pickingHole, setPickingHole] = useState(initialHole === null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutInView, setCheckoutInView] = useState(false);
  // Remembered from this device's last order (empty on the server, where
  // the checkout fields aren't rendered anyway).
  const [name, setName] = useState(() => readRememberedContact()?.name ?? "");
  const [phone, setPhone] = useState(
    () => readRememberedContact()?.phone ?? "",
  );
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [payError, setPayError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<UnavailableItem[]>([]);
  const [paying, setPaying] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const tokenize = useRef<TokenizeFn | null>(null);
  // The attempt in flight: kept until a definite answer, so a retry after a
  // dropped connection sends the same checkout ID, token and order.
  const attempt = useRef<{
    id: string;
    token: string;
    input: OrderInput;
  } | null>(null);
  // True while a payment may have gone through: the order is locked.
  const [retrying, setRetrying] = useState(false);
  const placed = useRef(false);
  const focusNext = useRef<Field | null>(null);
  const checkoutRef = useRef<HTMLElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Start loading Square now so the card form is ready by checkout.
  useEffect(() => preloadSquare(), []);

  // This page can be shown again with a different ?hole= (another cart
  // sticker) while keeping its state: follow the URL.
  const [urlHole, setUrlHole] = useState(initialHole);
  if (urlHole !== initialHole) {
    setUrlHole(initialHole);
    setHole(initialHole);
    setPickingHole(initialHole === null);
  }

  // Next.js keeps this page alive (hidden) after navigating away, and shows
  // it again on Back or the next visit to /order. Once an order is placed,
  // start the next one fresh instead of on a frozen "Placing order…" form,
  // and ask for the hole again: they've likely moved on since. A layout
  // effect cleanup runs as the page is hidden, so the golfer never sees the
  // form empty out while the status page loads.
  useLayoutEffect(
    () => () => {
      if (!placed.current) return;
      placed.current = false;
      attempt.current = null;
      setRetrying(false);
      setQty({});
      setCheckingOut(false);
      setPaying(false);
      setErrors({});
      setPayError(null);
      setUnavailable([]);
      setHole(null);
      setPickingHole(true);
    },
    [],
  );

  // Move to the first invalid field once it's on screen.
  useEffect(() => {
    const field = focusNext.current;
    if (!field) return;
    focusNext.current = null;
    const el = { hole: holeRef, name: nameRef, phone: phoneRef }[field].current;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [errors]);

  const onCardReady = useCallback((fn: TokenizeFn | null) => {
    tokenize.current = fn;
    setCardReady(!!fn);
  }, []);

  const byCategory = useMemo(() => {
    const groups = new Map<string, MenuRow[]>();
    for (const item of items) {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    }
    // Most orders on the course are drinks, so they go first.
    return [...groups].sort(
      ([a], [b]) => Number(b === "Drinks") - Number(a === "Drinks"),
    );
  }, [items]);

  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const count = lines.reduce((n, i) => n + qty[i.id], 0);
  const total = lines.reduce((sum, i) => sum + qty[i.id] * i.price_cents, 0);
  const hasAlcohol = lines.some((i) => i.is_alcohol);
  const showCheckout = checkingOut && count > 0;

  // Keep the bottom bar up whenever the checkout is off screen, e.g. after
  // scrolling back up to add another drink.
  useEffect(() => {
    const el = checkoutRef.current;
    if (!showCheckout || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCheckoutInView(entry.isIntersecting),
      { rootMargin: "0px 0px -96px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showCheckout]);

  const change = (id: string, delta: number) =>
    setQty((q) => ({
      ...q,
      [id]: Math.max(0, Math.min(MAX_QTY_PER_ITEM, (q[id] ?? 0) + delta)),
    }));

  const clearError = (field: Field) =>
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });

  const pickHole = (h: number) => {
    setHole(h);
    setPickingHole(false);
    clearError("hole");
  };

  /** After the next render: scroll to the checkout, or its hole picker. */
  const scrollToCheckout = (to: "top" | "hole" = "top") =>
    requestAnimationFrame(() => {
      const el = to === "hole" ? holeRef.current : checkoutRef.current;
      el?.scrollIntoView({
        behavior: "smooth",
        block: to === "hole" ? "center" : "start",
      });
      if (to === "hole") el?.focus({ preventScroll: true });
    });

  const orderInput = {
    hole: hole ?? 0,
    items: lines.map((i) => ({ id: i.id, qty: qty[i.id] })),
    name,
    phone,
  };
  // Wallet buttons only once the order would pass validation, so a wallet
  // payment can't skip it.
  const canPay = orderSchema.safeParse(orderInput).success;

  function removeUnavailable() {
    setQty((q) => {
      const next = { ...q };
      for (const { id } of unavailable) delete next[id];
      return next;
    });
    setUnavailable([]);
    setPayError(null);
  }

  /**
   * Validate, get a one-time token (card or wallet), then place the order.
   * While a payment may have gone through (`attempt` is set), Pay sends the
   * same checkout ID, token and order again instead, so it can't charge twice.
   */
  async function pay(walletToken?: string) {
    if (paying) return;
    let current = attempt.current;
    let input: OrderInput | null = current?.input ?? null;
    if (!current) {
      const parsed = orderSchema.safeParse(orderInput);
      if (!parsed.success) {
        const next: Partial<Record<Field, string>> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as Field;
          if (FIELDS.includes(field)) next[field] ??= issue.message;
        }
        if (next.hole) {
          next.hole = "Pick the hole you're on";
          setPickingHole(true);
        }
        focusNext.current = FIELDS.find((f) => next[f]) ?? null;
        setPayError(null);
        setErrors(next);
        return;
      }
      input = parsed.data;
    }
    setErrors({});
    setPaying(true);
    setPayError(null);
    setUnavailable([]);
    let navigating = false;
    try {
      if (!current) {
        let token = walletToken;
        if (!token) {
          if (!tokenize.current) return;
          const card = await tokenize.current();
          if (!card.ok) {
            setPayError(card.message);
            return;
          }
          token = card.token;
        }
        current = { id: crypto.randomUUID(), token, input: input! };
        attempt.current = current;
      }

      const result = await placeOrder(current.id, current.input, current.token);
      if (result.ok) {
        attempt.current = null;
        setRetrying(false);
        rememberContact(current.input);
        placed.current = true;
        navigating = true;
        // Replace, so Back doesn't return to a paid-for form.
        router.replace(`/order/status/${result.orderId}`);
        return;
      }
      if (result.retrySame) {
        setRetrying(true);
        setPayError(result.message);
        return;
      }
      // A definite answer: the next tap is a new attempt.
      attempt.current = null;
      setRetrying(false);
      setPayError(result.message);
      if (result.unavailable?.length) {
        setUnavailable(result.unavailable);
        router.refresh(); // Re-filter the menu to what's orderable now.
      } else if (result.closed) {
        router.refresh(); // Show why ordering stopped.
      } else if (FIELDS.includes(result.field as Field)) {
        focusNext.current = result.field as Field;
        setErrors({ [result.field as Field]: result.message });
      }
    } catch {
      // Weak signal: the request (or Square's card form) lost the
      // connection. If the attempt reached the server it may have charged,
      // so keep it as is for the next tap.
      setRetrying(!!attempt.current);
      setPayError(DROPPED_MESSAGE);
    } finally {
      if (!navigating) setPaying(false);
    }
  }

  const onPay = () => void pay();

  const openCheckout = () => {
    setCheckingOut(true);
    if (!hole) setPickingHole(true);
    scrollToCheckout();
  };

  const fieldProps = (field: Field) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  /** Reopen the hole picker; during checkout it's the one in the checkout. */
  const changeHole = () => {
    setPickingHole(true);
    if (showCheckout) scrollToCheckout("hole");
  };

  return (
    <div className="space-y-6 pb-28">
      <section aria-labelledby="hole-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="hole-heading" className="text-lg font-bold">
            {hole && !pickingHole
              ? `Delivering to hole ${hole}`
              : "Which hole are you on?"}
          </h2>
          {hole && !pickingHole && !retrying && (
            <ChangeHoleButton onClick={changeHole} />
          )}
        </div>
        {pickingHole &&
          (showCheckout ? (
            <p className="mt-1 text-sm text-stone-600">
              Pick it in your order below.
            </p>
          ) : (
            <HolePicker
              hole={hole}
              onPick={pickHole}
              labelledBy="hole-heading"
            />
          ))}
        {hole && !pickingHole && (
          <p className="mt-1 text-sm text-stone-600">
            Keep playing. We&apos;ll bring it to you on or near this hole.
          </p>
        )}
      </section>

      {drinksOnly && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
          <p>The kitchen is closed right now. Drinks only.</p>
          <p className="text-sm">
            Questions? <CallClubhouse phone={clubPhone} />
          </p>
        </div>
      )}

      {!hydrated && (
        <p role="status" className="animate-pulse text-sm text-stone-500">
          Loading… the + buttons work in a moment.
        </p>
      )}

      {byCategory.map(([category, rows]) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <h2
            id={`cat-${category}`}
            className="border-b-2 border-green-800 pb-1 text-lg font-bold"
          >
            {category}
          </h2>
          <ul className="mt-2 divide-y divide-stone-200">
            {rows.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.name}
                    {item.is_alcohol && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        21+
                      </span>
                    )}
                    {item.is_sample && (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                        Sample
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-stone-600">
                    {formatPrice(item.price_cents)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(qty[item.id] ?? 0) > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => change(item.id, -1)}
                        disabled={retrying}
                        aria-label={`One less ${item.name}`}
                        className="chip size-11 justify-center px-0 text-xl"
                      >
                        −
                      </button>
                      <span
                        className="w-6 text-center font-bold tabular-nums"
                        aria-live="polite"
                      >
                        {qty[item.id]}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => change(item.id, 1)}
                    // Disabled until hydrated, so an early tap on a slow
                    // connection looks inert instead of being silently lost.
                    // Locked while a payment may have gone through.
                    disabled={
                      !hydrated ||
                      retrying ||
                      (qty[item.id] ?? 0) >= MAX_QTY_PER_ITEM
                    }
                    aria-label={`Add ${item.name}`}
                    className="chip size-11 justify-center px-0 text-xl"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {showCheckout && (
        <section
          ref={checkoutRef}
          aria-labelledby="checkout-heading"
          className="scroll-mt-24 space-y-4 rounded-xl border border-stone-200 bg-white p-4"
        >
          <h2 id="checkout-heading" className="text-lg font-bold">
            Your order
          </h2>
          <div>
            {hole && !pickingHole ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg">
                    Deliver to <strong>hole {hole}</strong>
                  </p>
                  {!retrying && <ChangeHoleButton onClick={changeHole} />}
                </div>
                <p className="text-sm text-stone-600">
                  Keep playing. We&apos;ll bring it to you on or near this hole.
                </p>
              </>
            ) : (
              <>
                <p id="checkout-hole-heading" className="font-medium">
                  Which hole are you on?
                </p>
                <HolePicker
                  hole={hole}
                  onPick={pickHole}
                  labelledBy="checkout-hole-heading"
                  errorId={errors.hole ? "hole-error" : undefined}
                  pickerRef={holeRef}
                />
              </>
            )}
            {errors.hole && (
              <p id="hole-error" className="mt-1 text-sm text-red-700">
                {errors.hole}
              </p>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            {lines.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>
                  {qty[i.id]}× {i.name}
                </span>
                <span>{formatPrice(qty[i.id] * i.price_cents)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </li>
          </ul>
          {hasAlcohol && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              21+. We&apos;ll check ID when we deliver.
            </p>
          )}
          <label className="block">
            <span className="mb-1 block font-medium">Name</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              autoComplete="name"
              disabled={retrying}
              className="input scroll-mt-24"
              {...fieldProps("name")}
            />
            {errors.name && (
              <span id="name-error" className="mt-1 block text-sm text-red-700">
                {errors.name}
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Phone</span>
            <input
              ref={phoneRef}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearError("phone");
              }}
              autoComplete="tel"
              disabled={retrying}
              className="input scroll-mt-24"
              {...fieldProps("phone")}
            />
            {errors.phone && (
              <span
                id="phone-error"
                className="mt-1 block text-sm text-red-700"
              >
                {errors.phone}
              </span>
            )}
          </label>
          <SquareCard
            onReady={onCardReady}
            amountCents={total}
            label="Order to the Course"
            onWalletToken={canPay ? (token) => pay(token) : undefined}
            disabled={paying || retrying}
          />
          {payError && (
            <div
              role="alert"
              className="space-y-2 rounded-lg bg-red-50 px-4 py-3 text-red-800"
            >
              <p>{payError}</p>
              {retrying && (
                <p className="text-sm">
                  Your order is locked until this payment finishes.
                </p>
              )}
              {unavailable.length > 0 && (
                <button
                  type="button"
                  onClick={removeUnavailable}
                  className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold text-red-900"
                >
                  Remove unavailable items
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onPay}
            // A retry reuses the stored token, so it doesn't need the card form.
            disabled={(!cardReady && !retrying) || paying}
            className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
          >
            {paying ? "Placing order…" : `Pay ${formatPrice(total)}`}
          </button>
          <p className="text-center text-sm text-stone-500">
            Test mode: use card 4111 1111 1111 1111, any future date, CVV 111.
          </p>
        </section>
      )}

      {count > 0 && !(showCheckout && checkoutInView) && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="button"
            onClick={showCheckout ? () => scrollToCheckout() : openCheckout}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900"
          >
            <span>
              {showCheckout ? "Go to checkout" : "Checkout"} · {count} item
              {count === 1 ? "" : "s"}
            </span>
            <span>{formatPrice(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
