/**
 * Guest-submitted, host-reviewed requests from the AI receptionist (booking inquiry / early
 * check-in-late check-out). Nothing binding happens until a host resolves one — approve/decline
 * only records the decision here, it never auto-creates or edits a booking.
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 5, guest write tools).
 */

import { createServiceClient } from './orgAuth.ts';

export type GuestRequestKind = 'booking_inquiry' | 'early_checkin_late_checkout';
export type GuestRequestStatus = 'pending' | 'approved' | 'declined';

export type GuestRequestRow = {
  id: string;
  organization_id: string;
  property_id: string;
  conversation_id: string | null;
  guest_user_id: string;
  booking_id: string | null;
  kind: GuestRequestKind;
  status: GuestRequestStatus;
  payload: Record<string, unknown>;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

export async function createGuestRequest(input: {
  organizationId: string;
  propertyId: string;
  conversationId?: string | null;
  guestUserId: string;
  bookingId?: string | null;
  kind: GuestRequestKind;
  payload: Record<string, unknown>;
}): Promise<GuestRequestRow> {
  const { data, error } = await createServiceClient()
    .from('guest_requests')
    .insert({
      organization_id: input.organizationId,
      property_id: input.propertyId,
      conversation_id: input.conversationId ?? null,
      guest_user_id: input.guestUserId,
      booking_id: input.bookingId ?? null,
      kind: input.kind,
      payload: input.payload,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`Failed to create guest request: ${error?.message ?? 'unknown error'}`);
  }
  return data as GuestRequestRow;
}

/** Every request tied to a conversation — the inbox thread renders these as inline cards. */
export async function listGuestRequestsForConversation(
  conversationId: string
): Promise<GuestRequestRow[]> {
  const { data, error } = await createServiceClient()
    .from('guest_requests')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to load guest requests: ${error.message}`);
  return (data ?? []) as GuestRequestRow[];
}

/** Resolves a pending request. Returns null if it was not pending (already resolved, or gone). */
export async function resolveGuestRequest(input: {
  id: string;
  organizationId: string;
  status: 'approved' | 'declined';
  resolvedBy: string;
}): Promise<GuestRequestRow | null> {
  const { data, error } = await createServiceClient()
    .from('guest_requests')
    .update({
      status: input.status,
      resolved_at: new Date().toISOString(),
      resolved_by: input.resolvedBy,
    })
    .eq('id', input.id)
    .eq('organization_id', input.organizationId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to resolve guest request: ${error.message}`);
  return (data as GuestRequestRow | null) ?? null;
}
