import type { Metadata } from "next";
import Image from "next/image";
import { clubhouseAmenities, rentalRules } from "@/content/clubhouse";
import { clubhousePhoto } from "@/content/photos";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Clubhouse Rental",
  description:
    "Rent the Sabetha Golf Club clubhouse for weddings, receptions and parties. Amenities, deposit, rules and how to reserve.",
};

export default async function ClubhouseRentalPage() {
  const { club, clubhouseRental } = await getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Clubhouse Rental</h1>
      <p className="mt-3">
        The clubhouse is a popular spot for weddings, anniversary receptions and
        other events. To reserve it, contact the Club Secretary or the clubhouse
        manager.
      </p>

      <Image
        src={clubhousePhoto.src}
        alt={clubhousePhoto.alt}
        placeholder="blur"
        sizes="(min-width: 768px) 736px, 100vw"
        className="mt-6 h-auto w-full rounded-lg"
      />

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

      <section aria-labelledby="amenities-heading" className="mt-10">
        <h2 id="amenities-heading" className="text-xl font-bold">
          The space
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {clubhouseAmenities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fees-heading" className="mt-10">
        <h2 id="fees-heading" className="text-xl font-bold">
          Fees
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            ${clubhouseRental.cleanupDeposit} cleanup deposit. $
            {clubhouseRental.selfCleanRefund} is returned if you do the cleanup
            yourself.
          </li>
          <li>
            ${clubhouseRental.outsideCateringFee} fee for outside catering.
          </li>
        </ul>
      </section>

      <section aria-labelledby="rental-rules-heading" className="mt-10">
        <h2 id="rental-rules-heading" className="text-xl font-bold">
          Rental rules
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {rentalRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
