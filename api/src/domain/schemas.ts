import { z } from 'zod';
import { SEVERITIES, STATUSES } from './constants.ts';
import { isValidIsoDate, todayLocalIso } from '../lib/dates.ts';

const isoDate = z
  .string()
  .trim()
  .refine(isValidIsoDate, 'Must be a valid calendar date in YYYY-MM-DD format');

/** Field-specific messages: these surface verbatim under the inputs in the UI. */
const trimmed = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

/**
 * Repeatable query params arrive as `string | string[]` from Express, and are
 * also accepted comma-separated (`?severity=Critical,Major`) because that is
 * what the URL-driven filter UI produces.
 */
const rawList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((raw) => {
    if (raw === undefined) return undefined;
    const values = (Array.isArray(raw) ? raw : raw.split(',')).map((v) => v.trim()).filter(Boolean);
    // `?severity=` with nothing after it means "no filter", not "match nothing".
    return values.length ? values : undefined;
  });

const enumList = <T extends readonly [string, ...string[]]>(values: T) =>
  rawList.pipe(z.array(z.enum(values)).optional());

const idList = rawList
  .transform((values) => values?.map(Number))
  .pipe(z.array(z.number().int().positive()).optional());

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export const createInspectionSchema = z
  .object({
    inspectedOn: isoDate.default(todayLocalIso),
    machineId: trimmed('Machine / line ID', 60),
    // Either identifier works: `defectTypeId` is what the UI sends, `defectType`
    // (the name) keeps hand-written curl calls and the original brief readable.
    defectTypeId: z.coerce.number().int().positive().optional(),
    defectType: z.string().trim().min(1).optional(),
    severity: z.enum(SEVERITIES, { error: 'Select a severity' }),
    remarks: z.string().trim().max(1000, 'Remarks must be 1000 characters or fewer').optional().nullable(),
  })
  .refine((v) => v.defectTypeId !== undefined || v.defectType !== undefined, {
    message: 'Provide either defectTypeId or defectType',
    path: ['defectTypeId'],
  })
  .refine((v) => v.inspectedOn <= todayLocalIso(), {
    message: 'Inspection date cannot be in the future',
    path: ['inspectedOn'],
  });

export const resolveInspectionSchema = z.object({
  resolutionNote: z
    .string({ error: 'A resolution note is required' })
    .trim()
    .min(1, 'A resolution note is required')
    .max(1000, 'Resolution note must be 1000 characters or fewer'),
});

export const listQuerySchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    severity: enumList(SEVERITIES),
    defectTypeId: idList,
    machineId: z.string().trim().max(60).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    sort: z.enum(['inspectedOn', 'severity', 'status', 'machineId', 'createdAt']).default('inspectedOn'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

export const summaryQuerySchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

// ---------------------------------------------------------------------------
// Defect types
// ---------------------------------------------------------------------------

export const createDefectTypeSchema = z.object({
  name: trimmed('Name', 60),
  // Derived from the name when omitted, so the UI can offer a single field.
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may contain only letters, numbers, hyphens and underscores')
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateDefectTypeSchema = z
  .object({
    name: trimmed('Name', 60).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const defectTypeQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

// ---------------------------------------------------------------------------
// Auth + SAP
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  username: trimmed('Username', 60),
  password: z.string().min(1, 'Password is required').max(200),
});

/** Deliberately permissive: a real integration must not drop messages. */
export const sapWebhookSchema = z.object({
  NotificationNo: z
    .union([z.string(), z.number()], { error: 'NotificationNo is required' })
    .transform(String)
    .pipe(z.string().trim().min(1, 'NotificationNo is required').max(60)),
  PlantSection: trimmed('PlantSection', 60),
  DefectCode: z.string().trim().max(40).optional(),
  Priority: z.union([z.string(), z.number()]).transform(String).optional(),
  NotificationDate: isoDate.optional(),
  ShortText: z.string().trim().max(1000).optional(),
});

export type CreateInspectionInput = z.output<typeof createInspectionSchema>;
export type ResolveInspectionInput = z.output<typeof resolveInspectionSchema>;
export type ListQuery = z.output<typeof listQuerySchema>;
export type SummaryQuery = z.output<typeof summaryQuerySchema>;
export type CreateDefectTypeInput = z.output<typeof createDefectTypeSchema>;
export type UpdateDefectTypeInput = z.output<typeof updateDefectTypeSchema>;
export type SapWebhookInput = z.output<typeof sapWebhookSchema>;
