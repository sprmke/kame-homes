/**
 * AI assistant tools: apply chat attachments onto booking document slots, and
 * send booking workflow emails. Used by dashboardAssistantTools execute/propose paths.
 */

import {
  downloadAssistantAttachment,
  resolveAssistantAttachmentPath,
} from './assistantAttachmentApply.ts';
import {
  applyBookingAssetFromBytes,
  BOOKING_ASSET_CONFIG,
  BOOKING_ASSET_LABELS,
  BOOKING_ASSET_TYPES,
  bookingAssetPermission,
  documentCompletionTargetForAsset,
  isBookingAssetType,
  type BookingAssetType,
} from './bookingAssetUpload.ts';
import { formatBookingHostLabel } from './dashboardAssistantHostDisplay.ts';
import { humanizeTransitionError } from './dashboardAssistantActionDisplay.ts';
import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import { DatabaseService } from './databaseService.ts';
import { verifyPropertyAccess } from './orgAuth.ts';
import {
  resolveOrganizationIdForProperty,
  verifyBookingBelongsToProperty,
} from './propertyScope.ts';
import {
  isBookingWorkflowEmailKind,
  sendBookingWorkflowEmail,
  SendBookingWorkflowEmailError,
  BOOKING_WORKFLOW_EMAIL_KINDS,
  type BookingWorkflowEmailKind,
} from './sendBookingWorkflowEmail.ts';
import { STATUS_HUMAN_LABEL, type BookingStatus } from './statusMachine.ts';
import { WorkflowOrchestrator } from './workflowOrchestrator.ts';
import { buildActorContext } from './activityLog.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';

/** Minimal tool context — matches `BookingAssetToolContext` without circular imports. */
export type BookingAssetToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type BookingAssetToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: ActionRiskTier;
  proposed?: boolean;
  auditPropertyId?: string | null;
  auditBookingId?: string | null;
};

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function bool(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true;
}

async function resolveBookingPropertyId(
  ctx: BookingAssetToolContext,
  bookingId: string,
  assetType: BookingAssetType
): Promise<string> {
  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) throw new Error('Booking not found');
  const propertyId = String(booking.property_id ?? '').trim();
  if (!propertyId) throw new Error('Booking has no property');
  await verifyPropertyAccess(ctx.req, propertyId, bookingAssetPermission(assetType));
  await verifyBookingBelongsToProperty(bookingId, propertyId);
  const orgId = await resolveOrganizationIdForProperty(propertyId);
  if (orgId !== ctx.organizationId) throw new Error('Booking is outside this organization');
  return propertyId;
}

function requireConversationId(ctx: BookingAssetToolContext): string {
  const id = ctx.conversationId?.trim();
  if (!id) throw new Error('Conversation is required to apply attachments');
  return id;
}

function markCompleteToStatus(status: string): string {
  if (
    status === 'PENDING_DOCUMENTS' ||
    status === 'PENDING_GAF' ||
    status === 'PENDING_PET_REQUEST' ||
    status === 'PENDING_PARKING_REQUEST'
  ) {
    return 'PENDING_DOCUMENTS';
  }
  return status;
}

function canCompoundMarkComplete(status: string): boolean {
  return (
    status === 'PENDING_DOCUMENTS' ||
    status === 'PENDING_GAF' ||
    status === 'PENDING_PET_REQUEST' ||
    status === 'PENDING_PARKING_REQUEST' ||
    status === 'READY_FOR_CHECKIN'
  );
}

