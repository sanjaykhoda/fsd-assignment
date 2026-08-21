import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell.tsx';
import { Button } from '../components/Button.tsx';
import { controlClass, Field } from '../components/Field.tsx';
import { useToast } from '../components/Toast.tsx';
import { useApi } from '../hooks/useApi.ts';
import { api, ApiError } from '../lib/api.ts';
import { SEVERITIES, SEVERITY_DOTS } from '../lib/constants.ts';
import { todayIso } from '../lib/format.ts';
import type { DefectType, Severity } from '../lib/types.ts';

/**
 * Field order follows the supervisor's own sequence -- when, where, what, how
 * bad, anything else -- so the form reads like the job rather than like the
 * database table.
 *
 * Native <select> and <input type="date"> are used deliberately: on a phone
 * they open the OS pickers, which beat any JS component and cost nothing.
 */
export function NewInspectionPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const fetchDefectTypes = useCallback(() => api.listDefectTypes(), []);
  const { data: defectTypes, loading: loadingTypes } = useApi<DefectType[]>(fetchDefectTypes);

  const [inspectedOn, setInspectedOn] = useState(todayIso());
  const [machineId, setMachineId] = useState('');
  const [defectTypeId, setDefectTypeId] = useState('');
  const [severity, setSeverity] = useState<Severity>('Major');
  const [remarks, setRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.createInspection({
        inspectedOn,
        machineId,
        defectTypeId: Number(defectTypeId),
        severity,
        remarks: remarks.trim() || null,
      });
      toast('Inspection logged');
      navigate('/');
    } catch (err) {
      // The server's details[] render under the matching fields, so its
      // validation contract is the form's validation with no duplication.
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save the inspection'));
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Log inspection" back="/" action={<span />}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Date" htmlFor="inspectedOn" error={error?.fieldError('inspectedOn')}>
          <input
            id="inspectedOn"
            type="date"
            required
            max={todayIso()}
            className={controlClass}
            value={inspectedOn}
            onChange={(e) => setInspectedOn(e.target.value)}
          />
        </Field>

        <Field
          label="Machine / line ID"
          htmlFor="machineId"
          hint="Free text, e.g. LOOM-14 or LINE-B2"
          error={error?.fieldError('machineId')}
        >
          <input
            id="machineId"
            required
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="LOOM-14"
            className={controlClass}
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
          />
        </Field>

        <Field label="Defect type" htmlFor="defectTypeId" error={error?.fieldError('defectTypeId')}>
          <select
            id="defectTypeId"
            required
            disabled={loadingTypes}
            className={controlClass}
            value={defectTypeId}
            onChange={(e) => setDefectTypeId(e.target.value)}
          >
            <option value="" disabled>
              {loadingTypes ? 'Loading...' : 'Select a defect type'}
            </option>
            {defectTypes?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Three options and the field a reviewer will touch most -- radio
            cards rather than a dropdown, so severity is one tap, not three. */}
        <Field label="Severity" error={error?.fieldError('severity')}>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSeverity(option)}
                aria-pressed={severity === option}
                className={[
                  'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-meta font-semibold transition-colors',
                  severity === option
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-300 bg-white text-slate-600',
                ].join(' ')}
              >
                <span className={`size-2.5 rounded-full ${SEVERITY_DOTS[option]}`} aria-hidden="true" />
                {option}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Remarks" htmlFor="remarks" optional error={error?.fieldError('remarks')}>
          <textarea
            id="remarks"
            rows={3}
            maxLength={1000}
            placeholder="What did you observe?"
            className={`${controlClass} min-h-24 resize-none py-2.5`}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </Field>

        {error && error.details.length === 0 && (
          <p role="alert" className="rounded-xl border border-critical/20 bg-critical-bg px-3 py-2 text-meta text-critical">
            {error.message}
          </p>
        )}

        <Button type="submit" full loading={submitting} disabled={!machineId.trim() || !defectTypeId}>
          Save inspection
        </Button>
      </form>
    </AppShell>
  );
}
