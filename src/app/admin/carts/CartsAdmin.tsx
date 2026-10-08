"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { updateCarts, type CartAdminState } from "./actions";

type Cart = { id: string; number: number; active: boolean; inUse: boolean };

export function CartsAdmin({ carts }: { carts: Cart[] }) {
  const [state, action, pending] = useActionState<CartAdminState, FormData>(
    updateCarts,
    {},
  );
  // Blocks a second submit (a double click on "Add a cart") before React
  // has re-rendered the buttons as disabled.
  const busy = useRef(false);
  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending]);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const data = new FormData(
      e.currentTarget,
      (e.nativeEvent as SubmitEvent).submitter,
    );
    startTransition(() => action(data));
  };
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
        {carts.map((cart) => {
          const locked = cart.active && cart.inUse;
          const reasonId = `cart-${cart.id}-reason`;
          return (
            <li
              key={cart.id}
              aria-label={`Cart ${cart.number}`}
              className={`rounded-lg border p-3 ${cart.active ? "border-stone-200 bg-white" : "border-dashed border-stone-300 bg-stone-50 text-stone-500"}`}
            >
              <div className="flex items-center justify-between gap-3">
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
                <form onSubmit={submit}>
                  <input type="hidden" name="id" value={cart.id} />
                  <button
                    type="submit"
                    name="intent"
                    value={cart.active ? "retire" : "restore"}
                    disabled={pending || locked}
                    aria-describedby={locked ? reasonId : undefined}
                    className="chip min-h-10 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cart.active
                      ? "Take out of service"
                      : "Put back in service"}
                  </button>
                </form>
              </div>
              {locked && (
                <p id={reasonId} className="mt-2 text-sm text-stone-600">
                  In use — mark it returned on the Clubhouse board first.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <form onSubmit={submit}>
        <button
          type="submit"
          name="intent"
          value="add"
          disabled={pending}
          className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          {pending ? "Saving…" : "Add a cart"}
        </button>
      </form>
    </div>
  );
}
