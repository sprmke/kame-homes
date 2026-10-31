/**
 * import-update-row — Toggle row skip/include, patch field values, or re-validate a single row.
 * POST { batchId, rowId, validationStatus: 'skipped' | 'valid' }
 * POST { batchId, rowId, fieldValues: Record<string, string> }
 * Auth: resolveImportAccess. Batch must be previewed/previewing.
 */

import { resolveImportAccessWithPlan } from '../_shared/importAccess.ts';
import {
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import {
  applyFieldValuePatches,
  buildHeaderToTargetMap,
  buildTargetToHeaderMap,
  previewImportRow,
  summarizeImportPreview,
  type ImportValidationError,
} from '../_shared/importPreviewService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const UPDATE_ALLOWED_STATUSES: ReadonlyArray<ImportBatchStatus> = ['previewing', 'previewed'];

function parseFieldValues(body: Record<string, unknown>): Record<string, string> | null {
  const raw = body.fieldValues;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const fieldValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key.trim()) continue;
    if (typeof value !== 'string') {
      return null;
    }
    fieldValues[key.trim()] = value;
  }
  return Object.keys(fieldValues).length > 0 ? fieldValues : null;
}

function blockingErrorFields(errors: ImportValidationError[]): Set<string> {
  return new Set(
    errors
      .filter((entry) => entry.severity === 'error' && entry.field)
      .map((entry) => entry.field as string)
  );
}

serveAuthenticated('import-update-row', async (req) => {
  requireHttpMethod(req, 'POST');

  const access = await resolveImportAccessWithPlan(req);
  const body = await readJsonBody(req);

  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  const rowId = typeof body.rowId === 'string' ? body.rowId.trim() : '';
  const validationStatus =
    body.validationStatus === 'skipped' || body.validationStatus === 'valid'
      ? body.validationStatus
      : null;
  const fieldValues = parseFieldValues(body as Record<string, unknown>);

  if (!batchId) return jsonError(req, 'batchId is required');
  if (!rowId) return jsonError(req, 'rowId is required');
  if (!validationStatus && !fieldValues) {
    return jsonError(req, "Provide validationStatus ('skipped' | 'valid') or fieldValues");
  }
  if (validationStatus && fieldValues) {
    return jsonError(req, 'Provide either validationStatus or fieldValues, not both');
  }

  const supabase = createServiceClient();

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status, column_mapping')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) {
    console.error('[import-update-row] batch load failed:', batchError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) return jsonError(req, 'Import batch not found', 404);
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '');
  if (!isImportBatchStatus(status)) return jsonError(req, 'Import batch has an invalid status');
  if (!UPDATE_ALLOWED_STATUSES.includes(status as ImportBatchStatus)) {
    return jsonError(req, `Cannot update rows while batch status is ${status}`);
  }

  const { data: row, error: rowError } = await supabase
    .from('import_batch_rows')
    .select('id, row_index, raw_data, validation_status, validation_errors, mapped_data')
    .eq('id', rowId)
    .eq('batch_id', batchId)
    .maybeSingle();

  if (rowError) {
    console.error('[import-update-row] row load failed:', rowError.message);
    return jsonError(req, 'Failed to load import row');
  }
  if (!row) return jsonError(req, 'Import row not found', 404);

  const headerToTarget = buildHeaderToTargetMap(batch.column_mapping);
  const targetToHeader = buildTargetToHeaderMap(batch.column_mapping);

  let nextRawData = (row.raw_data ?? {}) as Record<string, string>;
  let nextStatus: 'valid' | 'error' | 'skipped' = validationStatus ?? 'valid';
  let validationErrors: ImportValidationError[] = [];
  let mappedData: Record<string, string | null> = {};

  if (fieldValues) {
    const currentErrors = (
      Array.isArray(row.validation_errors) ? row.validation_errors : []
    ) as ImportValidationError[];
    const allowedFields = blockingErrorFields(currentErrors);

    for (const fieldId of Object.keys(fieldValues)) {
      if (!allowedFields.has(fieldId)) {
        return jsonError(req, `Field "${fieldId}" is not eligible for correction on this row`);
      }
      if (!targetToHeader.has(fieldId)) {
        return jsonError(req, `Field "${fieldId}" is not mapped in this import`);
      }
    }

    nextRawData = applyFieldValuePatches(nextRawData, targetToHeader, fieldValues);
  }

  if (validationStatus === 'skipped') {
    // Keep prior issues so Skipped rows stay reviewable in the Fix modal.
    const existingErrors = (
      Array.isArray(row.validation_errors) ? row.validation_errors : []
    ) as ImportValidationError[];
    mappedData = previewImportRow(
      {
        id: row.id,
        row_index: row.row_index,
        raw_data: nextRawData,
        validation_status: 'skipped',
      },
      headerToTarget,
      batch.property_id,
      null,
      null,
      false
    ).mapped_data;
    validationErrors = existingErrors;
    nextStatus = 'skipped';
  } else {
    const { data: property } = await supabase
      .from('properties')
      .select('name, tower_and_unit')
      .eq('id', batch.property_id)
      .maybeSingle();

    const preview = previewImportRow(
      {
        id: row.id,
        row_index: row.row_index,
        raw_data: nextRawData,
        validation_status: 'valid',
      },
      headerToTarget,
      batch.property_id,
      typeof property?.tower_and_unit === 'string' ? property.tower_and_unit : null,
      typeof property?.name === 'string' ? property.name : null,
      false
    );
    nextStatus = preview.validation_status;
    validationErrors = preview.validation_errors;
    mappedData = preview.mapped_data;
  }

  const updatePayload: Record<string, unknown> = {
    mapped_data: mappedData,
    resolved_property_id: batch.property_id,
    validation_status: nextStatus,
    validation_errors: validationErrors,
  };

  if (fieldValues) {
    updatePayload.raw_data = nextRawData;
  }

  const { error: updateError } = await supabase
    .from('import_batch_rows')
    .update(updatePayload)
    .eq('id', rowId)
    .eq('batch_id', batchId);

  if (updateError) {
    console.error('[import-update-row] update failed:', updateError.message);
    return jsonError(req, 'Failed to update import row');
  }

  const { data: allRows } = await supabase
    .from('import_batch_rows')
    .select('validation_status, validation_errors')
    .eq('batch_id', batchId);

  const summary = summarizeImportPreview(
    (allRows ?? []).map((entry, index) => ({
      id: String(index),
      row_index: index,
      mapped_data: {},
      resolved_property_id: batch.property_id,
      validation_status: (entry.validation_status ?? 'valid') as 'valid' | 'error' | 'skipped',
      validation_errors: (Array.isArray(entry.validation_errors)
        ? entry.validation_errors
        : []) as ImportValidationError[],
    }))
  );

  return jsonSuccess(req, {
    batchId,
    rowId,
    validationStatus: nextStatus,
    validationErrors,
    mappedData,
    summary,
  });
});
