import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default function StaffLoginPage({
  searchParams,
}: PageProps<"/staff/login">) {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Staff sign in</h1>
      <p className="mt-2 text-stone-600">
        For clubhouse staff. Golfers don&apos;t need an account.
      </p>
      <div className="mt-6">
        <Suspense>
          {searchParams.then(({ next }) => (
            <LoginForm next={safeNext(next)} />
          ))}
        </Suspense>
      </div>
    </div>
  );
}
