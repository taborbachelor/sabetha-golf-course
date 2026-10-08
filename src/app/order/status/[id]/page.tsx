import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import { isUuid } from "@/lib/codes";
import type { OrderLine, OrderStatus } from "@/lib/orders/order";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id, code, hole, name, items, total_cents, has_alcohol, status")
    .eq("id", id)
    .maybeSingle<Order>();
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-stone-600">Order for {order.name}</p>
        <h1 className="text-4xl font-bold tracking-wide">{order.code}</h1>
        <p className="mt-1 text-lg">
          Delivering to <strong>hole {order.hole}</strong>
        </p>
      </div>

      <StatusTracker orderId={order.id} initial={order.status} />

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
      <p className="text-sm text-stone-600">
        Keep this page open; it updates by itself. Moved to another hole? Call
        the clubhouse.
      </p>
      <Link
        href={`/order?hole=${order.hole}`}
        className="inline-block font-medium text-green-800 underline"
      >
        Order something else
      </Link>
    </div>
  );
}
