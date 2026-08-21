import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';
import type { DefectTypeRepository } from '../defect-types/repository.ts';
import { FALLBACK_DEFECT_CODE, type Severity } from '../domain/constants.ts';
import { sapWebhookSchema, type SapWebhookInput } from '../domain/schemas.ts';
import { ApiError } from '../middleware/errors.ts';
import { todayLocalIso } from '../lib/dates.ts';
import { created, ok } from '../lib/respond.ts';
import type { InspectionRepository } from '../inspections/repository.ts';

/** SAP notification priority -> our severity vocabulary. */
const PRIORITY_TO_SEVERITY: Record<string, Severity> = {
  '1': 'Critical',
  '2': 'Major',
  '3': 'Minor',
};

function secretMatches(expectedSecret: string, provided: string): boolean {
  const expected = Buffer.from(expectedSecret);
  const actual = Buffer.from(provided);
  // timingSafeEqual throws on a length mismatch, so guard before comparing.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

interface Deps {
  inspections: InspectionRepository;
  defectTypes: DefectTypeRepository;
  /** Empty string leaves the endpoint open. See config.sap.webhookSecret. */
  secret?: string;
}

/**
 * Mock SAP inbound integration. Payload shape is documented in docs/API.md.
 *
 * Two properties matter more than the mapping itself:
 *  - It never drops a message. An unrecognised DefectCode lands in "Other"
 *    with the original code preserved in the remarks rather than 422-ing.
 *  - It is idempotent. SAP retries; replaying the same NotificationNo returns
 *    200 with the record already created instead of 201 and a duplicate row.
 */
export function createSapRoutes({ inspections, defectTypes, secret = config.sap.webhookSecret }: Deps): Router {
  const router = Router();

  router.post('/sap-webhook', (req, res) => {
    // Open unless a secret is configured: the endpoint as specified takes a
    // JSON body and nothing else, and a shared secret is a deployment choice
    // rather than part of its contract.
    if (secret) {
      const provided = req.get('x-sap-secret');
      if (!provided || !secretMatches(secret, provided)) {
        throw ApiError.unauthorized('Invalid or missing X-SAP-Secret header');
      }
    }

    const payload: SapWebhookInput = sapWebhookSchema.parse(req.body ?? {});

    const existing = inspections.findByExternalRef(payload.NotificationNo);
    if (existing) {
      ok(res, existing);
      return;
    }

    const matched = payload.DefectCode ? defectTypes.findByCode(payload.DefectCode) : undefined;
    const defectType = matched?.isActive ? matched : defectTypes.findByCode(FALLBACK_DEFECT_CODE)!;

    const notes = [payload.ShortText?.trim(), `SAP notification ${payload.NotificationNo}`];
    if (payload.DefectCode && !matched) notes.push(`Unmapped SAP defect code: ${payload.DefectCode}`);

    const inspection = inspections.create({
      inspectedOn: payload.NotificationDate ?? todayLocalIso(),
      machineId: payload.PlantSection,
      defectTypeId: defectType.id,
      severity: PRIORITY_TO_SEVERITY[payload.Priority ?? ''] ?? 'Major',
      remarks: notes.filter(Boolean).join(' | '),
      source: 'sap',
      externalRef: payload.NotificationNo,
    });

    created(res, inspection, `/api/inspections/${inspection.id}`);
  });

  return router;
}
