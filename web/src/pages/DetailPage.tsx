import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell.tsx';
import { SeverityBadge, SourceTag, StatusPill } from '../components/Badge.tsx';
import { Button } from '../components/Button.tsx';
import { controlClass } from '../components/Field.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { ErrorState } from '../components/Skeleton.tsx';
import { useToast } from '../components/Toast.tsx';
import { useApi } from '../hooks/useApi.ts';
import { api, ApiError } from '../lib/api.ts';
import { formatDate, formatTimestamp } from '../lib/format.ts';
import type { Inspection } from '../lib/types.ts';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="shrink-0 text-meta text-slate-500">{label}</span>
      <span className="text-right text-body text-slate-900">{children}</span>
    </div>
  );
}

export function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const fetchInspection = useCallback(() => api.getInspection(id!).then((data) => ({ data })), [id]);
  const { data: inspection, loading, error, reload } = useApi<Inspection>(fetchInspection);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function resolve() {
    if (!inspection) return;
    setSubmitting(true);
    setResolveError(null);

    try {
      await api.resolveInspection(inspection.id, note);
      setSheetOpen(false);
      toast('Inspection resolved');
      reload();
    } catch (err) {
      setResolveError(err instanceof ApiError ? err.message : 'Could not resolve');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title={inspection ? inspection.machineId : 'Inspection'} back="/" action={<span />}>
      {loading && !inspection && <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />}

      {error && !inspection && (
        <ErrorState message={error} onRetry={error.includes('not found') ? () => navigate('/') : reload} />
      )}

      {inspection && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={inspection.status} />
              <SeverityBadge severity={inspection.severity} />
              {inspection.source === 'sap' && <SourceTag />}
            </div>

            <div className="mt-2">
              <Row label="Inspected on">{formatDate(inspection.inspectedOn)}</Row>
              <Row label="Machine / line">{inspection.machineId}</Row>
              <Row label="Defect type">{inspection.defectType}</Row>
              {inspection.externalRef && <Row label="SAP notification">{inspection.externalRef}</Row>}
              <Row label="Logged">{formatTimestamp(inspection.createdAt)}</Row>
            </div>
          </div>

          {inspection.remarks && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-meta font-semibold text-slate-500">Remarks</h2>
              <p className="mt-1.5 text-body whitespace-pre-wrap text-slate-800">{inspection.remarks}</p>
            </section>
          )}

          {inspection.status === 'Resolved' ? (
            <section className="rounded-xl border border-emerald-600/20 bg-emerald-50 p-4">
              <h2 className="text-meta font-semibold text-emerald-700">
                Resolved {inspection.resolvedAt && formatTimestamp(inspection.resolvedAt)}
              </h2>
              <p className="mt-1.5 text-body whitespace-pre-wrap text-emerald-900">{inspection.resolutionNote}</p>
            </section>
          ) : (
            <Button full onClick={() => setSheetOpen(true)}>
              Mark as resolved
            </Button>
          )}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        title="Resolve inspection"
        onClose={() => setSheetOpen(false)}
        footer={
          <Button
            full
            loading={submitting}
            // The mandatory note is expressed three times: here, as a 422 from
            // the API, and as a CHECK constraint in the database.
            disabled={!note.trim()}
            onClick={resolve}
          >
            Confirm resolution
          </Button>
        }
      >
        <label htmlFor="note" className="text-meta font-semibold text-slate-700">
          Resolution note
        </label>
        <textarea
          id="note"
          rows={4}
          autoFocus
          maxLength={1000}
          placeholder="What was done to fix it?"
          className={`${controlClass} mt-1.5 min-h-28 resize-none py-2.5`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="mt-1.5 text-meta text-slate-500">Required &mdash; describe what was done.</p>

        {resolveError && (
          <p role="alert" className="mt-3 rounded-xl border border-critical/20 bg-critical-bg px-3 py-2 text-meta text-critical">
            {resolveError}
          </p>
        )}
      </Sheet>
    </AppShell>
  );
}
