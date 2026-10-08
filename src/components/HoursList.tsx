import type { Settings } from "@/content/settings";
import { weeklyHours } from "@/lib/hours";

export function HoursList({
  clubhouseHours,
}: {
  clubhouseHours: Settings["clubhouseHours"];
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
      {weeklyHours(clubhouseHours).map((row) => (
        <div key={row.days} className="contents">
          <dt className="font-medium">{row.days}</dt>
          <dd>{row.hours}</dd>
        </div>
      ))}
    </dl>
  );
}
