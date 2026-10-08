"use client";

import { useEffect, useState } from "react";
import { ORDER_STEPS, type OrderStatus } from "@/lib/orders/order";
import { getOrderStatus } from "../../actions";

const DONE: OrderStatus[] = ["delivered", "cancelled"];

/** Live order progress. Polls every 5 seconds until delivered. */
export function StatusTracker({
  orderId,
  initial,
}: {
  orderId: string;
  initial: OrderStatus;
}) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    if (DONE.includes(status)) return;
    let stopped = false;
    const tick = async () => {
      const next = await getOrderStatus(orderId).catch(() => null);
      if (!stopped && next) setStatus(next.status);
    };
    const id = setInterval(tick, 5_000);
    const onVisible = () =>
      document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, status]);

  if (status === "cancelled") {
    return (
      <p role="status" className="rounded-lg bg-stone-100 px-4 py-3">
        This order was cancelled. You weren&apos;t charged, or the clubhouse
        will refund you.
      </p>
    );
  }
  if (status === "pending") {
    return (
      <p role="status" className="rounded-lg bg-stone-100 px-4 py-3">
        Confirming your payment…
      </p>
    );
  }

  const current = ORDER_STEPS.findIndex((s) => s.status === status);
  return (
    <ol aria-label="Order progress" className="space-y-3">
      {ORDER_STEPS.map((step, i) => {
        const state =
          i < current || status === "delivered"
            ? "done"
            : i === current
              ? "now"
              : "todo";
        return (
          <li
            key={step.status}
            className="flex items-center gap-3"
            aria-current={state === "now" ? "step" : undefined}
          >
            <span
              aria-hidden="true"
              className={`grid size-9 shrink-0 place-items-center rounded-full border-2 font-bold ${
                state === "todo"
                  ? "border-stone-300 text-stone-400"
                  : "border-green-800 bg-green-800 text-white"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={
                state === "todo" ? "text-stone-500" : "text-lg font-semibold"
              }
            >
              {step.label}
              {state === "now" && step.status !== "delivered" && (
                <span className="ml-2 inline-block size-2 animate-pulse rounded-full bg-green-600 align-middle" />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
