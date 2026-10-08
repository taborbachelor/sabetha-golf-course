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
import { getSettings } from "@/content/settings";

export const metadata: Metadata = {
  title: "Memberships",
  description:
    "How to join Sabetha Golf Club: membership types, dues schedule, new-member and under-30 rates, and Cart Shed rental.",
};

export default function MembershipsPage() {
  const { club } = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Memberships</h1>
      <p className="mt-3">
        Sabetha Golf Club is a member club with golf, a pool and a clubhouse.
        Special rates are available for new members and members under 30.
      </p>

      <section aria-labelledby="tiers-heading" className="mt-8">
        <h2 id="tiers-heading" className="text-xl font-bold">
          Membership types
        </h2>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sample only. These types are placeholders until the club confirms its
          real tiers and prices. Ask the Club Secretary for current rates.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {sampleTiers.map((tier) => (
            <li
              key={tier.name}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <p className="flex items-center justify-between gap-2">
                <span className="font-semibold">{tier.name}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  Sample
                </span>
              </p>
              <p className="mt-1 text-sm text-stone-600">{tier.note}</p>
              <p className="mt-2 text-sm font-medium">Rate on request</p>
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
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          {howToJoin.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <dl className="mt-4 space-y-1">
          <div>
            <dt className="inline font-medium">Email: </dt>
            <dd className="inline">
              <a
                href={`mailto:${club.email}`}
                className="text-green-800 underline"
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
        <p className="mt-4">
          <Link
            href="/memberships/apply"
            className="inline-block rounded-lg bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900"
          >
            Apply online (coming soon)
          </Link>
        </p>
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
