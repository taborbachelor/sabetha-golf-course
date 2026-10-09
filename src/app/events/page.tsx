import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { tournamentYear, tournaments } from "@/content/events";
import { todayIn } from "@/lib/dates";
import { seasonComplete } from "@/lib/seasons";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Events and Tournaments",
  description: `Sabetha Golf Club ${tournamentYear} tournament schedule: scrambles, the Sabetha 2 Day Open, Club Championship and more.`,
};

export default async function EventsPage() {
  const { club, timeZone } = await getSettings();

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

      {/* The static page shows the plain schedule; today's date (past
          events greyed, "season complete") streams in per request. */}
      <Suspense fallback={<Schedule today={null} />}>
        <DatedSchedule timeZone={timeZone} />
      </Suspense>
    </div>
  );
}

async function DatedSchedule({ timeZone }: { timeZone: string }) {
  await connection();
  return <Schedule today={todayIn(timeZone)} />;
}

function Schedule({ today }: { today: string | null }) {
  const months = [...new Set(tournaments.map((t) => t.month))];
  const done = today !== null && seasonComplete(tournaments, today);

  return (
    <>
      {done && (
        <p className="mt-6 rounded-lg border border-green-800/20 bg-green-50 p-4">
          <span className="font-semibold">
            The {tournamentYear} season is complete.
          </span>{" "}
          Thanks to everyone who played! The {tournamentYear + 1} schedule will
          be posted here and on Facebook.
        </p>
      )}

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
              .map((t) => {
                const past = today !== null && t.lastDay < today;
                return (
                  <li
                    key={`${t.date}-${t.name}`}
                    className={`grid gap-1 py-3 sm:grid-cols-[9rem_1fr] ${past ? "text-stone-500" : ""}`}
                  >
                    <p className="font-semibold">
                      {t.date}
                      {t.time && (
                        <span className="font-normal text-stone-600">
                          {" "}
                          · {t.time}
                        </span>
                      )}
                      {past && <span className="sr-only"> (past)</span>}
                    </p>
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      {(t.format || t.fee) && (
                        <p className="text-sm text-stone-600">
                          {[t.format, t.fee].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {t.note && <p className="mt-1 text-sm">{t.note}</p>}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}
