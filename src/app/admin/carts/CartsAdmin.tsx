"use client";

import { useActionState } from "react";
import { updateCarts, type CartAdminState } from "./actions";

type Cart = { id: string; number: number; active: boolean; inUse: boolean };

export function CartsAdmin({ carts }: { carts: Cart[] }) {
  const [state, action, pending] = useActionState<CartAdminState, FormData>(
    updateCarts,
    {},
  );
  const inService = carts.filter((c) => c.active).length;

  return (
    <div className="space-y-4">
      <p className="text-lg">
        <span className="font-bold">{inService}</span> cart
        {inService === 1 ? "" : "s"} in service
      </p>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-lg px-4 py-3 ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {carts.map((cart) => (
          <li
            key={cart.id}
            className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${cart.active ? "border-stone-200 bg-white" : "border-dashed border-stone-300 bg-stone-50 text-stone-500"}`}
          >
            <span>
              <span className="text-lg font-bold">Cart {cart.number}</span>
              <span className="ml-2 text-sm">
                {!cart.active
                  ? "Out of service"
                  : cart.inUse
                    ? "In use"
                    : "In service"}
              </span>
            </span>
            <form action={action}>
              <input type="hidden" name="id" value={cart.id} />
              <button
                type="submit"
                name="intent"
                value={cart.active ? "retire" : "restore"}
                disabled={pending}
                className="chip min-h-10 text-sm"
              >
                {cart.active ? "Take out of service" : "Put back in service"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action}>
        <button
          type="submit"
          name="intent"
          value="add"
          disabled={pending}
          className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          Add a cart
        </button>
      </form>
    </div>
  );
}
