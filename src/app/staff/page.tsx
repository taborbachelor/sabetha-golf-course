import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSettings } from "@/content/settings";
import { requireStaff } from "@/lib/auth";
import { fetchBoard } from "@/lib/staff/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { StaffBoard } from "./StaffBoard";

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
        <StaffHome />
      </Suspense>
    </div>
  );
}

async function StaffHome() {
  const user = await requireStaff("/staff");
  const { timeZone } = getSettings();
  const initial = await fetchBoard(await createServerSupabase(), timeZone);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clubhouse</h1>
        <form action={signOut} className="flex items-center gap-3 text-sm">
          <span className="text-stone-600">
            {user.email} · {user.role}
          </span>
          {user.role === "admin" && (
            <Link href="/admin" className="chip min-h-10">
              Admin
            </Link>
          )}
          <button type="submit" className="chip min-h-10">
            Sign out
          </button>
        </form>
      </div>
      <StaffBoard
        initial={initial}
        timeZone={timeZone}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
