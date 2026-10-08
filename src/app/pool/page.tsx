import type { Metadata } from "next";
import Link from "next/link";
import { poolFacilities, poolRules, poolSeason } from "@/content/pool";
import { getSettings } from "@/content/settings";
import { formatTime } from "@/lib/hours";

export const metadata: Metadata = {
  title: "Pool",
  description:
    "Sabetha Golf Club pool: season, hours, guest fee and rules. Open Memorial Day weekend through Labor Day.",
};

export default function PoolPage() {
  const { pool } = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Pool</h1>
      <p className="mt-3">{poolSeason}</p>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-stone-100 p-4">
          <dt className="text-sm text-stone-600">Gates unlock</dt>
          <dd className="font-semibold">
            {formatTime(pool.gatesUnlock)} daily, in season
          </dd>
        </div>
        <div className="rounded-lg bg-stone-100 p-4">
          <dt className="text-sm text-stone-600">Guests</dt>
          <dd className="font-semibold">
            ${pool.guestFee} per swim, with a member
          </dd>
        </div>
      </dl>

      <section aria-labelledby="facilities-heading" className="mt-10">
        <h2 id="facilities-heading" className="text-xl font-bold">
          Facilities
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {poolFacilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pool-rules-heading" className="mt-10">
        <h2 id="pool-rules-heading" className="text-xl font-bold">
          Pool rules
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {poolRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <p className="mt-10">
        Pool access comes with membership.{" "}
        <Link href="/memberships" className="text-green-800 underline">
          See memberships
        </Link>
        .
      </p>
    </div>
  );
}
