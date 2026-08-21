import { Link } from 'react-router-dom';
import { formatRelativeDate } from '../lib/format.ts';
import type { Inspection } from '../lib/types.ts';
import { SeverityBadge, SourceTag, StatusPill } from './Badge.tsx';

/**
 * Three lines, ~76px tall: dense enough that about seven fit on a 390x844
 * screen without scrolling, loose enough to tap accurately. The whole card is
 * the link, so there is no small tap target to aim at.
 */
export function InspectionCard({ inspection }: { inspection: Inspection }) {
  return (
    <Link
      to={`/inspections/${inspection.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 active:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-body font-semibold text-slate-900">{inspection.machineId}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {inspection.source === 'sap' && <SourceTag />}
          <StatusPill status={inspection.status} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="truncate text-body text-slate-600">{inspection.defectType}</span>
        <div className="shrink-0">
          <SeverityBadge severity={inspection.severity} />
        </div>
      </div>

      <p className="mt-2 truncate text-meta text-slate-500">
        {formatRelativeDate(inspection.inspectedOn)}
        {inspection.remarks && <span> &middot; {inspection.remarks}</span>}
      </p>
    </Link>
  );
}
