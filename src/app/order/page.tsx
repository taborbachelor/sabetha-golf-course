import type { Metadata } from "next";
import { Suspense } from "react";
import { HoursList } from "@/components/HoursList";
import { getSettings } from "@/content/settings";
import { getOrderingState } from "@/lib/orders/state";
import { OrderForm } from "./OrderForm";

export const metadata: Metadata = {
  title: "Order to the Course",
  description:
    "Order food and drinks from the Sabetha Golf Club clubhouse and have them brought out to your hole.",
};

export default function OrderPage({ searchParams }: PageProps<"/order">) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-3xl font-bold">Order to the Course</h1>
      <p className="mt-2 text-stone-600">
        Food and drinks from the clubhouse, brought out to your hole.
      </p>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Demo: payments run in test mode. No real cards are charged.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={<p className="text-stone-600">Loading the menu…</p>}
        >
          {searchParams.then(({ hole }) => (
            <OrderLoader hole={parseHole(hole)} />
          ))}
        </Suspense>
      </div>
    </div>
  );
}

function parseHole(value: string | string[] | undefined): number | null {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n : null;
}

async function OrderLoader({ hole }: { hole: number | null }) {
  const state = await getOrderingState();

  if (!state.accepting) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-lg bg-stone-100 px-4 py-3 font-medium"
        >
          {state.closedReason}
        </p>
        <section aria-labelledby="order-hours-heading">
          <h2 id="order-hours-heading" className="font-bold">
            Clubhouse hours
          </h2>
          <div className="mt-2">
            <HoursList clubhouseHours={getSettings().clubhouseHours} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {state.ignoreHoursForDemo && !state.clubhouseOpen && (
        <p className="mb-4 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Demo mode: taking orders outside clubhouse hours.
        </p>
      )}
      <OrderForm
        items={state.orderable}
        initialHole={hole}
        drinksOnly={state.kitchen === "drinks_only"}
      />
    </>
  );
}
