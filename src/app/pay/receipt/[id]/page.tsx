import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import { isUuid } from "@/lib/codes";
import { isAbandoned } from "@/lib/rounds/checkout";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Your receipt",
  // Receipts are private, even after the site is indexed.
  robots: { index: false, follow: false },
};

type Round = {
  id: string;
  code: string;
  status: "pending" | "paid" | "refunded" | "cancelled";
  play_date: string;
  holes: 9 | 18;
  players: number;
  carts: number;
  name: string;
  arrival_time: string | null;
  amount_cents: number;
  payment_id: string | null;
  created_at: string;
};

export default function ReceiptPage({
  params,
}: PageProps<"/pay/receipt/[id]">) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Suspense
        fallback={<p className="text-stone-600">Loading your receipt…</p>}
      >
        <Receipt params={params} />
      </Suspense>
    </div>
  );
}

async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data } = await createAdminClient()
    .from("rounds")
    .select(
      "id, code, status, play_date, holes, players, carts, name, arrival_time, amount_cents, payment_id, created_at",
    )
    .eq("id", id)
    .maybeSingle<Round>();
  if (!data) notFound();

  if (data.status !== "paid") {
    // A checkout still pending after the hold window never finished; its
    // carts are already back in online inventory.
    const stale =
      data.status === "pending" && !data.payment_id && isAbandoned(data);
    return (
      <div>
        <h1 className="text-2xl font-bold">Payment not completed</h1>
        <p className="mt-3">
          {stale
            ? "This payment didn't finish. You were not charged — please pay again."
            : data.status === "pending"
              ? "We're still confirming this payment. Refresh in a moment."
              : "This payment didn't go through, so you weren't charged."}
        </p>
        <Link
          href="/pay"
          className="mt-6 inline-block font-medium text-green-800 underline"
        >
          {stale ? "Pay again" : "Back to Pay to Play"}
        </Link>
      </div>
    );
  }

  const receiptUrl = new URL(`/pay/receipt/${data.id}`, siteUrl()).toString();
  const qrSvg = await QRCode.toString(receiptUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const date = new Date(`${data.play_date}T12:00:00Z`).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    },
  );

  const rows = [
    ["Name", data.name],
    ["Date", date],
    ["Arriving", data.arrival_time ?? "—"],
    ["Holes", String(data.holes)],
    ["Players", String(data.players)],
    ["Carts", data.carts ? `${data.carts} (reserved)` : "None"],
    ["Paid", formatPrice(data.amount_cents)],
  ];

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold text-green-800">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-green-800 text-sm text-white"
        >
          ✓
        </span>
        Paid. You&apos;re all set.
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-wide">{data.code}</h1>
      <p className="mt-1 text-stone-600">
        Show this code at the clubhouse if anyone asks.
      </p>
      <p className="mt-3 font-medium">
        Bookmark or screenshot this page. No email is sent.
      </p>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Demo: test payment. No real card was charged.
      </p>

      <div
        role="img"
        aria-label={`QR code for receipt ${data.code}`}
        className="mx-auto mt-6 w-56 rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <dl className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-stone-600">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {data.carts > 0 && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-green-900">
          Your cart{data.carts === 1 ? " will be" : "s will be"} waiting with a
          &ldquo;Reserved for {data.name}&rdquo; sign. The key is in the cart.
        </p>
      )}
    </div>
  );
}
