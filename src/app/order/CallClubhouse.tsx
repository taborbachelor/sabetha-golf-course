/** "785-284-2023" -> "tel:7852842023". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** The clubhouse phone as a tap-to-call link, big enough to hit in a cart. */
export function CallClubhouse({ phone }: { phone: string }) {
  return (
    <a
      href={telHref(phone)}
      className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-green-800 underline"
    >
      Call {phone}
    </a>
  );
}
