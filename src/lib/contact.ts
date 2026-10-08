import type { Settings } from "@/content/settings";

type Club = Settings["club"];

/** "2551 X Road, Sabetha, KS 66534". */
export function fullAddress(club: Club): string {
  return `${club.streetAddress}, ${club.city}, ${club.state} ${club.postalCode}`;
}

/** Search text for Google Maps: the club's name and street address. */
export function mapQuery(club: Club): string {
  return encodeURIComponent(`${club.name}, ${fullAddress(club)}`);
}

/** Google Maps directions to the club (Contact page and footer). */
export function mapsDirectionsUrl(club: Club): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${mapQuery(club)}`;
}

/** "785-284-2023" -> "tel:7852842023". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}
