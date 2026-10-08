"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { DeliveryMinutes } from "@/content/settings";
import { KITCHEN_STATUSES, kitchenLabels } from "@/lib/orders/kitchen";
import type { KitchenStatus } from "@/lib/orders/order";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { saveOrdering, type OrderingState } from "./actions";
import { focusField } from "./focusField";

/** Order to the Course: how ordering starts each day, and delivery time. */
export function OrderingForm({
  kitchenDefault,
  delivery,
  isSample,
}: {
  kitchenDefault: KitchenStatus;
  delivery: DeliveryMinutes;
  isSample: boolean;
}) {
  const [state, action, pending] = useActionState<OrderingState, FormData>(
    saveOrdering,
    {},
  );
  const { onChange } = useUnsavedChanges(state);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.field && form.current) focusField(form.current, state.field);
  }, [state]);

  return (
    <form
      ref={form}
      onChange={onChange}
      // Submitted by hand so a failed save keeps the edits on screen.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      aria-labelledby="ordering-heading"
      className="space-y-5"
    >
      <h2 id="ordering-heading" className="text-xl font-bold">
        Order to the Course
      </h2>
      <fieldset>
        <legend className="text-lg font-bold">How ordering starts</legend>
        <p className="mb-2 text-sm text-stone-600">
          How ordering starts each day. Staff can change it on the Clubhouse
          board during the day; it goes back to this the next morning.
        </p>
        <div className="flex flex-wrap gap-2">
          {KITCHEN_STATUSES.map((status) => (
            <label
              key={status}
              className="chip cursor-pointer gap-2 has-checked:border-green-800 has-checked:bg-green-50"
            >
              <input
                type="radio"
                name="kitchenDefault"
                value={status}
                defaultChecked={status === kitchenDefault}
                className="size-5 accent-green-800"
              />
              {kitchenLabels[status]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-lg font-bold">
          Typical delivery time
          {isSample && (
            <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 align-middle text-xs font-normal text-stone-600">
              Sample
            </span>
          )}
        </legend>
        <p className="mb-2 text-sm text-stone-600">
          What golfers are told to expect after ordering.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="delivery_minutes.min"
            aria-label="Shortest delivery time (minutes)"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            step={1}
            defaultValue={delivery.min}
            className="input w-24"
          />
          <span>to</span>
          <input
            name="delivery_minutes.max"
            aria-label="Longest delivery time (minutes)"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            step={1}
            defaultValue={delivery.max}
            className="input w-24"
          />
          <span>minutes</span>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          {pending ? "Saving…" : "Save ordering default"}
        </button>
        {state.message && (
          <p
            role={state.ok ? "status" : "alert"}
            className={`text-sm ${state.ok ? "text-green-800" : "text-red-700"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
