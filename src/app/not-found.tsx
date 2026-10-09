import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const links = [
  { href: "/", label: "Home" },
  { href: "/pay", label: "Pay to Play" },
  { href: "/order", label: "Order to the Course" },
  { href: "/contact", label: "Contact" },
];

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="text-sm font-semibold tracking-wide text-green-800 uppercase">
        Page not found
      </p>
      <h1 className="mt-1 text-3xl font-bold">
        Looks like that one went out of bounds.
      </h1>
      <p className="mt-3 text-stone-700">
        The page you&apos;re looking for isn&apos;t here. It may have moved, or
        the link may be mistyped. Try one of these:
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-xl border border-stone-200 bg-white px-5 py-4 font-semibold text-green-900 hover:border-green-800 hover:bg-green-50"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
