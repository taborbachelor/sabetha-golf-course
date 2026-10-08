import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { requireStaff } from "@/lib/auth";
import { fetchBoard } from "@/lib/staff/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { SignOut } from "./SignOut";
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
  const { timeZone, roundMinutes } = await getSettings();
  const initial = await fetchBoard(await createServerSupabase(), timeZone);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clubhouse</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-stone-500" title={user.email}>
            {user.email}
          </span>
          {user.role === "admin" && (
            <Link href="/admin" className="chip min-h-10">
              Admin
            </Link>
          )}
          <SignOut />
        </div>
      </div>
      <StaffBoard
        initial={initial}
        timeZone={timeZone}
        roundMinutes={roundMinutes}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
