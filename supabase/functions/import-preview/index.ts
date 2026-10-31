/**
 * import-preview — Apply column mapping, validate rows, transition batch → previewed.
 * POST { batchId } or GET ?batchId=<id>
 * Auth: resolveImportAccess.
 */

import { resolveImportAccessWithPlan } from '../_shared/importAccess.ts';
import {
  canImportBatchTransition,
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import { IMPORT_ROW_INSERT_CHUNK_SIZE } from '../_shared/importUploadLimits.ts';
import {
  buildHeaderToTargetMap,
  previewImportRow,
  summarizeImportPreview,
  type ImportRowPreviewOutput,
} from '../_shared/importPreviewService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const PREVIEW_ALLOWED_STATUSES: ReadonlyArray<ImportBatchStatus> = [
  'mapped',
  'previewing',
  'previewed',
];

type ImportBatchRowRecord = {
  id: string;
  row_index: number;
  raw_data: Record<string, string>;
  validation_status: string;
};

function chunkRecords<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function transitionBatchStatus(
  supabase: ReturnType<typeof createServiceClient>,
  batchId: string,
  from: ImportBatchStatus,
  to: ImportBatchStatus
): Promise<boolean> {
  if (!canImportBatchTransition(from, to)) {
    throw new Error(`Invalid import batch transition: ${from} → ${to}`);
  }

  const { data, error } = await supabase
    .from('import_batches')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .eq('status', from)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function persistPreviewRows(
  supabase: ReturnType<typeof createServiceClient>,
  rows: ImportRowPreviewOutput[]
): Promise<string | null> {
  for (const chunk of chunkRecords(rows, IMPORT_ROW_INSERT_CHUNK_SIZE)) {
    for (const row of chunk) {
      const { error } = await supabase
        .from('import_batch_rows')
        .update({
          mapped_data: row.mapped_data,
          resolved_property_id: row.resolved_property_id,
          validation_status: row.validation_status,
          validation_errors: row.validation_errors,
        })
        .eq('id', row.id);

      if (error) return error.message;
    }
  }
  return null;
}

function readBatchId(req: Request, body: Record<string, unknown>): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('batchId')?.trim();
  if (fromQuery) return fromQuery;
  return typeof body.batchId === 'string' ? body.batchId.trim() : '';
}

serveAuthenticated('import-preview', async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const access = await resolveImportAccessWithPlan(req);
  const body = req.method === 'POST' ? await readJsonBody(req) : {};
  const batchId = readBatchId(req, body);
  if (!batchId) return jsonError(req, 'batchId is required');

  const supabase = createServiceClient();

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status, column_mapping')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) {
    console.error('[import-preview] batch load failed:', batchError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) return jsonError(req, 'Import batch not found', 404);
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '');
  if (!isImportBatchStatus(status)) return jsonError(req, 'Import batch has an invalid status');
  if (!PREVIEW_ALLOWED_STATUSES.includes(status as ImportBatchStatus)) {
    return jsonError(req, `Cannot preview while batch status is ${status}`);
  }
  if (!batch.column_mapping) {
    return jsonError(req, 'Column mapping is required before preview');
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, name, tower_and_unit')
    .eq('id', batch.property_id)
    .maybeSingle();

  if (propertyError || !property) {
    console.error('[import-preview] property load failed:', propertyError?.message);
    return jsonError(req, 'Failed to load target property');
  }

  if (status === 'mapped') {
    const moved = await transitionBatchStatus(supabase, batchId, 'mapped', 'previewing');
    if (!moved) {
      const { data: refreshed } = await supabase
        .from('import_batches')
        .select('status')
        .eq('id', batchId)
        .maybeSingle();
      const refreshedStatus = String(refreshed?.status ?? '');
      if (refreshedStatus !== 'previewing' && refreshedStatus !== 'previewed') {
        return jsonError(req, 'Import batch status changed — retry preview');
      }
    }
  }

  const { data: rawRows, error: rowsError } = await supabase
    .from('import_batch_rows')
    .select('id, row_index, raw_data, validation_status')
    .eq('batch_id', batchId)
    .order('row_index', { ascending: true });

  if (rowsError) {
    console.error('[import-preview] rows load failed:', rowsError.message);
    return jsonError(req, 'Failed to load import rows');
  }

  const headerToTarget = buildHeaderToTargetMap(batch.column_mapping);
  const previewRows = (rawRows ?? []).map((row) =>
    previewImportRow(
      row as ImportBatchRowRecord,
      headerToTarget,
      batch.property_id,
      typeof property.tower_and_unit === 'string' ? property.tower_and_unit : null,
      typeof property.name === 'string' ? property.name : null,
      true
    )
  );

  const persistError = await persistPreviewRows(supabase, previewRows);
  if (persistError) {
    console.error('[import-preview] row persist failed:', persistError);
    await supabase
      .from('import_batches')
      .update({ status: 'failed', error: persistError, updated_at: new Date().toISOString() })
      .eq('id', batchId)
      .in('status', ['previewing', 'mapped']);
    return jsonError(req, 'Failed to save preview results');
  }

  const { error: batchUpdateError } = await supabase
    .from('import_batches')
    .update({ status: 'previewed', updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .in('status', ['previewing', 'previewed']);

  if (batchUpdateError) {
    console.error('[import-preview] batch finalize failed:', batchUpdateError.message);
    return jsonError(req, 'Failed to finalize preview');
  }

  const summary = summarizeImportPreview(previewRows);

  console.log(
    `[import-preview] batch ${batchId} — ${summary.valid} valid, ${summary.error} error, ${summary.skipped} skipped`
  );

  return jsonSuccess(req, {
    batchId,
    status: 'previewed',
    summary,
    rows: previewRows.map((row) => ({
      id: row.id,
      rowIndex: row.row_index,
      mappedData: row.mapped_data,
      validationStatus: row.validation_status,
      validationErrors: row.validation_errors,
    })),
  });
});
