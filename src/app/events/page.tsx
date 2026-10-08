import type { Metadata } from "next";
import { tournamentYear, tournaments } from "@/content/events";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Events and Tournaments",
  description: `Sabetha Golf Club ${tournamentYear} tournament schedule: scrambles, the Sabetha 2 Day Open, Club Championship and more.`,
};

export default async function EventsPage() {
  const { club } = await getSettings();
  const months = [...new Set(tournaments.map((t) => t.month))];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Events and Tournaments</h1>
      <p className="mt-3">
        The {tournamentYear} tournament schedule. For new events and updates,
        follow the club on{" "}
        <a href={club.facebookUrl} className="text-green-800 underline">
          Facebook
        </a>{" "}
        or sign up for{" "}
        <a href={club.textCasterUrl} className="text-green-800 underline">
          TextCaster text alerts
        </a>
        .
      </p>

      {months.map((month) => (
        <section
          key={month}
          aria-labelledby={`month-${month}`}
          className="mt-8"
        >
          <h2
            id={`month-${month}`}
            className="border-b-2 border-green-800 pb-1 text-xl font-bold"
          >
            {month} {tournamentYear}
          </h2>
          <ul className="mt-3 divide-y divide-stone-200">
            {tournaments
              .filter((t) => t.month === month)
              .map((t) => (
                <li
                  key={`${t.date}-${t.name}`}
                  className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]"
                >
                  <p className="font-semibold">
                    {t.date}
                    {t.time && (
                      <span className="font-normal text-stone-600">
                        {" "}
                        · {t.time}
                      </span>
                    )}
                  </p>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    {(t.format || t.fee) && (
                      <p className="text-sm text-stone-600">
                        {[t.format, t.fee].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {t.note && <p className="mt-1 text-sm">{t.note}</p>}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
