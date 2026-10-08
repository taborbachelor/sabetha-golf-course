"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { SquareCard, type TokenizeFn } from "@/components/SquareCard";
import { formatPrice } from "@/content/menu";
import {
  MAX_QTY_PER_ITEM,
  orderSchema,
  type MenuRow,
} from "@/lib/orders/order";
import { placeOrder } from "./actions";

type Props = {
  items: MenuRow[];
  initialHole: number | null;
  drinksOnly: boolean;
};

export function OrderForm({ items, initialHole, drinksOnly }: Props) {
  const router = useRouter();
  const [hole, setHole] = useState<number | null>(initialHole);
  const [pickingHole, setPickingHole] = useState(initialHole === null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const checkoutRef = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const tokenize = useRef<TokenizeFn | null>(null);
  const checkoutId = useRef<string | null>(null);

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

  const change = (id: string, delta: number) =>
    setQty((q) => ({
      ...q,
      [id]: Math.max(0, Math.min(MAX_QTY_PER_ITEM, (q[id] ?? 0) + delta)),
    }));

  const orderInput = {
    hole: hole ?? 0,
    items: lines.map((i) => ({ id: i.id, qty: qty[i.id] })),
    name,
    phone,
  };

  async function onPay() {
    const parsed = orderSchema.safeParse(orderInput);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      if (next.hole) setPickingHole(true);
      return;
    }
    setErrors({});
    if (!tokenize.current || paying) return;
    setPaying(true);
    setPayError(null);
    const card = await tokenize.current();
    if (!card.ok) {
      setPayError(card.message);
      setPaying(false);
      return;
    }
    checkoutId.current ??= crypto.randomUUID();
    const result = await placeOrder(
      checkoutId.current,
      parsed.data,
      card.token,
    );
    if (result.ok) {
      router.push(`/order/status/${result.orderId}`);
      return;
    }
    checkoutId.current = null;
    if (result.field) setErrors({ [result.field]: result.message });
    setPayError(result.message);
    setPaying(false);
  }

  return (
    <div className="space-y-6 pb-28">
      <section aria-labelledby="hole-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="hole-heading" className="text-lg font-bold">
            {hole && !pickingHole
              ? `Delivering to hole ${hole}`
              : "Which hole are you on?"}
          </h2>
          {hole && !pickingHole && (
            <button
              type="button"
              onClick={() => setPickingHole(true)}
              className="text-sm font-medium text-green-800 underline"
            >
              Change
            </button>
          )}
        </div>
        {pickingHole && (
          <div
            role="group"
            aria-labelledby="hole-heading"
            className="mt-3 grid grid-cols-3 gap-2"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={hole === h}
                onClick={() => {
                  setHole(h);
                  setPickingHole(false);
                }}
                className={`chip justify-center text-xl font-bold ${hole === h ? "chip-on" : ""}`}
              >
                {h}
              </button>
            ))}
          </div>
        )}
        {errors.hole && (
          <p className="mt-1 text-sm text-red-700">Pick your hole</p>
        )}
        <p className="mt-2 text-sm text-stone-600">
          Keep playing. We&apos;ll bring it to you on or near this hole.
        </p>
      </section>

      {drinksOnly && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
          The kitchen is closed right now. Drinks only.
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
                    disabled={(qty[item.id] ?? 0) >= MAX_QTY_PER_ITEM}
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

      {checkingOut && count > 0 && (
        <section
          ref={checkoutRef}
          aria-labelledby="checkout-heading"
          className="space-y-4 rounded-xl border border-stone-200 bg-white p-4"
        >
          <h2 id="checkout-heading" className="text-lg font-bold">
            Your order
          </h2>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="input"
            />
            {errors.name && (
              <span className="mt-1 block text-sm text-red-700">
                {errors.name}
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Phone</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="input"
            />
            {errors.phone && (
              <span className="mt-1 block text-sm text-red-700">
                {errors.phone}
              </span>
            )}
          </label>
          <SquareCard onReady={onCardReady} />
          {payError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-red-800"
            >
              {payError}
            </p>
          )}
          <button
            type="button"
            onClick={onPay}
            disabled={!cardReady || paying}
            className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
          >
            {paying ? "Placing order…" : `Pay ${formatPrice(total)}`}
          </button>
          <p className="text-center text-sm text-stone-500">
            Test mode: use card 4111 1111 1111 1111, any future date, CVV 111.
          </p>
        </section>
      )}

      {count > 0 && !checkingOut && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setCheckingOut(true);
              requestAnimationFrame(() =>
                checkoutRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                }),
              );
              if (!hole) setPickingHole(true);
            }}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900"
          >
            <span>
              Checkout · {count} item{count === 1 ? "" : "s"}
            </span>
            <span>{formatPrice(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
