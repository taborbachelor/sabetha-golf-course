import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Gift Cards",
  description: "Buy a Sabetha Golf Club e-gift card online through Square.",
};

export default async function GiftCardsPage() {
  const { club } = await getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Gift Cards</h1>
      <p className="mt-3">
        You can buy Sabetha Golf Club e-gift cards online through Square.
      </p>
      <p className="mt-6">
        <a
          href={club.giftCardUrl}
          className="inline-block rounded-lg bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900"
        >
          Buy an e-gift card
        </a>
      </p>
      <p className="mt-3 text-sm text-stone-600">
        Opens Square&apos;s secure checkout. Questions? Email{" "}
        <a href={`mailto:${club.email}`} className="break-all underline">
          {club.email}
        </a>
        .
      </p>
    </div>
  );
}
