/**
 * Import batch types — client-side shapes for import batches and AI mapping results.
 * Sync with importTargetSchemas.ts (server) and importBatchWorkflow.ts.
 */

import type { ImportBatchStatus } from '@/features/dashboard/import/lib/importBatchWorkflow';

// ── AI mapping response shapes ────────────────────────────────────────────────

export type ImportColumnMappingStatus =
  'matched' | 'likely_matched' | 'ambiguous' | 'unmatched' | 'skipped' | 'confirmed';

export type ImportColumnMappingEntry = {
  rawHeader: string;
  suggestedTarget: string | null;
  status: ImportColumnMappingStatus;
  reason: string;
  userOverride?: boolean;
};

export type ImportColumnMapping = {
  version: number;
  generatedAt: string;
  provider: 'gemini' | 'groq' | 'none';
  degraded: boolean;
  mappings: ImportColumnMappingEntry[];
  lastSavedAt?: string;
};

export type AiMapColumnsResult = {
  batchId: string;
  status: ImportBatchStatus;
  columnMapping: ImportColumnMapping;
  summary: {
    matched: number;
    needsReview: number;
    total: number;
  };
  degraded: boolean;
  provider: 'gemini' | 'groq' | 'none';
};

// ── Batch record ──────────────────────────────────────────────────────────────

export type ImportBatch = {
  id: string;
  status: ImportBatchStatus;
  original_file_name: string;
  row_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  column_mapping: ImportColumnMapping | null;
};

export type ImportBatchListResult = {
  batches: ImportBatch[];
  total: number;
  page: number;
  limit: number;
};

// ── Preview & validation ──────────────────────────────────────────────────────

export type ImportValidationSeverity = 'error' | 'warning';

export type ImportValidationError = {
  field?: string;
  code: string;
  message: string;
  severity: ImportValidationSeverity;
  /** Source cell value that failed validation. */
  value?: string | null;
};

export type ImportBatchRowPreview = {
  id: string;
  rowIndex: number;
  mappedData: Record<string, string | null>;
  validationStatus: 'valid' | 'error' | 'skipped';
  validationErrors: ImportValidationError[];
};

export type ImportPreviewSummary = {
  total: number;
  valid: number;
  error: number;
  skipped: number;
  warning: number;
};

export type ImportPreviewResult = {
  batchId: string;
  status: ImportBatchStatus;
  summary: ImportPreviewSummary;
  rows: ImportBatchRowPreview[];
};
