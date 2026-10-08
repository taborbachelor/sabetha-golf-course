import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { PayForm } from "./PayForm";

export const metadata: Metadata = {
  title: "Pay to Play",
  description:
    "Pay your green fees and reserve a cart ahead of time at Sabetha Golf Club, then just show up and play.",
};

export default async function PayPage() {
  const { greenFees, cartRental, timeZone, bookAheadDays } =
    await getSettings();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-3xl font-bold">Pay to Play</h1>
      <p className="mt-2 text-stone-600">
        Pay ahead, then just show up. No need to stop at the clubhouse or the
        box at hole #1.
      </p>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Demo: payments run in test mode. No real cards are charged.
      </p>
      <div className="mt-6">
        <PayForm
          greenFees={greenFees}
          cartRental={cartRental}
          timeZone={timeZone}
          bookAheadDays={bookAheadDays}
        />
      </div>
    </div>
  );
}
