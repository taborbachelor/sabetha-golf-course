import type { Metadata } from "next";
import Link from "next/link";
import { PhotoGrid } from "@/components/PhotoGrid";
import { RatesTable } from "@/components/RatesTable";
import { clubHistory, courseDescription, golfRules } from "@/content/golf";
import { courseGallery } from "@/content/photos";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Golf",
  description:
    "Course details, green fees, cart rental and rules at Sabetha Golf Club, a 9-hole course in Sabetha, Kansas.",
};

export default async function GolfPage() {
  const { course, greenFees, cartRental } = await getSettings();

  const facts = [
    { label: "Holes", value: `${course.holes} (play twice for 18)` },
    { label: "Length", value: `${course.yards.toLocaleString("en-US")} yards` },
    { label: "Tees", value: course.tees.join(" and ") },
    { label: "Built", value: String(course.built) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Golf</h1>

      <section aria-labelledby="course-heading" className="mt-6">
        <h2 id="course-heading" className="sr-only">
          The course
        </h2>
        {courseDescription.map((p) => (
          <p key={p} className="mt-3 first:mt-0">
            {p}
          </p>
        ))}
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-lg bg-stone-100 p-3">
              <dt className="text-sm text-stone-600">{f.label}</dt>
              <dd className="font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="fees-heading" className="mt-10">
        <h2 id="fees-heading" className="text-xl font-bold">
          Green fees and carts
        </h2>
        <p className="mt-2 text-stone-600">
          Guests don&apos;t need a member to play.
        </p>
        <div className="mt-3">
          <RatesTable greenFees={greenFees} cartRental={cartRental} />
        </div>
        <div className="mt-4 rounded-lg border border-green-800/20 bg-green-50 p-4">
          <p className="font-medium">Where to pay</p>
          <p className="mt-2">
            <Link
              href="/pay"
              className="inline-block rounded-lg bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900"
            >
              Pay to Play
            </Link>
          </p>
          <p className="mt-3">
            Pay online before you go, or pay at the clubhouse when it&apos;s
            open. When it&apos;s closed, register and pay at the box at hole #1.
          </p>
        </div>
      </section>

      <section aria-labelledby="rules-heading" className="mt-10">
        <h2 id="rules-heading" className="text-xl font-bold">
          Course rules
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {golfRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gallery-heading" className="mt-10">
        <h2 id="gallery-heading" className="text-xl font-bold">
          Around the course
        </h2>
        <div className="mt-3">
          <PhotoGrid photos={courseGallery} />
        </div>
      </section>

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-xl font-bold">
          History
        </h2>
        {clubHistory.map((p) => (
          <p key={p} className="mt-3">
            {p}
          </p>
        ))}
      </section>
    </div>
  );
}
