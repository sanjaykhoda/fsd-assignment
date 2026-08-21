import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell.tsx';
import { ErrorState } from '../components/Skeleton.tsx';
import { useApi } from '../hooks/useApi.ts';
import { api } from '../lib/api.ts';
import { SEVERITY_DOTS } from '../lib/constants.ts';
import type { Summary } from '../lib/types.ts';

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'open' | 'resolved' }) {
  return (
    <div
      className={[
        'flex-1 rounded-xl border p-4',
        tone === 'open' ? 'border-brand-600/20 bg-brand-50' : 'border-emerald-600/20 bg-emerald-50',
      ].join(' ')}
    >
      <p className={`text-meta font-semibold ${tone === 'open' ? 'text-brand-700' : 'text-emerald-700'}`}>{label}</p>
      <p className={`nums mt-1 text-[1.75rem] leading-9 font-semibold ${tone === 'open' ? 'text-brand-700' : 'text-emerald-700'}`}>
        {value}
      </p>
    </div>
  );
}

export function SummaryPage() {
  const fetchSummary = useCallback(() => api.getSummary(''), []);
  const { data, loading, error, reload } = useApi<Summary>(fetchSummary);

  return (
    <AppShell title="Summary">
      {loading && !data && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="h-24 flex-1 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-24 flex-1 animate-pulse rounded-xl bg-slate-200" />
          </div>
          <div className="h-44 animate-pulse rounded-xl bg-slate-200" />
        </div>
      )}

      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <StatCard label="Open" value={data.totals.open} tone="open" />
            <StatCard label="Resolved" value={data.totals.resolved} tone="resolved" />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-body font-semibold text-slate-900">By severity</h2>
              <span className="text-meta text-slate-500">{data.totals.total} total</span>
            </header>

            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-meta text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">Severity</th>
                  <th className="px-2 py-2 text-right font-medium">Open</th>
                  <th className="px-2 py-2 text-right font-medium">Resolved</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.bySeverity.map((row) => (
                  <tr key={row.severity} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      {/* Deep-links into the list, so the summary is a way in
                          rather than a dead end. */}
                      <Link
                        to={`/?status=Open&severity=${row.severity}`}
                        className="flex items-center gap-2 text-body font-medium text-slate-900"
                      >
                        <span className={`size-2 rounded-full ${SEVERITY_DOTS[row.severity]}`} aria-hidden="true" />
                        {row.severity}
                      </Link>
                    </td>
                    <td className="nums px-2 py-3 text-right text-body font-semibold text-slate-900">{row.open}</td>
                    <td className="nums px-2 py-3 text-right text-body text-slate-500">{row.resolved}</td>
                    <td className="nums px-4 py-3 text-right text-body text-slate-500">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-center text-meta text-slate-400">Tap a severity to see its open inspections</p>
        </div>
      )}
    </AppShell>
  );
}
