export type Severity = 'Critical' | 'Major' | 'Minor';
export type Status = 'Open' | 'Resolved';
export type Source = 'manual' | 'sap';

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

export interface DefectType {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  usageCount: number;
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

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FieldError {
  field: string;
  message: string;
}
