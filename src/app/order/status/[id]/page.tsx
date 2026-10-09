import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import type { DeliveryMinutes } from "@/content/settings";
import { isUuid } from "@/lib/codes";
import type { OrderLine, OrderStatus } from "@/lib/orders/order";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { CallClubhouse } from "../../CallClubhouse";
import { StatusTracker } from "./StatusTracker";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

type Order = {
  id: string;
  code: string;
  hole: number;
  name: string;
  items: OrderLine[];
  total_cents: number;
  has_alcohol: boolean;
  status: OrderStatus;
};

/** "Usually 10–20 minutes." (or "Usually about 15 minutes."). */
function deliveryEstimate({ min, max }: DeliveryMinutes): string {
  return min === max
    ? `Usually about ${min} minutes.`
    : `Usually ${min}–${max} minutes.`;
}

export default function OrderStatusPage({
  params,
}: PageProps<"/order/status/[id]">) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Suspense
        fallback={<p className="text-stone-600">Loading your order…</p>}
      >
        <OrderStatusView params={params} />
      </Suspense>
    </div>
  );
}

async function OrderStatusView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [{ data: order }, settings] = await Promise.all([
    createAdminClient()
      .from("orders")
      .select("id, code, hole, name, items, total_cents, has_alcohol, status")
      .eq("id", id)
      .maybeSingle<Order>(),
    getSettings(),
  ]);
  if (!order) notFound();
  const phone = settings.club.phone;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-stone-600">Order for {order.name}</p>
        <h1 className="text-4xl font-bold tracking-wide">{order.code}</h1>
        <p className="mt-1 text-lg">
          Delivering to <strong>hole {order.hole}</strong>
        </p>
      </div>

      <StatusTracker orderId={order.id} initial={order.status} phone={phone} />
      {order.status !== "delivered" && order.status !== "cancelled" && (
        <p className="text-stone-700">
          {deliveryEstimate(settings.deliveryMinutes)} Keep playing — we&apos;ll
          find you by name.
          {settings.isSample && (
            <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs whitespace-nowrap text-stone-600">
              Sample
            </span>
          )}
        </p>
      )}

      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
        {order.items.map((line) => (
          <li key={line.id} className="flex justify-between px-4 py-2">
            <span>
              {line.qty}× {line.name}
            </span>
            <span>{formatPrice(line.qty * line.price_cents)}</span>
          </li>
        ))}
        <li className="flex justify-between px-4 py-2 font-bold">
          <span>Paid</span>
          <span>{formatPrice(order.total_cents)}</span>
        </li>
      </ul>

      {order.has_alcohol && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
          21+. Have your ID ready when we deliver.
        </p>
      )}
      <div className="rounded-lg bg-stone-50 px-4 py-3">
        <p>
          Moved holes or need something? <CallClubhouse phone={phone} />
        </p>
        <p className="text-sm text-stone-600">
          Keep this page open; it updates by itself.
        </p>
      </div>
      {/* No hole here: they've likely moved on, so they pick it again. */}
      <Link
        href="/order"
        className="inline-flex min-h-11 items-center font-semibold text-green-800 underline"
      >
        Order something else
      </Link>
    </div>
  );
}
