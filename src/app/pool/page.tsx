import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PhotoGrid } from "@/components/PhotoGrid";
import { poolPhotos } from "@/content/photos";
import { poolFacilities, poolRules, poolSeason } from "@/content/pool";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/dates";
import { formatTime } from "@/lib/hours";
import { longDate, poolSeason as seasonOn } from "@/lib/seasons";

export const metadata: Metadata = {
  title: "Pool",
  description:
    "Sabetha Golf Club pool: season, hours, guest fee and rules. Open Memorial Day weekend through Labor Day.",
};

export default async function PoolPage() {
  const { pool, timeZone } = await getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Pool</h1>
      {/* The static page shows the general season; whether it's open today
          streams in per request. */}
      <Suspense fallback={<p className="mt-3">{poolSeason}</p>}>
        <SeasonNotice timeZone={timeZone} />
      </Suspense>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-stone-100 p-4">
          <dt className="text-sm text-stone-600">Season</dt>
          <dd className="font-semibold">Memorial Day weekend to Labor Day</dd>
        </div>
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

      <div className="mt-8">
        <PhotoGrid photos={poolPhotos} layout="tiles" />
      </div>

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

async function SeasonNotice({ timeZone }: { timeZone: string }) {
  await connection();
  const season = seasonOn(todayIn(timeZone));
  if (season.inSeason) return <p className="mt-3">{poolSeason}</p>;

  return (
    <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <span className="font-semibold">The pool is closed for the season.</span>{" "}
      It reopens Memorial Day weekend, {longDate(season.opens)}.
    </p>
  );
}
