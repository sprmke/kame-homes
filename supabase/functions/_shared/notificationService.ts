/**
 * In-app Notification Center — event insert helper.
 * See docs/workflow/in-progress/in-app-notifications.md for the full plan.
 */

import { createServiceClient } from './orgAuth.ts';

export type NotificationType =
  | 'booking_pending_review'
  | 'booking_ready_for_checkin'
  | 'booking_ready_for_checkout'
  | 'booking_sd_refund_due'
  | 'booking_gaf_auto_approved'
  | 'booking_pet_auto_approved'
  | 'booking_parking_matched'
  | 'inbox_new_message'
  | 'calendar_sync_failing'
  | 'calendar_conflict'
  | 'booking_external_imported'
  | 'booking_guest_form_completed'
  | 'smart_pricing_updated'
  | 'property_settings_copied'
  | 'analytics_review_updated'
  | 'review_received'
  | 'review_due'
  | 'review_response_received';

/** Legacy inbox rows stored this generic title before participant names shipped. */
export const LEGACY_INBOX_NOTIFICATION_TITLE = 'New guest message';

/** Guest-facing label for inbox notifications — mirrors inbox thread list fallbacks. */
export function inboxNotificationParticipantLabel(
  participantName: string | null | undefined,
  conversationType: 'dm' | 'comment' = 'dm'
): string {
  const trimmed = participantName?.trim();
  if (trimmed) return trimmed;
  return conversationType === 'comment' ? 'Comment' : 'Guest';
}

export type CreateNotificationInput = {
  organizationId: string;
  propertyId?: string | null;
  parkingId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  bookingId?: string | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
  /** Set to dedupe retried transitions/webhook redeliveries — unique on (type, dedupeKey). */
  dedupeKey?: string | null;
};

/**
 * Inserts a notification row. Never throws — a notification failure must not
 * fail the booking transition, email send, or webhook ack that triggered it
 * (mirrors the calendarOk/sheetOk non-fatal pattern in workflowOrchestrator.ts).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const sb = createServiceClient();
    const payload = buildNotificationPayload(input);

    // Plain insert, not upsert: notifications_type_dedupe_key_unique is a partial index
    // (WHERE dedupe_key IS NOT NULL), and PostgREST's on_conflict target can't express that
    // predicate — ON CONFLICT would fail with "no unique or exclusion constraint matching".
    // A duplicate dedupeKey still raises 23505 on plain insert, which we swallow below.
    const { error } = await sb.from('notifications').insert(payload);

    if (error && error.code !== '23505') {
      console.error('[notificationService] createNotification failed:', error.message);
    }
  } catch (err) {
    console.error('[notificationService] createNotification threw:', err);
  }
}

function buildNotificationPayload(input: CreateNotificationInput) {
  return {
    organization_id: input.organizationId,
    property_id: input.propertyId ?? null,
    parking_id: input.parkingId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    booking_id: input.bookingId ?? null,
    conversation_id: input.conversationId ?? null,
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey ?? null,
  };
}

/**
 * One row per dedupe_key — refresh body/title, bump sort time, and re-unread for all admins.
 * Used for inbox chat (one Activity row per conversation, latest message preview).
 */
export async function createOrCoalesceNotification(input: CreateNotificationInput): Promise<void> {
  if (!input.dedupeKey) {
    await createNotification(input);
    return;
  }

  try {
    const sb = createServiceClient();
    const payload = buildNotificationPayload(input);

    const { data: existing, error: findError } = await sb
      .from('notifications')
      .select('id')
      .eq('type', input.type)
      .eq('dedupe_key', input.dedupeKey)
      .maybeSingle();

    if (findError) {
      console.error(
        '[notificationService] createOrCoalesceNotification find failed:',
        findError.message
      );
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await sb
        .from('notifications')
        .update({
          title: payload.title,
          body: payload.body,
          metadata: payload.metadata,
          property_id: payload.property_id,
          parking_id: payload.parking_id,
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error(
          '[notificationService] createOrCoalesceNotification update failed:',
          updateError.message
        );
        return;
      }

      const { error: clearReadsError } = await sb
        .from('notification_reads')
        .delete()
        .eq('notification_id', existing.id);
      if (clearReadsError) {
        console.error(
          '[notificationService] createOrCoalesceNotification clear reads failed:',
          clearReadsError.message
        );
      }
      return;
    }

    const { error: insertError } = await sb.from('notifications').insert(payload);
    if (insertError?.code === '23505') {
      await createOrCoalesceNotification(input);
      return;
    }
    if (insertError) {
      console.error(
        '[notificationService] createOrCoalesceNotification insert failed:',
        insertError.message
      );
    }
  } catch (err) {
    console.error('[notificationService] createOrCoalesceNotification threw:', err);
  }
}
