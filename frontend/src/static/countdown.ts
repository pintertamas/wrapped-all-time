export const TARGET = "2026-12-02";

/** Text for the countdown, or null once the date has come (the element is then hidden). */
export function countdownText(now: Date, target = TARGET): string | null {
  const [y, m, d] = target.split("-").map(Number) as [number, number, number];
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(y, m - 1, d).getTime() - startToday.getTime()) / 86400000);
  if (days <= 0) return null;
  return days === 1 ? "1 day until recap week (2 Dec 2026)" : `${days} days until recap week (2 Dec 2026)`;
}
