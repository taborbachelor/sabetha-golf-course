import type { Settings } from "@/content/settings";

const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** schema.org GolfCourse JSON-LD for the club, built from settings. */
export function golfCourseJsonLd(settings: Settings, url: string) {
  const { club, clubhouseHours } = settings;

  return {
    "@context": "https://schema.org",
    "@type": "GolfCourse",
    name: club.name,
    url,
    telephone: club.phone,
    email: club.email,
    foundingDate: String(settings.course.established),
    address: {
      "@type": "PostalAddress",
      streetAddress: club.streetAddress,
      addressLocality: club.city,
      addressRegion: club.state,
      postalCode: club.postalCode,
      addressCountry: "US",
    },
    openingHoursSpecification: clubhouseHours.flatMap((hours, day) =>
      hours
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: SCHEMA_DAYS[day],
              opens: hours.open,
              closes: hours.close,
            },
          ]
        : [],
    ),
    sameAs: [club.facebookUrl],
  };
}
