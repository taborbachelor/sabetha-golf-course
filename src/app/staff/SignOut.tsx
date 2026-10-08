"use client";

import { useState } from "react";
import { signOut } from "./actions";

/**
 * Sign out with a confirm step, so a stray tap behind a busy counter doesn't
 * log the tablet out mid-rush. Inline (not a browser confirm dialog).
 */
export function SignOut() {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="chip min-h-10"
      >
        Sign out
      </button>
    );
  }

  return (
    <form
      action={signOut}
      role="group"
      aria-label="Confirm sign out"
      className="flex items-center gap-2"
    >
      <span className="font-semibold">Sign out?</span>
      <button
        type="submit"
        className="min-h-10 rounded-lg bg-stone-800 px-4 font-semibold text-white"
      >
        Yes, sign out
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="chip min-h-10"
      >
        Cancel
      </button>
    </form>
  );
}
