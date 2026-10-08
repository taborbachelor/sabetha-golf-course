import Link from "next/link";
import { AdminNav } from "./AdminNav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <Link href="/staff" className="chip min-h-10 text-sm">
          Back to Clubhouse
        </Link>
      </div>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