export async function toolProposeApplyBookingAttachment(
  ctx: BookingAssetToolContext,
  args: Record<string, unknown>
): Promise<BookingAssetToolResult> {
  try {
    const bookingId = str(args, 'bookingId');
    const attachmentPath = str(args, 'attachmentPath');
    const assetTypeRaw = args.assetType;
    const alsoMarkComplete = bool(args, 'alsoMarkComplete');
    if (!bookingId || !attachmentPath || !isBookingAssetType(assetTypeRaw)) {
      return {
        ok: false,
        error:
          'bookingId, attachmentPath, and assetType (approved_gaf | approved_pet | valid_id | …) are required',
      };
    }
    const assetType = assetTypeRaw;
    const conversationId = requireConversationId(ctx);
    let resolvedPath: string;
    try {
      resolvedPath = await resolveAssistantAttachmentPath(attachmentPath, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        conversationId,
      });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Attachment is not from this conversation',
      };
    }

    const propertyId = await resolveBookingPropertyId(ctx, bookingId, assetType);
    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking) return { ok: false, error: 'Booking not found' };
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return {
        ok: false,
        error: `Cannot upload documents while booking is ${STATUS_HUMAN_LABEL[booking.status as BookingStatus] ?? booking.status}`,
      };
    }

    const column = BOOKING_ASSET_CONFIG[assetType].column;
    const previousRaw = (booking as Record<string, unknown>)[column];
    const previousUrl =
      typeof previousRaw === 'string' && previousRaw.trim() ? previousRaw.trim() : null;
    const hostLabel = formatBookingHostLabel(booking as Record<string, unknown>);
    const assetLabel = BOOKING_ASSET_LABELS[assetType];

    const fileNameArg = str(args, 'fileName');
    const mimeTypeArg = str(args, 'mimeType');

    let compound: {
      alsoMarkComplete: true;
      documentCompletionTarget: 'gaf' | 'pet';
      toStatus: string;
    } | null = null;

    if (alsoMarkComplete) {
      const target = documentCompletionTargetForAsset(assetType);
      if (!target) {
        return {
          ok: false,
          error: `alsoMarkComplete is only supported for approved_gaf and approved_pet (not ${assetType})`,
        };
      }
      if (!canCompoundMarkComplete(String(booking.status ?? ''))) {
        return {
          ok: false,
          error: `Cannot mark ${assetLabel} complete while booking is ${STATUS_HUMAN_LABEL[booking.status as BookingStatus] ?? booking.status}. Upload the file first, then advance when ready.`,
        };
      }
      compound = {
        alsoMarkComplete: true,
        documentCompletionTarget: target,
        toStatus: markCompleteToStatus(String(booking.status ?? 'PENDING_DOCUMENTS')),
      };
    }

    const tier = classifyActionRisk({
      toolName: 'propose_apply_booking_attachment',
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    const overwriteNote = previousUrl ? ` This will replace the file already on the booking.` : '';
    const compoundNote = compound
      ? ` Then mark ${assetLabel.replace(/^Approved /, '')} as complete.`
      : '';
    const summary = `Apply chat file as ${assetLabel} on ${hostLabel}.${overwriteNote}${compoundNote}`;

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: {
        bookingId,
        propertyId,
        assetType,
        attachmentPath: resolvedPath,
        fileName: fileNameArg,
        mimeType: mimeTypeArg,
        previousUrl,
        hostLabel,
        assetLabel,
        replacesExisting: Boolean(previousUrl),
        ...(compound ?? { alsoMarkComplete: false }),
        summary,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeApplyBookingAttachment(
  ctx: BookingAssetToolContext,
  inputPayload: Record<string, unknown>
): Promise<BookingAssetToolResult> {
  try {
    const bookingId = str(inputPayload, 'bookingId');
    const attachmentPath = str(inputPayload, 'attachmentPath');
    const assetTypeRaw = inputPayload.assetType;
    if (!bookingId || !attachmentPath || !isBookingAssetType(assetTypeRaw)) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const assetType = assetTypeRaw;
    const conversationId = requireConversationId(ctx);
    const propertyId = await resolveBookingPropertyId(ctx, bookingId, assetType);

    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking) return { ok: false, error: 'Booking not found' };
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return {
        ok: false,
        error: `Cannot upload documents while booking is ${STATUS_HUMAN_LABEL[booking.status as BookingStatus] ?? booking.status}`,
      };
    }

    await assertActionSafeToExecute({
      toolName: 'propose_apply_booking_attachment',
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const attachment = await downloadAssistantAttachment({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      conversationId,
      path: attachmentPath,
    });

    const fileName =
      str(inputPayload, 'fileName') || attachmentPath.split('/').pop() || `upload-${assetType}`;
    const mimeType = str(inputPayload, 'mimeType') || attachment.mimeType;

    const applied = await applyBookingAssetFromBytes({
      bookingId,
      propertyId,
      assetType,
      fileName,
      mimeType,
      bytes: attachment.bytes,
      actorUserId: ctx.userId,
      logPrefix: '[assistant-apply-booking-attachment]',
    });

    const alsoMarkComplete = inputPayload.alsoMarkComplete === true;
    const documentCompletionTarget = str(inputPayload, 'documentCompletionTarget');
    const toStatus = str(inputPayload, 'toStatus');
    let markComplete: unknown = null;

    if (alsoMarkComplete && documentCompletionTarget && toStatus) {
      try {
        markComplete = await WorkflowOrchestrator.transition(
          bookingId,
          toStatus as BookingStatus,
          { document_completion_target: documentCompletionTarget },
          {},
          true,
          buildActorContext(
            'ai_assistant',
            {
              assistant: {
                conversationId: ctx.conversationId ?? 'unknown',
                userId: ctx.userId,
                email: ctx.userEmail,
              },
            },
            ctx.req
          )
        );
      } catch (err) {
        return {
          ok: false,
          error: `File was uploaded, but mark-complete failed: ${humanizeTransitionError(
            err instanceof Error ? err.message : String(err)
          )}`,
          auditPropertyId: propertyId,
          auditBookingId: bookingId,
          data: { uploaded: applied, markCompleteError: true },
        };
      }
    }

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: {
        url: applied.url,
        column: applied.column,
        previousUrl: applied.previousUrl,
        revertedToPendingReview: applied.revertedToPendingReview,
        receiptValidation: applied.receiptValidation,
        markComplete,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const WORKFLOW_EMAIL_LABELS: Record<BookingWorkflowEmailKind, string> = {
  gaf_request: 'GAF request',
  pet_request: 'Pet request',
  booking_acknowledgement: 'Booking acknowledgement',
  ready_for_checkin: 'Ready for check-in',
  sd_refund_form_request: 'Check-out Instructions',
};

export async function toolProposeSendWorkflowEmail(
  ctx: BookingAssetToolContext,
  args: Record<string, unknown>
): Promise<BookingAssetToolResult> {
  try {
    const bookingId = str(args, 'bookingId');
    const kindRaw = args.kind;
    if (!bookingId || !isBookingWorkflowEmailKind(kindRaw)) {
      return {
        ok: false,
        error: `bookingId and kind (${BOOKING_WORKFLOW_EMAIL_KINDS.join(' | ')}) are required`,
      };
    }
    const kind = kindRaw;
    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking) return { ok: false, error: 'Booking not found' };
    const propertyId = String(booking.property_id ?? '').trim();
    if (!propertyId) return { ok: false, error: 'Booking has no property' };

    await verifyPropertyAccess(ctx.req, propertyId, 'bookings.detail.workflow:edit');

    const hostLabel = formatBookingHostLabel(booking as Record<string, unknown>);
    const kindLabel = WORKFLOW_EMAIL_LABELS[kind];

    const tier = classifyActionRisk({
      toolName: 'propose_send_workflow_email',
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });

    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: {
        bookingId,
        propertyId,
        kind,
        kindLabel,
        hostLabel,
        summary: `Send ${kindLabel} email for ${hostLabel}. This sends a real email and can't be undone.`,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeSendWorkflowEmail(
  ctx: BookingAssetToolContext,
  inputPayload: Record<string, unknown>
): Promise<BookingAssetToolResult> {
  try {
    const bookingId = str(inputPayload, 'bookingId');
    const propertyId = str(inputPayload, 'propertyId');
    const kindRaw = inputPayload.kind;
    if (!bookingId || !propertyId || !isBookingWorkflowEmailKind(kindRaw)) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const kind = kindRaw;

    await verifyPropertyAccess(ctx.req, propertyId, 'bookings.detail.workflow:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_send_workflow_email',
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const result = await sendBookingWorkflowEmail(bookingId, propertyId, kind);
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: result,
    };
  } catch (err) {
    if (err instanceof SendBookingWorkflowEmailError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const APPLY_BOOKING_ATTACHMENT_TOOL_DECLARATION = {
  name: 'propose_apply_booking_attachment',
  description:
    'Propose applying a file the host attached in this chat onto a booking document slot (approved GAF/pet PDF, valid ID, receipts, parking docs, etc.). Always requires host Confirm. Set alsoMarkComplete=true only for approved_gaf/approved_pet when the host wants upload + mark that step complete in one confirm. attachmentPath must be the storage path from this conversation’s attachments (not a public URL). Warns when replacing an existing file.',
  parameters: {
    type: 'object',
    properties: {
      bookingId: { type: 'string' },
      attachmentPath: {
        type: 'string',
        description: 'Path under ai-assistant-attachments for this conversation',
      },
      assetType: {
        type: 'string',
        enum: [...BOOKING_ASSET_TYPES],
      },
      fileName: { type: 'string', description: 'Original file name if known' },
      mimeType: {
        type: 'string',
        description: 'MIME type if known (image/jpeg, application/pdf, …)',
      },
      alsoMarkComplete: {
        type: 'boolean',
        description:
          'If true (approved_gaf/approved_pet only), also mark that document step complete after upload',
      },
    },
    required: ['bookingId', 'attachmentPath', 'assetType'],
  },
} as const;

export const SEND_WORKFLOW_EMAIL_TOOL_DECLARATION = {
  name: 'propose_send_workflow_email',
  description:
    'Propose sending a booking workflow email the host can already send from Automation Triggers (GAF request, pet request, booking acknowledgement, ready-for-check-in, Check-out Instructions). Always requires Confirm — sends a real email.',
  parameters: {
    type: 'object',
    properties: {
      bookingId: { type: 'string' },
      kind: {
        type: 'string',
        enum: [...BOOKING_WORKFLOW_EMAIL_KINDS],
      },
    },
    required: ['bookingId', 'kind'],
  },
} as const;
