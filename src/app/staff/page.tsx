import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
        <StaffHome />
      </Suspense>
    </div>
  );
}

async function StaffHome() {
  const user = await requireStaff("/staff");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clubhouse</h1>
        <form action={signOut} className="flex items-center gap-3 text-sm">
          <span className="text-stone-600">
            {user.email} · {user.role}
          </span>
          <button type="submit" className="chip min-h-10">
            Sign out
          </button>
        </form>
      </div>
      <p className="mt-6 rounded-lg bg-stone-100 px-4 py-3 text-stone-700">
        Paid today, the carts board and the orders queue arrive here next.
      </p>
    </div>
  );
}
