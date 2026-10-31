/**
 * import-commit — Commit a previewed import batch into guest_submissions.
 *
 * POST { batchId }
 * Auth: resolveImportAccess.
 *
 * SIDE-EFFECT BYPASS: This function inserts directly into guest_submissions
 * without routing through workflowOrchestrator. Past check-ins get status IMPORTED;
 * today/future check-ins get PENDING_REVIEW (imported_from_batch_id set on all).
 * No calendar, email, or PDF side effects on insert — bypass safe by design.
 * Never call workflowOrchestrator.transition here.
 */

import { importCommitStatusForCheckIn } from '../_shared/importCommitStatus.ts';
import { resolveImportAccessWithPlan } from '../_shared/importAccess.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import {
  BOOKING_IMPORT_TARGET_FIELDS,
  dbColumnForImportTarget,
} from '../_shared/importTargetSchemas.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

/** previewed = normal path; failed = retry after a prior commit attempt inserted nothing. */
const COMMIT_ALLOWED_STATUSES: ReadonlyArray<ImportBatchStatus> = ['previewed', 'failed'];

/** Known boolean columns — 'Yes'/'No' strings → true/false for Postgres. */
const BOOLEAN_FIELD_IDS = new Set(
  BOOKING_IMPORT_TARGET_FIELDS.filter((f) => f.type === 'boolean').map((f) => f.id)
);

/** Known integer columns — parse strings to integers. */
const INTEGER_FIELD_IDS = new Set(
  BOOKING_IMPORT_TARGET_FIELDS.filter((f) => f.type === 'integer').map((f) => f.id)
);

/** Known decimal columns — parse strings to floats. */
const DECIMAL_FIELD_IDS = new Set(
  BOOKING_IMPORT_TARGET_FIELDS.filter((f) => f.type === 'decimal').map((f) => f.id)
);

/** Valid mapped_data field ids that map 1-to-1 to guest_submissions columns. */
const ALLOWED_FIELD_IDS = new Set(BOOKING_IMPORT_TARGET_FIELDS.map((f) => f.id));

type CommitFailure = { rowIndex: number; reason: string };

/**
 * Convert a mapped_data record (all strings) into typed guest_submissions values.
 * Only allows fields in BOOKING_IMPORT_TARGET_FIELDS — no other columns are written.
 */
function buildSubmissionRow(
  mappedData: Record<string, string | null>,
  propertyId: string,
  batchId: string,
  now: string
): Record<string, unknown> {
  const commitStatus = importCommitStatusForCheckIn(mappedData.check_in_date);

  const row: Record<string, unknown> = {
    property_id: propertyId,
    status: commitStatus,
    imported_from_batch_id: batchId,
    status_updated_at: now,
  };

  for (const [fieldId, rawValue] of Object.entries(mappedData)) {
    if (!ALLOWED_FIELD_IDS.has(fieldId)) continue;
    if (rawValue === null || rawValue === '') continue;

    const column = dbColumnForImportTarget(fieldId);

    if (BOOLEAN_FIELD_IDS.has(fieldId)) {
      row[column] = rawValue.toLowerCase() === 'yes';
    } else if (INTEGER_FIELD_IDS.has(fieldId)) {
      const parsed = Number.parseInt(rawValue.replace(/,/g, ''), 10);
      if (Number.isFinite(parsed)) row[column] = parsed;
    } else if (DECIMAL_FIELD_IDS.has(fieldId)) {
      const parsed = Number.parseFloat(rawValue.replace(/,/g, ''));
      if (Number.isFinite(parsed)) row[column] = parsed;
    } else {
      row[column] = rawValue;
    }
  }

  return row;
}

