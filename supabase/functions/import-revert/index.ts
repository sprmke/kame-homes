/**
 * import-revert — Cancel imported guest_submissions by reverting a committed batch.
 *
 * POST { batchId, dryRun?: boolean, includeMoved?: boolean }
 * Auth: resolveImportAccess.
 *
 * dryRun=true (default false): loads and analyses submissions, returns counts/warnings
 * WITHOUT changing any status. Safe to call before showing the confirm dialog.
 *
 * Default (dryRun=false): cancels rows still at IMPORTED or PENDING_REVIEW (import entry);
 * rows advanced to other statuses are skipped and returned in `moved[]`.
 * Pass `includeMoved: true` to also cancel those moved rows.
 *
 * Transitions use WorkflowOrchestrator with manual=true and ALL side-effect flags
 * explicitly set to false — imported bookings have no email history from the import path.
 */

import { isImportBatchRevertableStatus } from '../_shared/importCommitStatus.ts';
import { resolveImportAccess } from '../_shared/importAccess.ts';
import {
  isImportBatchStatus,
  type ImportBatchStatus,
} from '../_shared/importBatchStatusMachine.ts';
import { WorkflowOrchestrator, type DevControlFlags } from '../_shared/workflowOrchestrator.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const REVERT_ALLOWED_STATUSES: ReadonlyArray<ImportBatchStatus> = ['committed'];

type MovedRow = {
  bookingId: string;
  status: string;
  modifiedSinceImport: boolean;
};

type RevertFailure = {
  bookingId: string;
  reason: string;
};

/**
 * All side-effect flags explicitly false — do not rely on flag() defaults.
 * IMPORTED bookings bypassed the orchestrator at commit time; no calendar events,
 * sheets rows, PDFs, or emails were created, so none should fire on cancel.
 */
const REVERT_DEV_CONTROLS: DevControlFlags = {
  generatePdf: false,
  sendGafRequestEmail: false,
  sendBookingAcknowledgementEmail: false,
  sendPetRequestEmail: false,
  sendParkingBroadcastEmail: false,
  sendReadyForCheckinEmail: false,
  sendSdRefundFormEmail: false,
};

