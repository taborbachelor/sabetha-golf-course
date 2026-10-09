"use client";

import { useEffect, useState } from "react";
import { ORDER_STEPS, type OrderStatus } from "@/lib/orders/order";
import { getOrderStatus } from "../../actions";
import { CallClubhouse } from "../../CallClubhouse";

const DONE: OrderStatus[] = ["delivered", "cancelled"];

/** After this many failed polls in a row, say we're having trouble. */
const FAILS_BEFORE_WARNING = 2;

/** Live order progress. Polls every 5 seconds until delivered. */
export function StatusTracker({
  orderId,
  initial,
  phone,
}: {
  orderId: string;
  initial: OrderStatus;
  /** Clubhouse phone, from settings. */
  phone: string;
}) {
  const [status, setStatus] = useState(initial);
  const [failedPolls, setFailedPolls] = useState(0);
  const offline = failedPolls >= FAILS_BEFORE_WARNING;

  useEffect(() => {
    if (DONE.includes(status)) return;
    let stopped = false;
    const tick = async () => {
      const next = await getOrderStatus(orderId).catch(() => null);
      if (stopped) return;
      if (next) {
        setStatus(next.status);
        setFailedPolls(0);
      } else {
        setFailedPolls((n) => n + 1);
      }
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
      <div role="status" className="rounded-lg bg-stone-100 px-4 py-3">
        <p className="font-medium">This order was cancelled.</p>
        <p>
          If you were charged, the clubhouse will refund you. Questions?{" "}
          <CallClubhouse phone={phone} />
        </p>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-lg bg-stone-100 px-4 py-3">
          Confirming your payment…
        </p>
        {offline && <OfflineNote />}
      </div>
    );
  }

  const current = ORDER_STEPS.findIndex((s) => s.status === status);
  const steps = (
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
              {state === "now" &&
                step.status !== "delivered" &&
                (offline ? (
                  <span className="ml-2 text-sm font-normal text-stone-500">
                    Checking…
                  </span>
                ) : (
                  <span className="ml-2 inline-block size-2 animate-pulse rounded-full bg-green-600 align-middle" />
                ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
  return (
    <div className="space-y-3">
      {steps}
      {offline && <OfflineNote />}
    </div>
  );
}

/** Shown when polls keep failing, so a dead connection isn't hidden. */
function OfflineNote() {
  return (
    <p
      role="status"
      className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900"
    >
      Checking… we can&apos;t reach the clubhouse right now. This page will
      catch up when your signal does.
    </p>
  );
}
