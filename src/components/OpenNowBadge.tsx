"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/content/settings";
import { isOpenNow } from "@/lib/hours";

type Props = Pick<Settings, "timeZone" | "clubhouseHours">;

/**
 * Clubhouse open/closed badge. Computed in the browser so statically
 * prerendered pages never show a stale build-time answer.
 */
export function OpenNowBadge({ timeZone, clubhouseHours }: Props) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () =>
      setOpen(isOpenNow({ timeZone, clubhouseHours }, new Date()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [timeZone, clubhouseHours]);

  return (
    <span
      aria-live="polite"
      className="inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium"
    >
      {open !== null && (
        <>
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${open ? "bg-green-300" : "bg-stone-400"}`}
          />
          {open ? "Clubhouse open" : "Clubhouse closed"}
        </>
      )}
    </span>
  );
}
