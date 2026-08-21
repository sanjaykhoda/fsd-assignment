/**
 * Calendar-date helpers. Everything here works on 'YYYY-MM-DD' strings and
 * never on Date instances, because `new Date('2026-08-21')` parses as UTC
 * midnight and renders as the 20th for anyone west of UTC -- and
 * `toISOString().slice(0, 10)` returns *yesterday* for anyone east of it
 * during their early morning. Both are silent off-by-one-day bugs.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Today in the *local* timezone. 'en-CA' formats as YYYY-MM-DD by definition. */
export function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** True only for a well-formed string that is also a real calendar date. */
export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Shifts a 'YYYY-MM-DD' string by whole days. Uses UTC internally so DST
 * transitions cannot move the result by an hour and roll it onto another date.
 */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}
