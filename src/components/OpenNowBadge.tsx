"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/content/settings";
import { clubhouseStatus, type ClubhouseStatus } from "@/lib/hours";

type Props = Pick<Settings, "timeZone" | "clubhouseHours">;

/**
 * Clubhouse badge: "Open until 8pm", "Opens 4:30pm", "Opens Wed 4:30pm".
 * Computed only in the browser (empty until then) so a prerendered page
 * never shows a stale build-time answer; refreshed every minute and when
 * the tab comes back into view.
 */
export function OpenNowBadge({ timeZone, clubhouseHours }: Props) {
  const [status, setStatus] = useState<ClubhouseStatus | null>(null);

  useEffect(() => {
    const update = () =>
      setStatus(clubhouseStatus({ timeZone, clubhouseHours }, new Date()));
    update();
    const id = setInterval(update, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timeZone, clubhouseHours]);

  return (
    <span
      aria-live="polite"
      className="inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap"
    >
      {status && (
        <>
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${status.open ? "bg-green-300" : "bg-stone-400"}`}
          />
          <span className="sr-only">Clubhouse: </span>
          {status.text}
        </>
      )}
    </span>
  );
}
