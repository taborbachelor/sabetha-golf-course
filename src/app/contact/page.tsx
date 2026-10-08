import type { Metadata } from "next";
import { HoursList } from "@/components/HoursList";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Find Sabetha Golf Club at 2551 X Road, about a mile north of Sabetha, Kansas. Phone, email, hours and directions.",
};

export default async function ContactPage() {
  const { club, clubhouseHours } = await getSettings();
  const fullAddress = `${club.streetAddress}, ${club.city}, ${club.state} ${club.postalCode}`;
  const mapQuery = encodeURIComponent(`${club.name}, ${fullAddress}`);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Contact</h1>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="space-y-8">
          <section aria-labelledby="visit-heading">
            <h2 id="visit-heading" className="text-xl font-bold">
              Visit
            </h2>
            <address className="mt-2 not-italic">
              {club.name}
              <br />
              {club.streetAddress}
              <br />
              {club.city}, {club.state} {club.postalCode}
            </address>
            <p className="mt-1 text-stone-600">{club.locationNote}.</p>
            <p className="mt-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                className="font-medium text-green-800 underline"
              >
                Get directions
              </a>
            </p>
          </section>

          <section aria-labelledby="reach-heading">
            <h2 id="reach-heading" className="text-xl font-bold">
              Call or write
            </h2>
            <dl className="mt-2 space-y-2">
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
              <div>
                <dt className="text-sm text-stone-600">Email</dt>
                <dd>
                  <a
                    href={`mailto:${club.email}`}
                    className="font-medium text-green-800 underline"
                  >
                    {club.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-stone-600">Mail</dt>
                <dd>{club.mailingAddress}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="contact-hours-heading">
            <h2 id="contact-hours-heading" className="text-xl font-bold">
              Clubhouse hours
            </h2>
            <div className="mt-2">
              <HoursList clubhouseHours={clubhouseHours} />
            </div>
          </section>

          <section aria-labelledby="updates-heading">
            <h2 id="updates-heading" className="text-xl font-bold">
              Stay up to date
            </h2>
            <ul className="mt-2 space-y-1">
              <li>
                <a
                  href={club.textCasterUrl}
                  className="text-green-800 underline"
                >
                  Sign up for TextCaster text alerts
                </a>{" "}
                for course conditions, hours and food specials
              </li>
              <li>
                <a href={club.facebookUrl} className="text-green-800 underline">
                  Follow us on Facebook
                </a>
              </li>
            </ul>
          </section>
        </div>

        <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-200 md:aspect-auto md:min-h-96">
          <iframe
            title={`Map to ${club.name}`}
            src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
