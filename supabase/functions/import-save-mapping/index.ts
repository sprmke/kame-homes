/**
 * import-save-mapping — Persist user-confirmed column mapping for an import batch.
 * POST { batchId, columnMapping: { [rawHeader]: targetFieldId | null } }
 * Auth: resolveImportAccess. Batch must be in mapped/uploaded/mapping/previewed status.
 * Saving from previewed resets to mapped so preview must re-run.
 */

import { resolveImportAccessWithPlan } from '../_shared/importAccess.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import { isBookingImportTargetFieldId } from '../_shared/importTargetSchemas.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

/** Statuses that allow saving/overwriting a column mapping. */
const ALLOWED_STATUSES: ReadonlyArray<ImportBatchStatus> = [
  'uploaded',
  'mapping',
  'mapped',
  'previewed',
];

type ColumnMappingInput = Record<string, string | null>;

function validateColumnMapping(raw: unknown): ColumnMappingInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const mapping = raw as Record<string, unknown>;
  for (const [, value] of Object.entries(mapping)) {
    if (value !== null && typeof value !== 'string') return null;
    if (typeof value === 'string' && !isBookingImportTargetFieldId(value)) return null;
  }
  return mapping as ColumnMappingInput;
}

serveAuthenticated('import-save-mapping', async (req) => {
  requireHttpMethod(req, 'POST');

  const access = await resolveImportAccessWithPlan(req);
  const body = await readJsonBody(req);

  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  if (!batchId) return jsonError(req, 'batchId is required');

  const columnMapping = validateColumnMapping(body.columnMapping);
  if (!columnMapping) {
    return jsonError(
      req,
      'columnMapping must be an object mapping raw headers to valid target field ids or null'
    );
  }

  const supabase = createServiceClient();

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status, column_mapping')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) {
    console.error('[import-save-mapping] batch load failed:', batchError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) return jsonError(req, 'Import batch not found', 404);
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '');
  if (!isImportBatchStatus(status)) return jsonError(req, 'Import batch has an invalid status');
  if (!ALLOWED_STATUSES.includes(status as ImportBatchStatus)) {
    return jsonError(req, `Cannot save mapping while batch status is ${status}`);
  }

  // Merge with existing AI mapping if present, updating only provided entries.
  const existingMapping = (batch.column_mapping as Record<string, unknown> | null) ?? {};
  const existingMappings = Array.isArray((existingMapping as { mappings?: unknown }).mappings)
    ? (existingMapping as { mappings: Array<Record<string, unknown>> }).mappings
    : [];

  // Build updated mappings list: update suggestedTarget from user overrides.
  const updatedMappings = existingMappings.map((entry: Record<string, unknown>) => {
    const rawHeader = String(entry.rawHeader ?? '');
    if (rawHeader in columnMapping) {
      return {
        ...entry,
        suggestedTarget: columnMapping[rawHeader],
        status: columnMapping[rawHeader] === null ? 'skipped' : 'confirmed',
        userOverride: true,
      };
    }
    return entry;
  });

  // Add any headers not present in existing mappings.
  for (const [rawHeader, target] of Object.entries(columnMapping)) {
    const exists = updatedMappings.some((e: Record<string, unknown>) => e.rawHeader === rawHeader);
    if (!exists) {
      updatedMappings.push({
        rawHeader,
        suggestedTarget: target,
        status: target === null ? 'skipped' : 'confirmed',
        reason: 'manual',
        userOverride: true,
      });
    }
  }

  const updatedColumnMapping = {
    ...(existingMapping as object),
    mappings: updatedMappings,
    lastSavedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('import_batches')
    .update({
      column_mapping: updatedColumnMapping,
      status: 'mapped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .in('status', [...ALLOWED_STATUSES]);

  if (updateError) {
    console.error('[import-save-mapping] update failed:', updateError.message);
    return jsonError(req, 'Failed to save mapping');
  }

  console.log(`[import-save-mapping] batch ${batchId} mapping saved by ${access.user.email}`);

  return jsonSuccess(req, { batchId, status: 'mapped' });
});