serveAuthenticated('import-revert', async (req) => {
  requireHttpMethod(req, 'POST');

  const access = await resolveImportAccess(req);
  const actor = buildActorContext('dashboard', { propertyAccess: access }, req);
  const body = await readJsonBody(req);

  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  if (!batchId) return jsonError(req, 'batchId is required');

  const dryRun = body.dryRun === true;
  const includeMoved = body.includeMoved === true;

  const supabase = createServiceClient();

  // Load and validate batch.
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .select('id, organization_id, property_id, status, committed_at')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) {
    console.error('[import-revert] batch load failed:', batchError.message);
    return jsonError(req, 'Failed to load import batch');
  }
  if (!batch) return jsonError(req, 'Import batch not found', 404);
  if (batch.organization_id !== access.orgId || batch.property_id !== access.propertyId) {
    return jsonError(req, 'Import batch not found', 404);
  }

  const status = String(batch.status ?? '') as ImportBatchStatus;
  if (!isImportBatchStatus(status)) return jsonError(req, 'Import batch has an invalid status');
  if (!REVERT_ALLOWED_STATUSES.includes(status)) {
    return jsonError(req, `Cannot revert batch with status ${status}`);
  }

  const committedAt = typeof batch.committed_at === 'string' ? batch.committed_at : null;

  // ── dryRun path ──────────────────────────────────────────────────────────────
  // Read-only: compute summary without touching any status.
  if (dryRun) {
    const { data: submissions, error: submissionsError } = await supabase
      .from('guest_submissions')
      .select('id, status, updated_at')
      .eq('imported_from_batch_id', batchId);

    if (submissionsError) {
      console.error('[import-revert] dryRun load failed:', submissionsError.message);
      return jsonError(req, 'Failed to load committed submissions');
    }

    const all = submissions ?? [];
    const importedRows = all.filter((s) => isImportBatchRevertableStatus(s.status));
    const movedRows = all.filter((s) => !isImportBatchRevertableStatus(s.status));
    const modifiedCount = all.filter(
      (s) => committedAt != null && typeof s.updated_at === 'string' && s.updated_at > committedAt
    ).length;

    const movedDetails: MovedRow[] = movedRows.map((s) => ({
      bookingId: s.id,
      status: s.status,
      modifiedSinceImport:
        committedAt != null && typeof s.updated_at === 'string' && s.updated_at > committedAt,
    }));

    return jsonSuccess(req, {
      batchId,
      dryRun: true,
      importedCount: importedRows.length,
      movedCount: movedRows.length,
      modifiedCount,
      moved: movedDetails,
    });
  }

  // ── live revert path ──────────────────────────────────────────────────────────

  // Transition → reverting (idempotent: allow already-reverting to continue).
  const { error: revertStartError } = await supabase
    .from('import_batches')
    .update({ status: 'reverting', updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .in('status', ['committed', 'reverting']);

  if (revertStartError) {
    console.error('[import-revert] failed to start revert:', revertStartError.message);
    return jsonError(req, 'Failed to start revert');
  }

  // Load all guest_submissions created by this batch.
  const { data: submissions, error: submissionsError } = await supabase
    .from('guest_submissions')
    .select('id, status, updated_at')
    .eq('imported_from_batch_id', batchId);

  if (submissionsError) {
    console.error('[import-revert] submissions load failed:', submissionsError.message);
    await supabase
      .from('import_batches')
      .update({
        status: 'failed',
        error: submissionsError.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);
    return jsonError(req, 'Failed to load committed submissions');
  }

  const allSubmissions = submissions ?? [];

  // Separate revertable import rows from rows moved into the live pipeline.
  const importedRows = allSubmissions.filter((s) => isImportBatchRevertableStatus(s.status));
  const movedRows = allSubmissions.filter((s) => !isImportBatchRevertableStatus(s.status));

  const movedDetails: MovedRow[] = movedRows.map((s) => ({
    bookingId: s.id,
    status: s.status,
    modifiedSinceImport:
      committedAt != null && typeof s.updated_at === 'string' && s.updated_at > committedAt,
  }));

  const toCancel = includeMoved ? allSubmissions : importedRows;

  // Guard: if there is nothing to cancel, roll back to committed and surface a clear error.
  // This prevents a silent no-op from corrupting the batch status.
  if (toCancel.length === 0) {
    await supabase
      .from('import_batches')
      .update({ status: 'committed', updated_at: new Date().toISOString() })
      .eq('id', batchId);

    const message =
      allSubmissions.length === 0
        ? 'No bookings found for this import batch.'
        : 'Nothing to cancel — all bookings have been moved out of Imported or Pending Review. Enable "Also cancel moved bookings" to include them.';

    console.warn(`[import-revert] no-op guard triggered for batch ${batchId}: ${message}`);
    return jsonError(req, message);
  }

  let cancelled = 0;
  const revertFailed: RevertFailure[] = [];

  for (const submission of toCancel) {
    try {
      // WorkflowOrchestrator with manual=true — same path admin manual cancel uses.
      // IMPORTED → CANCELLED or PENDING_REVIEW → CANCELLED (manual override graph).
      // All side-effect flags are explicitly false (see REVERT_DEV_CONTROLS above).
      await WorkflowOrchestrator.transition(
        submission.id,
        'CANCELLED',
        {},
        REVERT_DEV_CONTROLS,
        true, // manual override
        actor
      );
      cancelled += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[import-revert] booking ${submission.id} cancel failed:`, reason);
      revertFailed.push({ bookingId: submission.id, reason });
    }
  }

  const now = new Date().toISOString();

  // Guard: if every attempt failed (cancelled=0 but we had rows to cancel),
  // roll back to committed so the host can retry.
  if (cancelled === 0) {
    await supabase
      .from('import_batches')
      .update({ status: 'committed', updated_at: now })
      .eq('id', batchId);

    console.error(
      `[import-revert] all cancellations failed for batch ${batchId}; rolled back to committed`
    );
    return jsonError(
      req,
      `Revert failed — could not cancel any bookings (${revertFailed.length} error${revertFailed.length !== 1 ? 's' : ''}). The batch remains committed; you may retry.`
    );
  }

  // Finalize batch → reverted (partial success is acceptable: some cancelled, some failed).
  const { error: finalizeError } = await supabase
    .from('import_batches')
    .update({ status: 'reverted', reverted_at: now, updated_at: now })
    .eq('id', batchId);

  if (finalizeError) {
    console.error('[import-revert] batch finalize failed:', finalizeError.message);
    // Non-fatal: at least some submissions were cancelled; mark best-effort.
  }

  console.log(
    `[import-revert] batch ${batchId} — cancelled=${cancelled}, moved=${movedDetails.length}, failed=${revertFailed.length}`
  );

  // One summary row for the batch — the per-booking `booking.cancelled` rows are
  // emitted by the orchestrator; this ties them together.
  await logActivity({
    action: 'booking.import_reverted',
    organizationId: access.orgId,
    propertyId: access.propertyId,
    actor,
    targetType: 'property',
    targetId: access.propertyId,
    targetLabel: access.property?.name ?? null,
    metadata: {
      batch_id: batchId,
      count: cancelled,
      failed: revertFailed.length,
      moved: movedDetails.length,
    },
  });

  return jsonSuccess(req, {
    batchId,
    dryRun: false,
    status: 'reverted',
    cancelled,
    // Rows that were moved out of IMPORTED before revert ran (not cancelled unless includeMoved=true).
    moved: includeMoved ? [] : movedDetails,
    failed: revertFailed,
  });
});
