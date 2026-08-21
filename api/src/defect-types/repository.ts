import type { Db } from '../db/client.ts';
import { nowIso } from '../lib/dates.ts';
import type { CreateDefectTypeInput, UpdateDefectTypeInput } from '../domain/schemas.ts';

export interface DefectTypeRow {
  id: number;
  name: string;
  code: string;
  is_active: number;
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DefectType {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  /** Inspections referencing this type. Drives "can it be deleted?" in the UI. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const SELECT_WITH_USAGE = `
  SELECT d.*, (SELECT COUNT(*) FROM inspections i WHERE i.defect_type_id = d.id) AS usage_count
  FROM defect_types d
`;

type RowWithUsage = DefectTypeRow & { usage_count: number };

export function toDefectType(row: RowWithUsage): DefectType {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active === 1,
    isSystem: row.is_system === 1,
    sortOrder: row.sort_order,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDefectTypeRepository(db: Db) {
  return {
    list(includeInactive: boolean): DefectType[] {
      const where = includeInactive ? '' : 'WHERE d.is_active = 1';
      const rows = db.all<RowWithUsage>(`${SELECT_WITH_USAGE} ${where} ORDER BY d.sort_order, d.name`);
      return rows.map(toDefectType);
    },

    findById(id: number): DefectType | undefined {
      const row = db.get<RowWithUsage>(`${SELECT_WITH_USAGE} WHERE d.id = ?`, [id]);
      return row && toDefectType(row);
    },

    findByCode(code: string): DefectType | undefined {
      const row = db.get<RowWithUsage>(`${SELECT_WITH_USAGE} WHERE d.code = ?`, [code]);
      return row && toDefectType(row);
    },

    findByName(name: string): DefectType | undefined {
      const row = db.get<RowWithUsage>(`${SELECT_WITH_USAGE} WHERE d.name = ?`, [name]);
      return row && toDefectType(row);
    },

    create(input: CreateDefectTypeInput & { code: string }): DefectType {
      const { lastInsertRowid } = db.run(
        `INSERT INTO defect_types (name, code, sort_order) VALUES (?, ?, ?)`,
        [input.name, input.code, input.sortOrder ?? 100],
      );
      return this.findById(lastInsertRowid)!;
    },

    update(id: number, input: UpdateDefectTypeInput): DefectType | undefined {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (input.name !== undefined) {
        sets.push('name = ?');
        params.push(input.name);
      }
      if (input.isActive !== undefined) {
        sets.push('is_active = ?');
        params.push(input.isActive ? 1 : 0);
      }
      if (input.sortOrder !== undefined) {
        sets.push('sort_order = ?');
        params.push(input.sortOrder);
      }

      sets.push('updated_at = ?');
      params.push(nowIso(), id);

      db.run(`UPDATE defect_types SET ${sets.join(', ')} WHERE id = ?`, params);
      return this.findById(id);
    },

    delete(id: number): void {
      db.run('DELETE FROM defect_types WHERE id = ?', [id]);
    },
  };
}

export type DefectTypeRepository = ReturnType<typeof createDefectTypeRepository>;
