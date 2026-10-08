import type { Metadata } from "next";
import Link from "next/link";
import {
  bylawsUrl,
  cartShed,
  duesSchedule,
  howToJoin,
  memberPerks,
  sampleTiers,
} from "@/content/memberships";
import { getPublicTiers } from "@/lib/memberships/public-tiers";
import { formatDollars } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Memberships",
  description:
    "How to join Sabetha Golf Club: membership types, dues schedule, new-member and under-30 rates, and Cart Shed rental.",
};

export default async function MembershipsPage() {
  const { club } = await getSettings();
  const dbTiers = await getPublicTiers();
  const tiers = dbTiers
    ? dbTiers.map((t) => ({
        name: t.name,
        note: t.notes,
        priceCents: t.price_cents,
        isSample: t.is_sample,
      }))
    : sampleTiers.map((t) => ({
        name: t.name,
        note: t.note,
        priceCents: 0,
        isSample: true,
      }));
  const anySample = tiers.some((t) => t.isSample);
  const allPriced = tiers.every((t) => t.priceCents > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Memberships</h1>
      <p className="mt-3">
        Sabetha Golf Club is a member club with golf, a pool and a clubhouse.
        Special rates are available for new members and members under 30.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/memberships/apply"
          className="inline-block rounded-lg bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900"
        >
          Apply online
        </Link>
        <Link
          href="/memberships/dues"
          className="inline-block rounded-lg border border-green-800 bg-white px-5 py-3 font-semibold text-green-800 hover:bg-green-50"
        >
          Pay dues
        </Link>
      </div>

      <section aria-labelledby="tiers-heading" className="mt-8">
        <h2 id="tiers-heading" className="text-xl font-bold">
          Membership types
        </h2>
        {anySample && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Types and dues marked Sample are placeholders until the club
            confirms its real tiers and prices.
          </p>
        )}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tiers.map((tier) => (
            <li
              key={tier.name}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{tier.name}</span>
                {tier.isSample && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    Sample
                  </span>
                )}
              </p>
              {tier.note && (
                <p className="mt-1 text-sm text-stone-600">{tier.note}</p>
              )}
              <p className="mt-2 text-sm font-medium">
                {tier.priceCents > 0
                  ? `${formatDollars(tier.priceCents)} a year`
                  : "Rate on request"}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <span className="font-medium">Cart Shed add-on: </span>
          {cartShed}
        </p>
      </section>

      <section aria-labelledby="join-heading" className="mt-10">
        <h2 id="join-heading" className="text-xl font-bold">
          How to join
        </h2>
        <p className="mt-3">
          <Link
            href="/memberships/apply"
            className="font-medium text-green-800 underline"
          >
            Apply online
          </Link>
          , or email or mail the Club Secretary with {howToJoin.details}.{" "}
          {allPriced ? howToJoin.reply : howToJoin.replyWithRates}
        </p>
        <dl className="mt-4 space-y-1">
          <div>
            <dt className="inline font-medium">Email: </dt>
            <dd className="inline break-words">
              <a
                href={`mailto:${club.email}`}
                className="break-all text-green-800 underline"
              >
                {club.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Mail: </dt>
            <dd className="inline">{club.mailingAddress}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="dues-heading" className="mt-10">
        <h2 id="dues-heading" className="text-xl font-bold">
          Dues
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {duesSchedule.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4">
          <Link
            href="/memberships/dues"
            className="font-medium text-green-800 underline"
          >
            Pay dues online
          </Link>{" "}
          in full or in two halves.
        </p>
      </section>

      <section aria-labelledby="perks-heading" className="mt-10">
        <h2 id="perks-heading" className="text-xl font-bold">
          Being a member
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {memberPerks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4">
          <a href={bylawsUrl} className="text-green-800 underline">
            Club By-Laws (PDF)
          </a>
        </p>
      </section>
    </div>
  );
}
