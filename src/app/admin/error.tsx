"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/** Any admin page that fails: a plain message, not a crash screen. */
export default function AdminError({
  error,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-5"
    >
      <p className="text-lg font-semibold text-red-900">
        Something went wrong. Reload and try again.
      </p>
      <p className="mt-1 text-sm text-red-800">
        Nothing you saved before this was lost. If it keeps happening, wait a
        minute and try once more.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900"
      >
        Reload
      </button>
    </div>
  );
}
