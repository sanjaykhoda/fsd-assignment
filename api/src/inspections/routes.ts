import { Router } from 'express';
import type { DefectTypeRepository } from '../defect-types/repository.ts';
import { createInspectionSchema, listQuerySchema, resolveInspectionSchema, summaryQuerySchema } from '../domain/schemas.ts';
import { ApiError } from '../middleware/errors.ts';
import { parseIdParam } from '../lib/params.ts';
import { created, ok } from '../lib/respond.ts';
import type { InspectionRepository } from './repository.ts';

interface Deps {
  inspections: InspectionRepository;
  defectTypes: DefectTypeRepository;
}

export function createInspectionRoutes({ inspections, defectTypes }: Deps): Router {
  const router = Router();

  /**
   * Registered before '/:id' on purpose -- Express matches in order, so a
   * '/:id' route declared first would swallow '/summary' and 404 it.
   */
  router.get('/summary', (req, res) => {
    const query = summaryQuerySchema.parse(req.query);
    ok(res, inspections.summary(query));
  });

  router.get('/', (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { items, total } = inspections.list(query);

    ok(res, items, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  });

  router.post('/', (req, res) => {
    const input = createInspectionSchema.parse(req.body ?? {});

    // Accepts either identifier; the UI sends the id, hand-written calls and
    // the brief's own vocabulary send the name.
    const defectType =
      input.defectTypeId !== undefined
        ? defectTypes.findById(input.defectTypeId)
        : defectTypes.findByName(input.defectType!);

    if (!defectType) {
      throw ApiError.validation('Unknown defect type', [
        {
          field: input.defectTypeId !== undefined ? 'defectTypeId' : 'defectType',
          message: 'No defect type matches that value',
        },
      ]);
    }
    if (!defectType.isActive) {
      throw ApiError.validation('Defect type is inactive', [
        { field: 'defectTypeId', message: `"${defectType.name}" has been retired and cannot be used for new inspections` },
      ]);
    }

    const inspection = inspections.create({
      inspectedOn: input.inspectedOn,
      machineId: input.machineId,
      defectTypeId: defectType.id,
      severity: input.severity,
      remarks: input.remarks ?? null,
    });

    created(res, inspection, `/api/inspections/${inspection.id}`);
  });

  router.get('/:id', (req, res) => {
    const id = parseIdParam(req.params.id, 'Inspection');
    const inspection = inspections.findById(id);
    if (!inspection) throw ApiError.notFound('Inspection');

    ok(res, inspection);
  });

  /**
   * A named action rather than a general PATCH of `status`, because resolving
   * is a state transition with an invariant (note required, not repeatable),
   * not a field assignment. That is what gives 409 an unambiguous meaning here.
   */
  router.patch('/:id/resolve', (req, res) => {
    const id = parseIdParam(req.params.id, 'Inspection');
    const existing = inspections.findById(id);
    if (!existing) throw ApiError.notFound('Inspection');

    if (existing.status === 'Resolved') {
      throw ApiError.conflict('ALREADY_RESOLVED', `Inspection ${id} was already resolved on ${existing.resolvedAt}`);
    }

    const { resolutionNote } = resolveInspectionSchema.parse(req.body ?? {});
    ok(res, inspections.resolve(id, resolutionNote)!);
  });

  return router;
}
