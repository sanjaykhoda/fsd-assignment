import type { Db } from '../db/client.ts';
import type { Severity, Source, Status } from '../domain/constants.ts';
import { SEVERITIES } from '../domain/constants.ts';
import type { ListQuery, SummaryQuery } from '../domain/schemas.ts';
import { nowIso } from '../lib/dates.ts';

export interface InspectionRow {
  id: number;
  inspected_on: string;
  machine_id: string;
  defect_type_id: number;
  defect_type: string;
  defect_type_code: string;
  severity: Severity;
  remarks: string | null;
  status: Status;
  resolution_note: string | null;
  resolved_at: string | null;
  source: Source;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: number;
  inspectedOn: string;
  machineId: string;
  defectTypeId: number;
  defectType: string;
  defectTypeCode: string;
  severity: Severity;
  remarks: string | null;
  status: Status;
  resolutionNote: string | null;
  resolvedAt: string | null;
  source: Source;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeverityBreakdown {
  severity: Severity;
  open: number;
  resolved: number;
  total: number;
}

export interface Summary {
  totals: { open: number; resolved: number; total: number };
  bySeverity: SeverityBreakdown[];
}

export interface CreateInspectionRecord {
  inspectedOn: string;
  machineId: string;
  defectTypeId: number;
  severity: Severity;
  remarks?: string | null;
  source?: Source;
  externalRef?: string | null;
}

const FROM_INSPECTIONS = `
  FROM inspections i
  JOIN defect_types d ON d.id = i.defect_type_id
`;

const SELECT_INSPECTION = `
  SELECT i.*, d.name AS defect_type, d.code AS defect_type_code
  ${FROM_INSPECTIONS}
`;

/**
 * LIKE treats % and _ as wildcards, so a supervisor searching for "50_2" would
 * silently also match "5012". Escaping them keeps the search literal.
 *
 * '!' is the escape character rather than the conventional backslash purely for
 * legibility: a backslash would need doubling in both the SQL string and the
 * JavaScript one, which is easy to get subtly wrong.
 */
const LIKE_ESCAPE = '!';

function likeTerm(value: string): string {
  return `%${value.replace(/[!%_]/g, (char) => LIKE_ESCAPE + char)}%`;
}

/**
 * Severity has to sort by meaning, not alphabetically -- as a string
 * 'Critical' < 'Major' < 'Minor', which is exactly backwards.
 *
 * Critical scores highest so that `order=desc` means "most severe first",
 * matching what every other descending sort in the app does. Every sort
 * tie-breaks on id so pagination stays deterministic across pages.
 */
const SORT_COLUMNS = {
  inspectedOn: 'i.inspected_on',
  severity: "CASE i.severity WHEN 'Critical' THEN 3 WHEN 'Major' THEN 2 ELSE 1 END",
  status: 'i.status',
  machineId: 'i.machine_id',
  createdAt: 'i.created_at',
} as const;

export function toInspection(row: InspectionRow): Inspection {
  return {
    id: row.id,
    inspectedOn: row.inspected_on,
    machineId: row.machine_id,
    defectTypeId: row.defect_type_id,
    defectType: row.defect_type,
    defectTypeCode: row.defect_type_code,
    severity: row.severity,
    remarks: row.remarks,
    status: row.status,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    source: row.source,
    externalRef: row.external_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Shared WHERE builder so the list and the summary always filter identically. */
function buildFilters(query: Partial<ListQuery>): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    conditions.push('i.status = ?');
    params.push(query.status);
  }
  if (query.severity?.length) {
    conditions.push(`i.severity IN (${query.severity.map(() => '?').join(', ')})`);
    params.push(...query.severity);
  }
  if (query.defectTypeId?.length) {
    conditions.push(`i.defect_type_id IN (${query.defectTypeId.map(() => '?').join(', ')})`);
    params.push(...query.defectTypeId);
  }
  if (query.machineId) {
    conditions.push(`i.machine_id LIKE ? ESCAPE '${LIKE_ESCAPE}'`);
    params.push(likeTerm(query.machineId));
  }
  // One box covering everything a supervisor might remember about a defect:
  // where it happened, what was written down, and how it was fixed. The term is
  // bound once and reused across all four columns.
  if (query.q) {
    const term = `LIKE ? ESCAPE '${LIKE_ESCAPE}'`;
    conditions.push(
      `(i.machine_id ${term} OR i.remarks ${term} OR i.resolution_note ${term} OR d.name ${term})`,
    );
    params.push(likeTerm(query.q), likeTerm(query.q), likeTerm(query.q), likeTerm(query.q));
  }
  // Both bounds inclusive: to=2026-08-21 includes everything logged that day.
  if (query.from) {
    conditions.push('i.inspected_on >= ?');
    params.push(query.from);
  }
  if (query.to) {
    conditions.push('i.inspected_on <= ?');
    params.push(query.to);
  }

  return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export function createInspectionRepository(db: Db) {
  return {
    list(query: ListQuery): { items: Inspection[]; total: number } {
      const { clause, params } = buildFilters(query);

      const countRow = db.get<{ count: number }>(
        `SELECT COUNT(*) AS count ${FROM_INSPECTIONS} ${clause}`,
        params,
      );

      // sort/order resolve through a lookup table and are never interpolated
      // from raw input -- the one place SQL injection could otherwise enter.
      const column = SORT_COLUMNS[query.sort];
      const direction = query.order === 'asc' ? 'ASC' : 'DESC';
      const offset = (query.page - 1) * query.pageSize;

      const rows = db.all<InspectionRow>(
        `${SELECT_INSPECTION} ${clause} ORDER BY ${column} ${direction}, i.id DESC LIMIT ? OFFSET ?`,
        [...params, query.pageSize, offset],
      );

      return { items: rows.map(toInspection), total: countRow?.count ?? 0 };
    },

    findById(id: number): Inspection | undefined {
      const row = db.get<InspectionRow>(`${SELECT_INSPECTION} WHERE i.id = ?`, [id]);
      return row && toInspection(row);
    },

    findByExternalRef(externalRef: string): Inspection | undefined {
      const row = db.get<InspectionRow>(`${SELECT_INSPECTION} WHERE i.external_ref = ?`, [externalRef]);
      return row && toInspection(row);
    },

    create(input: CreateInspectionRecord): Inspection {
      const { lastInsertRowid } = db.run(
        `INSERT INTO inspections
           (inspected_on, machine_id, defect_type_id, severity, remarks, source, external_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.inspectedOn,
          input.machineId,
          input.defectTypeId,
          input.severity,
          input.remarks ?? null,
          input.source ?? 'manual',
          input.externalRef ?? null,
        ],
      );
      return this.findById(lastInsertRowid)!;
    },

    /**
     * Only ever transitions Open -> Resolved. The status guard in the WHERE
     * clause means a concurrent double-resolve cannot overwrite the first note.
     */
    resolve(id: number, resolutionNote: string): Inspection | undefined {
      const timestamp = nowIso();
      db.run(
        `UPDATE inspections
            SET status = 'Resolved', resolution_note = ?, resolved_at = ?, updated_at = ?
          WHERE id = ? AND status = 'Open'`,
        [resolutionNote, timestamp, timestamp, id],
      );
      return this.findById(id);
    },

    /** One grouped query, then zero-fill so the UI never meets a missing bucket. */
    summary(query: SummaryQuery): Summary {
      const { clause, params } = buildFilters(query);

      const rows = db.all<{ severity: Severity; open: number; resolved: number; total: number }>(
        `SELECT i.severity AS severity,
                SUM(CASE WHEN i.status = 'Open'     THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN i.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
                COUNT(*) AS total
           ${FROM_INSPECTIONS} ${clause}
          GROUP BY i.severity`,
        params,
      );

      const bySeverity = SEVERITIES.map((severity) => {
        const row = rows.find((r) => r.severity === severity);
        return { severity, open: row?.open ?? 0, resolved: row?.resolved ?? 0, total: row?.total ?? 0 };
      });

      return {
        totals: {
          open: bySeverity.reduce((sum, r) => sum + r.open, 0),
          resolved: bySeverity.reduce((sum, r) => sum + r.resolved, 0),
          total: bySeverity.reduce((sum, r) => sum + r.total, 0),
        },
        bySeverity,
      };
    },
  };
}

export type InspectionRepository = ReturnType<typeof createInspectionRepository>;
