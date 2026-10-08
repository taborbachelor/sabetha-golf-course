import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { HOLES, SHEETS, qrSvg, signUrls, type Sheet } from "@/lib/signs";
import { siteUrl } from "@/lib/site";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Admin: QR signs",
  robots: { index: false, follow: false },
};

export default function AdminSignsPage({
  searchParams,
}: PageProps<"/admin/signs">) {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      {searchParams.then(({ sheet }) => (
        <Signs
          sheet={
            sheet && String(sheet) in SHEETS
              ? (String(sheet) as Sheet)
              : "hole1"
          }
        />
      ))}
    </Suspense>
  );
}

async function Signs({ sheet }: { sheet: Sheet }) {
  await requireAdmin(`/admin/signs?sheet=${sheet}`);
  const urls = signUrls(siteUrl());

  return (
    <div>
      <div className="space-y-4 print:hidden">
        <p className="text-sm text-stone-600">
          Printable signs that open the website when scanned with a phone
          camera. Print on letter paper (portrait, 100% scale), then laminate or
          put them in a sign holder outside. Codes point at{" "}
          <span className="font-medium">{new URL(siteUrl()).host}</span>.
        </p>
        <nav aria-label="Sheets" className="flex flex-wrap gap-2">
          {Object.entries(SHEETS).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/signs?sheet=${key}`}
              aria-current={key === sheet ? "page" : undefined}
              className={`chip min-h-10 text-sm ${key === sheet ? "chip-on" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <PrintButton />
      </div>

      <div className="mt-6 space-y-6 print:mt-0 print:space-y-0">
        {sheet === "hole1" && <PaySign url={urls.pay} />}
        {sheet === "tees" &&
          HOLES.map((hole) => (
            <TeeSign key={hole} hole={hole} url={urls.hole(hole)} />
          ))}
        {sheet === "carts" && <CartStickers url={urls.order} />}
      </div>
    </div>
  );
}

/** One printed page: letter-shaped on screen, a full sheet on paper. */
function SignPage({ children }: { children: React.ReactNode }) {
  return (
    <section className="sign-page mx-auto flex aspect-[8.5/11] w-full max-w-[8.5in] flex-col items-center justify-between border border-stone-300 bg-white p-[6%] text-center text-stone-900 shadow-sm">
      {children}
    </section>
  );
}

async function Qr({
  url,
  label,
  className,
}: {
  url: string;
  label: string;
  className: string;
}) {
  const svg = await qrSvg(url);
  return (
    <figure className="flex w-full flex-col items-center gap-2">
      <div
        role="img"
        aria-label={label}
        data-qr-url={url}
        className={`${className} [&_svg]:h-auto [&_svg]:w-full`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="font-mono text-sm break-all text-stone-600">
        {url.replace(/^https?:\/\//, "")}
      </figcaption>
    </figure>
  );
}

async function PaySign({ url }: { url: string }) {
  const { greenFees, cartRental, isSample } = await getSettings();
  return (
    <SignPage>
      <div>
        <p className="text-2xl font-semibold tracking-wide text-green-900 uppercase">
          Sabetha Golf Club
        </p>
        <h2 className="mt-2 text-6xl font-black">Pay to Play</h2>
        <p className="mt-4 text-2xl">
          Clubhouse closed? Scan to pay your green fees and cart on your phone.
          No cash or envelope needed.
        </p>
      </div>
      <Qr url={url} label="QR code for Pay to Play" className="w-[55%]" />
      <div className="w-full">
        <table className="mx-auto text-xl">
          <thead>
            <tr>
              <td />
              <th className="px-4 font-semibold">9 holes</th>
              <th className="px-4 font-semibold">18 holes</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Weekday", greenFees.weekday],
                ["Weekend", greenFees.weekend],
                ["Cart", cartRental],
              ] as const
            ).map(([label, prices]) => (
              <tr key={label}>
                <th className="px-4 text-left font-semibold">{label}</th>
                <td className="px-4">${prices[9]}</td>
                <td className="px-4">${prices[18]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-base text-stone-600">
          Your receipt is on your phone. Staff check the paid list, so just head
          out.
          {isSample && " Sample prices."}
        </p>
        <p className="mt-1 text-base font-semibold">
          No signal? Use the box as before.
        </p>
      </div>
    </SignPage>
  );
}

async function TeeSign({ hole, url }: { hole: number; url: string }) {
  return (
    <SignPage>
      <div>
        <p className="text-2xl font-semibold tracking-wide text-green-900 uppercase">
          Sabetha Golf Club
        </p>
        <h2 className="mt-2 text-8xl font-black">Hole {hole}</h2>
      </div>
      <Qr
        url={url}
        label={`QR code for ordering to hole ${hole}`}
        className="w-[55%]"
      />
      <div>
        <p className="text-5xl font-bold">Order to the Course</p>
        <p className="mt-3 text-2xl">
          Scan for food and drinks from the clubhouse, brought out to you.
        </p>
        <p className="mt-2 text-xl text-stone-600">
          Available while the clubhouse is open
        </p>
      </div>
    </SignPage>
  );
}

async function CartStickers({ url }: { url: string }) {
  return (
    <SignPage>
      <div className="grid h-full w-full grid-cols-2 grid-rows-3 gap-[4%]">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-400 p-[4%]"
          >
            <p className="text-xl font-black">Order to the Course</p>
            <Qr
              url={url}
              label="QR code for Order to the Course"
              className="w-[60%]"
            />
            <p className="text-sm">Scan, pick your hole, we bring it out.</p>
            <p className="text-xs text-stone-600">
              Available while the clubhouse is open
            </p>
          </div>
        ))}
      </div>
    </SignPage>
  );
}
