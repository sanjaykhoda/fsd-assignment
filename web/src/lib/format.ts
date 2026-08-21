/**
 * Calendar dates are handled as 'YYYY-MM-DD' strings end to end, never as Date
 * objects, because `new Date('2026-08-21')` parses as UTC midnight and renders
 * as the 20th for anyone west of UTC. The parts are split manually instead.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today in the *local* timezone -- 'en-CA' formats as YYYY-MM-DD by definition. */
export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function startOfMonthIso(iso: string = todayIso()): string {
  return `${iso.slice(0, 7)}-01`;
}

/** '2026-08-21' -> '21 Aug'; adds the year only when it is not the current one. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-') as [string, string, string];
  const label = `${Number(day)} ${MONTHS[Number(month) - 1]}`;
  return year === todayIso().slice(0, 4) ? label : `${label} ${year}`;
}

/** Relative label for the list: today and yesterday read faster than a date. */
export function formatRelativeDate(iso: string): string {
  const today = todayIso();
  if (iso === today) return 'Today';
  if (iso === shiftIso(today, -1)) return 'Yesterday';
  return formatDate(iso);
}

/** Timestamps are real instants, so these render in the viewer's timezone. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
