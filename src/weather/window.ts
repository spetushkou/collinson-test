const DAY_MS = 24 * 60 * 60 * 1000;

// The place's next 7 local days, today first (Q5). Today comes from the place's own clock;
// the following days are counted on a UTC calendar from noon, which cannot be pushed into a
// neighbouring day by a daylight-saving shift.
export function localWindow(timezone: string, now: Date): string[] {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const noon = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: 7 }, (_, i) =>
    new Date(noon + i * DAY_MS).toISOString().slice(0, 10),
  );
}
