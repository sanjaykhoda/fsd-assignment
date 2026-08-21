import { Router } from 'express';
import { createDefectTypeSchema, defectTypeQuerySchema, updateDefectTypeSchema } from '../domain/schemas.ts';
import { ApiError } from '../middleware/errors.ts';
import { parseIdParam } from '../lib/params.ts';
import { created, noContent, ok } from '../lib/respond.ts';
import type { DefectTypeRepository } from './repository.ts';

/** 'Weave Defect' -> 'WEAVE_DEFECT'. Only used when the caller omits a code. */
function deriveCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}

export function createDefectTypeRoutes(defectTypes: DefectTypeRepository): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const { includeInactive } = defectTypeQuerySchema.parse(req.query);
    ok(res, defectTypes.list(includeInactive));
  });

  router.post('/', (req, res) => {
    const input = createDefectTypeSchema.parse(req.body ?? {});
    const code = input.code ?? deriveCode(input.name);

    if (!code) {
      throw ApiError.validation('Could not derive a code from that name', [
        { field: 'code', message: 'Provide a code explicitly' },
      ]);
    }
    // Checked up front so the caller gets a clear 409 instead of a raw
    // UNIQUE-constraint failure surfacing as a 500.
    const nameClash = defectTypes.findByName(input.name);
    if (nameClash) {
      throw ApiError.conflict('DUPLICATE', `A defect type named "${nameClash.name}" already exists`);
    }
    if (defectTypes.findByCode(code)) {
      throw ApiError.conflict('DUPLICATE', `A defect type with code "${code}" already exists`);
    }

    const defectType = defectTypes.create({ ...input, code });
    created(res, defectType, `/api/defect-types/${defectType.id}`);
  });

  router.patch('/:id', (req, res) => {
    const id = parseIdParam(req.params.id, 'Defect type');
    const existing = defectTypes.findById(id);
    if (!existing) throw ApiError.notFound('Defect type');

    const input = updateDefectTypeSchema.parse(req.body ?? {});

    // The five types from the brief are referenced by the SAP code map and by
    // seeded history, so they can be reordered but not renamed or retired.
    if (existing.isSystem && (input.name !== undefined || input.isActive === false)) {
      throw ApiError.validation('Built-in defect types cannot be renamed or deactivated', [
        { field: 'id', message: `"${existing.name}" is a built-in type` },
      ]);
    }
    if (input.name !== undefined) {
      const clash = defectTypes.findByName(input.name);
      if (clash && clash.id !== id) {
        throw ApiError.conflict('DUPLICATE', `A defect type named "${clash.name}" already exists`);
      }
    }

    ok(res, defectTypes.update(id, input)!);
  });

  /**
   * Hard delete only while a type is unused. Once inspections reference it,
   * deleting would rewrite history, so the caller is told to deactivate
   * instead -- inactive types stay readable on old records but disappear from
   * the new-inspection dropdown.
   */
  router.delete('/:id', (req, res) => {
    const id = parseIdParam(req.params.id, 'Defect type');
    const existing = defectTypes.findById(id);
    if (!existing) throw ApiError.notFound('Defect type');

    if (existing.isSystem) {
      throw ApiError.conflict('IN_USE', `"${existing.name}" is a built-in defect type and cannot be deleted`);
    }
    if (existing.usageCount > 0) {
      throw ApiError.conflict(
        'IN_USE',
        `"${existing.name}" is used by ${existing.usageCount} inspection(s). Deactivate it instead to keep history intact.`,
      );
    }

    defectTypes.delete(id);
    noContent(res);
  });

  return router;
}
