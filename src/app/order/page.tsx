import type { Metadata } from "next";
import { Suspense } from "react";
import { HoursList } from "@/components/HoursList";
import { getSettings } from "@/lib/settings";
import { nextOpening } from "@/lib/hours";
import { getOrderingState } from "@/lib/orders/state";
import { CallClubhouse } from "./CallClubhouse";
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
  const [state, settings] = await Promise.all([
    getOrderingState(),
    getSettings(),
  ]);
  const phone = settings.club.phone;

  if (state.closedBecause === "hours") {
    const opening = nextOpening(settings, new Date());
    return (
      <div className="space-y-4">
        <div role="status" className="rounded-lg bg-stone-100 px-4 py-3">
          <p className="font-medium">{state.closedReason}</p>
          {opening && (
            <p className="mt-1 text-lg font-bold">Ordering opens {opening}.</p>
          )}
        </div>
        <p className="text-stone-700">
          Questions? <CallClubhouse phone={phone} />
        </p>
        <section aria-labelledby="order-hours-heading">
          <h2 id="order-hours-heading" className="font-bold">
            Clubhouse hours
          </h2>
          <div className="mt-2">
            <HoursList clubhouseHours={settings.clubhouseHours} />
          </div>
        </section>
      </div>
    );
  }

  if (!state.accepting) {
    // The clubhouse is open; staff have switched ordering off for now.
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-lg bg-stone-100 px-4 py-3 font-medium"
        >
          {state.closedReason}
        </p>
        <p className="text-stone-700">
          Food and drinks are still at the clubhouse. Need something brought
          out? <CallClubhouse phone={phone} />
        </p>
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
        clubPhone={phone}
      />
    </>
  );
}
