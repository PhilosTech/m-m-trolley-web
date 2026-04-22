export const EVENT_DATE = "2026-04-22";

export function timeToIsoOnEventDate(timeHHMM: string): string {
  const d = new Date(`${EVENT_DATE}T${timeHHMM}:00`);
  return d.toISOString();
}

