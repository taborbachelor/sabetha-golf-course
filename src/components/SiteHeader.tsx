"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logo } from "@/content/photos";
import { chromeFor, isCurrent, navItems } from "@/lib/nav";

type Props = { clubName: string; badge?: ReactNode };

/**
 * Site header. Hidden on the staff tablet board (/staff) so a stray tap
 * can't leave it; just the club name on staff sign-in.
 */
export function SiteHeader(props: Props) {
  const pathname = usePathname();
  const chrome = chromeFor(pathname);
  if (chrome === "none") return null;
  if (chrome === "minimal") return <MinimalHeader clubName={props.clubName} />;
  return <HeaderView {...props} pathname={pathname} />;
}

/**
 * The header before the URL is known (pages with an unknown dynamic segment
 * while prerendering). Same header, just without the current-page mark.
 */
export function SiteHeaderFallback(props: Props) {
  return <HeaderView {...props} pathname={null} />;
}

function ClubMark({ clubName }: { clubName: string }) {
  return (
    <>
      <Image
        src={logo.src}
        alt=""
        width={36}
        height={36}
        // Fixed pixel size: with large phone text the name gets the room.
        className="size-[32px] shrink-0 rounded-full bg-white sm:size-[36px]"
      />
      <span className="min-w-0 [overflow-wrap:normal]">{clubName}</span>
    </>
  );
}

function MinimalHeader({ clubName }: { clubName: string }) {
  return (
    <header className="border-b border-black/10 bg-green-900 text-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 text-lg font-semibold">
        <ClubMark clubName={clubName} />
      </div>
    </header>
  );
}

function HeaderView({
  clubName,
  badge,
  pathname,
}: Props & { pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const toggle = useRef<HTMLButtonElement>(null);

  // Close the menu after navigating (including Back/Forward).
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  // Escape closes the menu and puts focus back on the menu button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) =>
    isCurrent(href, pathname) ? ("page" as const) : undefined;

  return (
    // Sticky only from sm up: on phones (and with large text) a pinned
    // header would eat the screen.
    <header className="z-20 border-b border-black/10 bg-green-900 text-white sm:sticky sm:top-0 print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:py-3">
        <div className="flex min-w-0 items-center gap-x-3">
          <Link
            href="/"
            onClick={close}
            aria-current={current("/")}
            className="flex min-w-0 items-center gap-2 text-base leading-tight font-semibold sm:text-lg"
          >
            <ClubMark clubName={clubName} />
          </Link>
          {badge && <span className="hidden shrink-0 sm:block">{badge}</span>}
        </div>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-4 text-sm xl:gap-5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current(item.href)}
                  className={
                    item.primary
                      ? "inline-block rounded-lg bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-green-900 hover:bg-green-50 aria-[current=page]:ring-2 aria-[current=page]:ring-green-300"
                      : "whitespace-nowrap underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          ref={toggle}
          type="button"
          className="-mr-2 shrink-0 rounded p-2 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-white/15 lg:hidden"
        >
          {badge && (
            <div className="mx-auto max-w-6xl px-4 pt-3 sm:hidden">{badge}</div>
          )}
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={current(item.href)}
                  className={
                    item.primary
                      ? "my-2 block rounded-xl bg-white px-4 py-3 text-center text-lg font-bold text-green-900 hover:bg-green-50"
                      : "block py-3 text-base aria-[current=page]:font-semibold aria-[current=page]:underline"
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
