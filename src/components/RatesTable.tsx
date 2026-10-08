import type { Holes, Settings } from "@/content/settings";

type Props = Pick<Settings, "greenFees" | "cartRental">;

// Weekday/weekend split matches isWeekend() in src/lib/dates.ts.
export function RatesTable({ greenFees, cartRental }: Props) {
  const rows: { label: string; prices: Record<Holes, number> }[] = [
    { label: "Weekday (Mon–Fri)", prices: greenFees.weekday },
    { label: "Weekend (Sat–Sun)", prices: greenFees.weekend },
    { label: "Cart", prices: cartRental },
  ];

  return (
    <table className="w-full max-w-sm text-left">
      <caption className="caption-bottom pt-2 text-left text-sm text-stone-600">
        Green fees per player · cart rental per cart
      </caption>
      <thead>
        <tr className="border-b border-stone-300 text-sm text-stone-600">
          <td></td>
          <th scope="col" className="py-1 font-medium">
            9 holes
          </th>
          <th scope="col" className="py-1 font-medium">
            18 holes
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className="py-1 pr-3 font-medium">
              {row.label}
            </th>
            <td>${row.prices[9]}</td>
            <td>${row.prices[18]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
