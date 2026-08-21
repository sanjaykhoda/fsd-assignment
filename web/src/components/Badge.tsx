import { SEVERITY_DOTS, SEVERITY_STYLES, STATUS_STYLES } from '../lib/constants.ts';
import type { Severity, Status } from '../lib/types.ts';

const BASE = 'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-meta font-semibold';

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`${BASE} ${SEVERITY_STYLES[severity]}`}>
      <span className={`size-1.5 rounded-full ${SEVERITY_DOTS[severity]}`} aria-hidden="true" />
      {severity}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return <span className={`${BASE} ${STATUS_STYLES[status]}`}>{status}</span>;
}

/** Marks records that arrived through the mock SAP webhook rather than the UI. */
export function SourceTag() {
  return (
    <span className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-slate-600">
      SAP
    </span>
  );
}
