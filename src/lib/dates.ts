/** Saturday and Sunday count as weekend for green fee pricing. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