serveAuthenticated('import-commit', async (req) => {
  requireHttpMethod(req, 'POST');

  const access = await resolveImportAccessWithPlan(req);
  const body = await readJsonBody(req);

  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  if (!batchId) return jsonError(req, 'batchId is required');

  const supabase = createServiceClient();

  // Load and validate batch.
  const { data: batch, error: batchLoadError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status')
    .eq('id', batchId)
    .maybeSingle();

  if (batchLoadError) {
    console.error('[import-commit] batch load failed:', batchLoadError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) return jsonError(req, 'Import batch not found', 404);
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '') as ImportBatchStatus;
  if (!isImportBatchStatus(status)) return jsonError(req, 'Import batch has an invalid status');
  if (!COMMIT_ALLOWED_STATUSES.includes(status)) {
    return jsonError(req, `Cannot commit batch with status ${status}`);
  }

  // Transition → committing (optimistic lock; already committing is also OK for idempotency).
  const { error: commitStartError } = await supabase
    .from('import_batches')
    .update({ status: 'committing', updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .in('status', ['previewed', 'committing', 'failed']);

  if (commitStartError) {
    console.error('[import-commit] failed to start commit:', commitStartError.message);
    return jsonError(req, 'Failed to start commit');
  }

  // Load uncommitted valid rows (idempotent: skip rows already inserted).
  const { data: rows, error: rowsError } = await supabase
    .from('import_batch_rows')
    .select('id, row_index, mapped_data, committed_row_id')
    .eq('batch_id', batchId)
    .eq('validation_status', 'valid')
    .is('committed_row_id', null)
    .order('row_index', { ascending: true });

  if (rowsError) {
    console.error('[import-commit] rows load failed:', rowsError.message);
    await supabase
      .from('import_batches')
      .update({ status: 'failed', error: rowsError.message, updated_at: new Date().toISOString() })
      .eq('id', batchId);
    return jsonError(req, 'Failed to load rows for commit');
  }

  const propertyId = String(batch.property_id);
  const now = new Date().toISOString();

  let inserted = 0;
  let skipped = 0;
  const failed: CommitFailure[] = [];

  for (const row of rows ?? []) {
    const mappedData = (row.mapped_data ?? {}) as Record<string, string | null>;
    const rowIndex = Number(row.row_index);

    const submissionRow = buildSubmissionRow(mappedData, propertyId, batchId, now);

    // Insert the guest submission directly — no orchestrator, no side effects.
    const { data: inserted_row, error: insertError } = await supabase
      .from('guest_submissions')
      .insert(submissionRow)
      .select('id')
      .single();

    if (insertError) {
      console.error(`[import-commit] row ${rowIndex} insert failed:`, insertError.message);

      // Record insert failure in validation_errors for visibility in UI.
      await supabase
        .from('import_batch_rows')
        .update({
          validation_errors: [
            { field: null, code: 'insert_failed', message: insertError.message, severity: 'error' },
          ],
        })
        .eq('id', row.id);

      failed.push({ rowIndex, reason: insertError.message });
      continue;
    }

    // Mark row as committed with the new submission id.
    await supabase
      .from('import_batch_rows')
      .update({ committed_row_id: inserted_row.id })
      .eq('id', row.id);

    inserted += 1;
  }

  // Count pre-skipped rows (valid but already committed — were committed_row_id IS NOT NULL).
  const { count: alreadyCommittedCount } = await supabase
    .from('import_batch_rows')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('validation_status', 'valid')
    .not('committed_row_id', 'is', null);

  skipped = alreadyCommittedCount ?? 0;

  const attemptedCount = (rows ?? []).length;

  // Finalize: committed only when rows were inserted this run, or all valid rows were
  // already committed from a prior partial run. Do not mark committed when nothing new
  // was inserted and attempts failed — that would block retry incorrectly.
  let finalStatus: ImportBatchStatus;
  let committedAt: string | null = null;
  let batchError: string | null = null;

  if (inserted > 0 || (inserted === 0 && skipped > 0 && failed.length === 0)) {
    finalStatus = 'committed';
    committedAt = now;
  } else if (inserted === 0 && failed.length > 0) {
    finalStatus = 'failed';
    batchError = `${failed.length} row(s) failed to insert`;
  } else if (attemptedCount === 0 && skipped === 0) {
    // No valid uncommitted rows and none already committed — nothing to commit; keep preview open.
    finalStatus = 'previewed';
  } else {
    finalStatus = 'failed';
    batchError = 'Commit produced no inserts';
  }

  const { error: finalizeError } = await supabase
    .from('import_batches')
    .update({
      status: finalStatus,
      committed_at: committedAt,
      error: batchError,
      updated_at: now,
    })
    .eq('id', batchId);

  if (finalizeError) {
    console.error('[import-commit] batch finalize failed:', finalizeError.message);
    // Don't return an error — row inserts may have succeeded; caller inspects finalStatus.
  }

  console.log(
    `[import-commit] batch ${batchId} — status=${finalStatus}, inserted=${inserted}, skipped=${skipped}, failed=${failed.length}`
  );

  if (inserted > 0) {
    // One summary row for the whole batch — never one per imported booking.
    await logActivity({
      action: 'booking.bulk_imported',
      organizationId: access.orgId,
      propertyId: access.propertyId,
      actor: buildActorContext('dashboard', { propertyAccess: access }, req),
      targetType: 'property',
      targetId: access.propertyId,
      targetLabel: access.property?.name ?? null,
      metadata: { batch_id: batchId, count: inserted, skipped, failed: failed.length },
    });
  }

  return jsonSuccess(req, {
    batchId,
    status: finalStatus,
    inserted,
    skipped,
    failed,
  });
});
