/**
 * Severity and status are fixed vocabularies from the brief and are enforced by
 * CHECK constraints in the schema, so they live here as constants.
 *
 * Defect types are deliberately NOT here -- they are rows in `defect_types` and
 * are managed at runtime through /api/defect-types.
 *
 * Mirrored in web/src/lib/constants.ts. Two copies of ~10 lines beat a third
 * workspace and the cross-package build config it would drag in; see README.
 */
export const SEVERITIES = ['Critical', 'Major', 'Minor'] as const;
export const STATUSES = ['Open', 'Resolved'] as const;
export const SOURCES = ['manual', 'sap'] as const;

export type Severity = (typeof SEVERITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];

/** The five types the brief names. Seeded by schema.sql and undeletable. */
export const SYSTEM_DEFECT_CODES = ['WEAVE', 'SHADE', 'HOLE', 'COUNT', 'OTHER'] as const;

/** Fallback bucket for SAP payloads carrying an unrecognised defect code. */
export const FALLBACK_DEFECT_CODE = 'OTHER';
