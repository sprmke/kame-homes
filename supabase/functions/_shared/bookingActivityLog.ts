/**
 * bookingActivityLog — activity rows for booking-detail host actions (emails, uploads, links).
 * Never throws (delegates to logActivity).
 */

import {
  buildActorContext,
  logActivity,
  type ActivityAction,
  type ActorContext,
} from './activityLog.ts';
import { BOOKING_ASSET_LABELS, type BookingAssetType } from './bookingAssetTypes.ts';
import type { PropertyAccessContext } from './orgAuth.ts';
import {
  shouldPersistReceiptValidation,
  type ReceiptValidationResult,
} from './receiptValidationService.ts';
import type { BookingWorkflowEmailKind } from './sendBookingWorkflowEmail.ts';

export const WORKFLOW_EMAIL_KIND_LABELS: Record<BookingWorkflowEmailKind, string> = {
  gaf_request: 'GAF request email',
  pet_request: 'Pet request email',
  booking_acknowledgement: 'Booking acknowledgement email',
  ready_for_checkin: 'Ready-for-check-in email',
  sd_refund_form_request: 'Check-out & SD refund email',
};

export function bookingTargetLabel(booking: { primary_guest_name?: unknown }): string | null {
  const name = booking.primary_guest_name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function workflowEmailActivityMetadata(
  kind: BookingWorkflowEmailKind
): Record<string, string> {
  return {
    email_kind: kind,
    email_kind_label: WORKFLOW_EMAIL_KIND_LABELS[kind],
  };
}

export function documentUploadedActivityMetadata(
  assetType: BookingAssetType
): Record<string, string> {
  return {
    asset_type: assetType,
    asset_label: BOOKING_ASSET_LABELS[assetType],
  };
}

export function receiptValidatedActivityMetadata(input: {
  assetType: BookingAssetType;
  verdict: string;
  source: 'upload' | 'backfill';
}): Record<string, unknown> {
  return {
    count: 1,
    asset_type: input.assetType,
    asset_label: BOOKING_ASSET_LABELS[input.assetType],
    verdict: input.verdict,
    source: input.source,
  };
}

type BookingDetailActivityAction = Extract<
  ActivityAction,
  | 'booking.workflow_email_sent'
  | 'booking.document_uploaded'
  | 'booking.document_rejected'
  | 'booking.share_link_issued'
  | 'booking.stay_guide_link_issued'
  | 'booking.guest_form_link_issued'
  | 'booking.trip_link_issued'
  | 'booking.ai_review_run'
  | 'booking.receipt_validated'
>;

export async function logBookingDetailActivity(input: {
  action: BookingDetailActivityAction;
  propertyAccess: PropertyAccessContext;
  req: Request;
  bookingId: string;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
  actor?: ActorContext;
}): Promise<void> {
  const { property } = input.propertyAccess;
  await logActivity({
    action: input.action,
    organizationId: property.organization_id,
    propertyId: property.id,
    scope: 'property',
    actor:
      input.actor ??
      buildActorContext('dashboard', { propertyAccess: input.propertyAccess }, input.req),
    targetType: 'booking',
    targetId: input.bookingId,
    targetLabel: input.targetLabel ?? null,
    metadata: input.metadata,
  });
}

/** Dashboard assistant tools (no PropertyAccessContext on the tool ctx). */
export async function logBookingDetailActivityForAssistant(input: {
  action: BookingDetailActivityAction;
  organizationId: string;
  propertyId: string;
  bookingId: string;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
  actor: ActorContext;
}): Promise<void> {
  await logActivity({
    action: input.action,
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    scope: 'property',
    actor: input.actor,
    targetType: 'booking',
    targetId: input.bookingId,
    targetLabel: input.targetLabel ?? null,
    metadata: input.metadata,
  });
}

/** After upload when inline AI validation persisted a verdict (receipt or valid ID). */
export async function logBookingReceiptValidatedOnUpload(input: {
  receiptValidation: ReceiptValidationResult | null | undefined;
  assetType: BookingAssetType;
  propertyAccess: PropertyAccessContext;
  req: Request;
  bookingId: string;
  targetLabel?: string | null;
}): Promise<void> {
  const { receiptValidation } = input;
  if (!receiptValidation || !shouldPersistReceiptValidation(receiptValidation)) return;
  await logBookingDetailActivity({
    action: 'booking.receipt_validated',
    propertyAccess: input.propertyAccess,
    req: input.req,
    bookingId: input.bookingId,
    targetLabel: input.targetLabel ?? null,
    metadata: receiptValidatedActivityMetadata({
      assetType: input.assetType,
      verdict: receiptValidation.verdict,
      source: 'upload',
    }),
  });
}

export async function logBookingReceiptValidatedOnUploadForAssistant(input: {
  receiptValidation: ReceiptValidationResult | null | undefined;
  assetType: BookingAssetType;
  organizationId: string;
  propertyId: string;
  bookingId: string;
  targetLabel?: string | null;
  actor: ActorContext;
}): Promise<void> {
  const { receiptValidation } = input;
  if (!receiptValidation || !shouldPersistReceiptValidation(receiptValidation)) return;
  await logBookingDetailActivityForAssistant({
    action: 'booking.receipt_validated',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    bookingId: input.bookingId,
    targetLabel: input.targetLabel ?? null,
    actor: input.actor,
    metadata: receiptValidatedActivityMetadata({
      assetType: input.assetType,
      verdict: receiptValidation.verdict,
      source: 'upload',
    }),
  });
}
