"use client";

import { useActionState } from "react";
import { KITCHEN_STATUSES, kitchenLabels } from "@/lib/orders/kitchen";
import type { KitchenStatus } from "@/lib/orders/order";
import { saveKitchenDefault, type KitchenDefaultState } from "./actions";

export function KitchenDefaultForm({ value }: { value: KitchenStatus }) {
  const [state, action, pending] = useActionState<
    KitchenDefaultState,
    FormData
  >(saveKitchenDefault, {});

  return (
    <form action={action} className="space-y-3">
      <fieldset>
        <legend className="text-lg font-bold">Order to the Course</legend>
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
                defaultChecked={status === value}
                className="size-5 accent-green-800"
              />
              {kitchenLabels[status]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          {pending ? "Saving…" : "Save"}
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
