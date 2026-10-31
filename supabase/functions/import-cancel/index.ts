/**
 * import-cancel — Delete an import batch (rows + storage) before it is committed.
 * POST { batchId }
 * Auth: resolveImportAccess. Blocked if status is committed/committing/reverting/reverted.
 */

import { resolveImportAccess } from '../_shared/importAccess.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import { IMPORT_UPLOAD_BUCKET } from '../_shared/importUploadLimits.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

/** Statuses that cannot be cancelled (already in flight or terminal). */
const BLOCKED_STATUSES: ReadonlyArray<ImportBatchStatus> = [
  'committed',
  'committing',
  'reverting',
  'reverted',
];

serveAuthenticated('import-cancel', async (req) => {
  requireHttpMethod(req, 'POST');

  const access = await resolveImportAccess(req);
  const body = await readJsonBody(req);

  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  if (!batchId) return jsonError(req, 'batchId is required');

  const supabase = createServiceClient();

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status, storage_path')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) {
    console.error('[import-cancel] batch load failed:', batchError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) return jsonError(req, 'Import batch not found', 404);
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '');
  if (!isImportBatchStatus(status)) return jsonError(req, 'Import batch has an invalid status');
  if (BLOCKED_STATUSES.includes(status as ImportBatchStatus)) {
    return jsonError(req, `Cannot cancel batch with status ${status}`);
  }

  // Delete storage object if present (best-effort — don't fail if already gone).
  const storagePath = typeof batch.storage_path === 'string' ? batch.storage_path : null;
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(IMPORT_UPLOAD_BUCKET)
      .remove([storagePath]);
    if (storageError) {
      console.warn('[import-cancel] storage removal warning:', storageError.message);
    }
  }

  // Delete batch (cascades to import_batch_rows via FK).
  const { error: deleteError } = await supabase.from('import_batches').delete().eq('id', batchId);

  if (deleteError) {
    console.error('[import-cancel] batch delete failed:', deleteError.message);
    return jsonError(req, 'Failed to cancel import batch');
  }

  console.log(`[import-cancel] batch ${batchId} cancelled by ${access.user.email}`);

  return jsonSuccess(req, { batchId, cancelled: true });
});
