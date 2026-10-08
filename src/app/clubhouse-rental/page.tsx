import type { Metadata } from "next";
import { getSettings } from "@/content/settings";

export const metadata: Metadata = {
  title: "Clubhouse Rental",
  description:
    "Rent the Sabetha Golf Club clubhouse for your event. Contact the club for dates and details.",
};

export default function ClubhouseRentalPage() {
  const { club } = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Clubhouse Rental</h1>
      <p className="mt-3">
        The clubhouse is available to rent for parties, meetings and other
        events. Contact the club for available dates, pricing and details.
      </p>

      <dl className="mt-6 space-y-3 rounded-lg bg-stone-100 p-4">
        <div>
          <dt className="text-sm text-stone-600">Email</dt>
          <dd>
            <a
              href={`mailto:${club.email}?subject=Clubhouse%20rental`}
              className="font-medium text-green-800 underline"
            >
              {club.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-stone-600">Phone</dt>
          <dd>
            <a
              href={`tel:${club.phone.replace(/\D/g, "")}`}
              className="font-medium text-green-800 underline"
            >
              {club.phone}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  );
}
