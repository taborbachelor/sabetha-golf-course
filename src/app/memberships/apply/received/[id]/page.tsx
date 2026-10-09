import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Application received",
  robots: { index: false, follow: false },
};

type Received = {
  name: string;
  email: string;
  cart_shed: boolean;
  created_at: string;
  membership_tiers: { name: string } | null;
};

export default function ReceivedPage({
  params,
}: PageProps<"/memberships/apply/received/[id]">) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
        <ReceivedView params={params} />
      </Suspense>
    </div>
  );
}

async function ReceivedView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: app } = await createAdminClient()
    .from("membership_applications")
    .select("name, email, cart_shed, created_at, membership_tiers(name)")
    .eq("id", id)
    .maybeSingle<Received>();
  if (!app) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Application received</h1>
        <p className="mt-2">
          Thanks, {app.name}. The Club Secretary will review your application
          and contact you at{" "}
          <span className="font-medium break-all">{app.email}</span> about next
          steps.
        </p>
      </div>
      <dl className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        <Row label="Membership type">{app.membership_tiers?.name ?? "—"}</Row>
        <Row label="Cart Shed">{app.cart_shed ? "Yes, please" : "No"}</Row>
      </dl>
      <p className="text-sm text-stone-600">
        Nothing is emailed. Keep this page if you&apos;d like a record.
      </p>
      <p>
        <Link href="/memberships" className="text-green-800 underline">
          Back to Memberships
        </Link>
      </p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-stone-600">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
