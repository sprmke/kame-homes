/**
 * moderate-review-report — super-admin uphold (remove review) or reject a report.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { loadAuthUserProfile } from '../_shared/authUserProfile.ts';
import { logActivity, buildActorContext } from '../_shared/activityLog.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { sendReviewReportDecisionEmail } from '../_shared/reviewEmails.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

serveAuthenticated('moderate-review-report', async (req) => {
  requireHttpMethod(req, 'POST');
  const admin = await verifySuperAdminJwt(req);
  const body = await readJsonBody(req);
  const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
  const decision = body.decision === 'upheld' || body.decision === 'rejected' ? body.decision : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!reportId) return jsonError(req, 'reportId is required', 400);
  if (!decision) return jsonError(req, 'decision must be upheld or rejected', 400);

  const supabase = createServiceClient();
  const { data: report } = await supabase
    .from('review_reports')
    .select('id, review_kind, review_id, reporter_user_id, reporter_side, status')
    .eq('id', reportId)
    .maybeSingle();
  if (!report) return jsonError(req, 'Report not found', 404);
  if (report.status !== 'pending') return jsonError(req, 'Report already decided', 409);

  const reviewKind =
    report.review_kind === 'host_guest_review' ? 'host_guest_review' : 'guest_review';
  const table = reviewKind === 'guest_review' ? 'guest_reviews' : 'host_guest_reviews';
  const { data: review } = await supabase
    .from(table)
    .select(
      reviewKind === 'guest_review'
        ? 'id, booking_id, property_id, organization_id, status'
        : 'id, booking_id, property_id, organization_id, status, author_user_id'
    )
    .eq('id', report.review_id)
    .maybeSingle();
  if (!review) return jsonError(req, 'Review not found', 404);
  const reviewRow = review as unknown as {
    id: string;
    booking_id: string | null;
    property_id: string;
    organization_id: string;
    status: string;
    author_user_id?: string | null;
  };

  const decidedAt = new Date().toISOString();
  // Claim the report first, only while still pending, so two admins deciding at
  // once cannot both act on it.
  const { data: claimed, error: reportErr } = await supabase
    .from('review_reports')
    .update({
      status: decision,
      decided_by: admin.id,
      decided_at: decidedAt,
      decision_note: note || null,
    })
    .eq('id', reportId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (reportErr) return jsonError(req, 'Could not update report', 500);
  if (!claimed) return jsonError(req, 'Report already decided', 409);

  if (decision === 'upheld') {
    const { error } = await supabase
      .from(table)
      .update({
        status: 'removed',
        removed_at: decidedAt,
        removed_by: admin.id,
        removed_reason: 'report_upheld',
      })
      .eq('id', reviewRow.id);
    if (error) {
      await supabase
        .from('review_reports')
        .update({ status: 'pending', decided_by: null, decided_at: null, decision_note: null })
        .eq('id', reportId);
      return jsonError(req, 'Could not remove review', 500);
    }

    // The review is gone; other open reports on it are moot.
    const { error: siblingErr } = await supabase
      .from('review_reports')
      .update({
        status: 'upheld',
        decided_by: admin.id,
        decided_at: decidedAt,
        decision_note: 'Review removed by another report',
      })
      .eq('review_kind', reviewKind)
      .eq('review_id', reviewRow.id)
      .eq('status', 'pending');
    if (siblingErr) {
      console.warn('[moderate-review-report] close sibling reports failed:', siblingErr.message);
    }
  }

  if (decision === 'upheld') {
    await logActivity({
      action: 'review.removed',
      organizationId: reviewRow.organization_id,
      propertyId: reviewRow.property_id,
      actor: buildActorContext(
        'dashboard',
        { superAdmin: { id: admin.id, email: admin.email } },
        req
      ),
      targetId: reviewRow.id,
      metadata: { report_id: reportId, review_kind: reviewKind },
    });
    await capturePostHogEvent('review_removed', {
      logPrefix: 'moderate-review-report',
      request: req,
      properties: { review_kind: reviewKind, report_id: reportId },
    });
  }

  await logSuperAdminAction(admin, {
    action: 'review.report_moderated',
    targetType: 'review_report',
    targetId: reportId,
    summary: decision === 'upheld' ? 'Removed a reported review' : 'Rejected a review report',
    metadata: { decision, review_kind: reviewKind, review_id: reviewRow.id },
    mirrorToOrgActivity:
      decision === 'upheld'
        ? {
            organizationId: reviewRow.organization_id,
            action: 'review.removed',
            targetId: reviewRow.id,
            req,
          }
        : undefined,
  });

  // Author of a guest review is the guest (booking email); author of a host
  // review is the host team member who wrote it. Auto-reviews have no author.
  let authorEmail: string | null = null;
  let authorName = 'there';
  if (reviewKind === 'guest_review' && reviewRow.booking_id) {
    const { data: booking } = await supabase
      .from('guest_submissions')
      .select('guest_email, primary_guest_name, guest_facebook_name')
      .eq('id', reviewRow.booking_id)
      .maybeSingle();
    authorEmail = (booking?.guest_email as string | null)?.trim() || null;
    authorName =
      (booking?.primary_guest_name as string | null) ||
      (booking?.guest_facebook_name as string | null) ||
      'there';
  } else if (reviewKind === 'host_guest_review' && reviewRow.author_user_id) {
    const author = await loadAuthUserProfile(supabase, reviewRow.author_user_id);
    authorEmail = author?.email?.trim() || null;
    authorName = author?.name || 'there';
  }
  const reporter = report.reporter_user_id
    ? await loadAuthUserProfile(supabase, report.reporter_user_id as string)
    : null;

  const recipients = new Map<string, string>();
  if (authorEmail) recipients.set(authorEmail.toLowerCase(), authorName);
  const reporterEmail = reporter?.email?.trim();
  if (reporterEmail && !recipients.has(reporterEmail.toLowerCase())) {
    recipients.set(reporterEmail.toLowerCase(), reporter?.name || 'there');
  }
  await Promise.all(
    [...recipients.entries()].map(([to, name]) =>
      sendReviewReportDecisionEmail({
        to,
        name,
        propertyId: reviewRow.property_id,
        upheld: decision === 'upheld',
      })
    )
  );

  return jsonSuccess(req, { decided: true, decision });
});
