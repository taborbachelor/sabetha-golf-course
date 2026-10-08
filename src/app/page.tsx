import Image from "next/image";
import Link from "next/link";
import { heroPhoto } from "@/content/photos";
import { HoursList } from "@/components/HoursList";
import { RatesTable } from "@/components/RatesTable";
import { getSettings } from "@/content/settings";

const ctas = [
  {
    href: "/pay",
    label: "Pay to Play",
    note: "Pay green fees ahead and just show up",
  },
  {
    href: "/order",
    label: "Order to the Course",
    note: "Food and drinks brought out to your hole",
  },
  {
    href: "/memberships",
    label: "Become a Member",
    note: "Dues, rates and how to join",
  },
];

export default function Home() {
  const { club, course, clubhouseHours, greenFees, cartRental } = getSettings();

  return (
    <>
      <section className="relative isolate overflow-hidden bg-green-900 text-white">
        <Image
          src={heroPhoto.src}
          alt={heroPhoto.alt}
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-green-950/60 sm:bg-transparent sm:bg-gradient-to-r sm:from-green-950/85 sm:via-green-950/50 sm:to-green-950/10"
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-14">
          <p className="text-sm tracking-wide text-green-200 uppercase">
            {club.city}, {club.state} · Est. {course.established}
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-5xl">{club.name}</h1>
          <p className="mt-2 max-w-xl text-green-50">
            A {course.holes}-hole, {course.yards.toLocaleString("en-US")}-yard
            course built in {course.built}. {club.locationNote}.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {ctas.map((cta) => (
              <li key={cta.href}>
                <Link
                  href={cta.href}
                  className="block rounded-xl bg-white px-5 py-4 text-green-900 shadow-sm transition hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="block text-lg font-bold">{cta.label}</span>
                  <span className="block text-sm text-stone-600">
                    {cta.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <section aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="text-xl font-bold">
            Clubhouse hours
          </h2>
          <div className="mt-3">
            <HoursList clubhouseHours={clubhouseHours} />
          </div>
          <p className="mt-3 text-sm text-stone-600">
            Kitchen may close for events; the bar stays open to members.
          </p>
        </section>

        <section aria-labelledby="rates-heading">
          <h2 id="rates-heading" className="text-xl font-bold">
            Rates
          </h2>
          <div className="mt-3">
            <RatesTable greenFees={greenFees} cartRental={cartRental} />
          </div>
          <p className="mt-3 text-sm">
            <Link href="/golf" className="font-medium text-green-800 underline">
              Course details and rules
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
