import type { Severity, Status } from './types.ts';

/**
 * Mirrors api/src/domain/constants.ts. Severity and status are fixed
 * vocabularies enforced by database CHECK constraints, so duplicating ~10
 * lines is cheaper than a shared workspace and its build wiring (see README).
 *
 * Defect types are deliberately absent: they are loaded from /api/defect-types
 * because the plant manages them at runtime.
 */
export const SEVERITIES: Severity[] = ['Critical', 'Major', 'Minor'];
export const STATUSES: Status[] = ['Open', 'Resolved'];

/** Tailwind classes per severity. Colour here always means severity. */
export const SEVERITY_STYLES: Record<Severity, string> = {
  Critical: 'bg-critical-bg text-critical border-critical/20',
  Major: 'bg-major-bg text-major border-major/20',
  Minor: 'bg-minor-bg text-minor border-minor/25',
};

export const SEVERITY_DOTS: Record<Severity, string> = {
  Critical: 'bg-critical',
  Major: 'bg-major',
  Minor: 'bg-minor',
};

export const STATUS_STYLES: Record<Status, string> = {
  Open: 'bg-brand-50 text-brand-700 border-brand-600/20',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-600/20',
};
