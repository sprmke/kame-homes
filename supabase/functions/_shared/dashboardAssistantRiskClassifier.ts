/**
 * Action-intent risk tiering (tier0/tier1/tier2) for the AI dashboard assistant — the actual
 * write-safety mechanism. Deterministic: never asks the model; reads the same statusMachine.ts
 * graph the orchestrator itself enforces (docs/workflow/planned/ai-dashboard-assistant.md §5).
 * A wrong tier here is the one bug class that must not exist.
 */

import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { canTransition, isBookingStatus, type BookingStatus } from './statusMachine.ts';

// ─── Action-intent risk tiering (deterministic, tool-execution safety gate) ──

export type ActionRiskTier = 'tier0_read' | 'tier1_auto' | 'tier2_confirmed';

/** Read-only tools — always tier0, never touch WorkflowOrchestrator. */
export const READ_TOOL_NAMES = new Set([
  'search_knowledge_base',
  'explain_booking_status',
  'get_booking',
  'get_booking_documents',
  'list_bookings',
  'get_available_transitions',
  'plan_booking_journey',
  'get_available_dates',
  'get_dashboard_stats',
  'get_finance_summary',
  'list_finance_bookings',
  'get_maintenance_summary',
  'list_maintenance_items',
  'get_org_profile',
  'get_org_verification_status',
  'list_team_members',
  'list_pending_invitations',
  'get_property_profile',
  'list_property_team_members',
  'list_property_pending_invitations',
  'get_property_settings',
  'list_parkings',
  'get_parking_booking',
  'list_parking_bookings',
  'get_parking_available_transitions',
  'get_property_pricing',
  'get_parking_pricing',
  'list_inbox_threads',
  'get_inbox_thread',
  'get_inbox_settings',
  'list_inbox_quick_reply_templates',
  'draft_inbox_reply',
  'list_marketing_templates',
  'get_marketing_publish_history',
  'search_marketing_music',
  'draft_marketing_caption',
  'draft_marketing_template',
  'list_support_tickets',
  'get_support_ticket',
  'list_host_announcements',
  'get_host_announcement',
  'get_org_plan_snapshot',
  'get_public_pages_status',
  'get_channel_sync_status',
  'get_notification_preferences',
  'guide_notification_settings',
  'get_telegram_notification_settings',
  'guide_telegram_settings',
  'guide_create_booking',
  'guide_import_bookings',
  'get_property_analytics',
  'explain_metric',
]);

/** Idempotent write tools with no status/financial change — tier1 by construction. */
export const TIER1_ONLY_TOOL_NAMES = new Set([
  'sync_booking_integrations',
  'run_receipt_validation',
  'propose_revoke_invitation',
  'propose_revoke_property_invitation',
  'propose_mark_inbox_thread_read',
]);

/** Always tier2, regardless of payload — destructive by definition. */
export const TIER2_ONLY_TOOL_NAMES = new Set([
  'propose_cancel_booking',
  'propose_add_finance_line_item',
  'propose_create_maintenance_item',
  // Both carry contact fields (contactEmail/contactPhone/contactName) that feed guest-facing
  // communication — a silent auto-executed change here could redirect guest inquiries to an
  // attacker's contact info with no human review. Always confirm, same reasoning as
  // propose_update_property_settings.
  'propose_update_org_profile',
  'propose_update_property_profile',
  'propose_invite_team_member',
  'propose_update_team_member_role',
  'propose_remove_team_member',
  'propose_invite_property_team_member',
  'propose_update_property_team_member_role',
  'propose_remove_property_team_member',
  'propose_update_property_settings',
  'propose_claim_parking_booking',
  'propose_decline_parking_booking',
  'propose_transition_parking_booking',
  'propose_update_property_base_rate',
  'propose_set_property_date_rate_override',
  'propose_add_property_holiday_rule',
  'propose_block_property_dates',
  'propose_unblock_property_dates',
  'propose_update_parking_base_rate',
  'propose_set_parking_date_rate_override',
  'propose_send_inbox_reply',
  'propose_publish_to_meta',
  'propose_apply_booking_attachment',
  'propose_send_workflow_email',
  'propose_apply_org_logo',
  'propose_apply_property_media',
  'propose_apply_parking_media',
  'propose_apply_app_settings_attachment',
  'propose_apply_template_attachment',
  'propose_apply_org_verification_attachment',
  'propose_submit_org_verification',
  'propose_apply_listing_authorization_attachment',
  'propose_submit_listing_authorization',
  'propose_stage_gcash_qr',
  'propose_create_support_ticket',
  'propose_delete_maintenance_item',
  'propose_update_maintenance_item',
  'propose_delete_finance_line_item',
  'propose_update_finance_line_item',
  'propose_update_public_page_template',
  'propose_run_channel_sync',
]);

/**
 * External-facing actions — a categorically stricter risk class than any internal DB write.
 * These are visible to a guest or the public and irreversible once sent/published (a message
 * a guest actually reads, a post that actually goes live), unlike an internal status change
 * that only ever affects our own DB state. Always tier2, and the confirm UI must show distinct
 * "this sends/publishes for real" copy — see dashboardAssistantSafetyGuard.ts's
 * EXTERNAL_SEND_CONFIRM_COPY. Add a tool name here (and to TIER2_ONLY_TOOL_NAMES) the moment it
 * sends a guest message or publishes anywhere public — never let it ride the generic Tier 2 path.
 */
export const EXTERNAL_SEND_TOOL_NAMES = new Set<string>([
  'propose_send_inbox_reply',
  'propose_publish_to_meta',
  'propose_send_workflow_email',
]);

export function isExternalSendTool(toolName: string): boolean {
  return EXTERNAL_SEND_TOOL_NAMES.has(toolName);
}

/**
 * `TransitionPayload` fields (workflowOrchestrator.ts) whose presence with a non-null,
 * non-undefined value always escalates a transition proposal to Tier 2 — pricing/refund/
 * settlement fields are financially consequential even on an otherwise-forward, non-override edge.
 */
export const FINANCIAL_PAYLOAD_FIELDS = new Set([
  'booking_rate',
  'down_payment',
  'security_deposit',
  'pet_fee',
  'parking_rate_guest',
  'guest_additional_fee',
  'parking_rate_paid',
  'sd_additional_expenses',
  'sd_additional_profits',
  'sd_refund_amount',
  'guest_balance_paid_amount',
]);

/**
 * Read tools whose results carry guest- or third-party-written text (messages, special requests,
 * names, file names). Once a turn has read any of these, its writes need host confirmation:
 * injected instructions in that text must never trigger an automatic write.
 */
export const UNTRUSTED_CONTENT_TOOL_NAMES = new Set([
  'get_inbox_thread',
  'list_inbox_threads',
  'draft_inbox_reply',
  'get_booking',
  'list_bookings',
  'get_booking_documents',
  'get_parking_booking',
  'list_parking_bookings',
]);

const TIER_RANK: Record<ActionRiskTier, number> = {
  tier0_read: 0,
  tier1_auto: 1,
  tier2_confirmed: 2,
};

/** Executing with at least as much confirmation as the current state requires is safe. */
export function isTierSufficient(executingAs: ActionRiskTier, required: ActionRiskTier): boolean {
  return TIER_RANK[executingAs] >= TIER_RANK[required];
}

export type ActionRiskInput = {
  toolName: string;
  /** Only meaningful for propose_transition_booking. */
  fromStatus?: string | null;
  toStatus?: string | null;
  payload?: Record<string, unknown> | null;
  /** The booking/property this specific tool call targets. */
  targetBookingId?: string | null;
  targetPropertyId?: string | null;
  /** The route the chat panel was opened from/is currently viewing — see plan §1. */
  pageContext?: { bookingId?: string | null; propertyId?: string | null } | null;
  /** Explicit composer pins — in-scope for this turn, so acting on them is not cross-scope. */
  attachedContext?: AttachedContextItem[] | null;
  /**
   * Forces Tier 2: the model requested more than one write this turn, or the turn read
   * guest-written content (UNTRUSTED_CONTENT_TOOL_NAMES) — prompt-injection escalation.
   */
  isBulk?: boolean;
};

function hasFinancialPayloadValue(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  for (const field of FINANCIAL_PAYLOAD_FIELDS) {
    const value = payload[field];
    if (value !== undefined && value !== null) return true;
  }
  return false;
}

function inScopeBookingIds(input: ActionRiskInput): Set<string> {
  const ids = new Set<string>();
  const pageBookingId = input.pageContext?.bookingId;
  if (pageBookingId) ids.add(pageBookingId);
  for (const item of input.attachedContext ?? []) {
    if (item.type === 'booking' || item.type === 'parking_booking') ids.add(item.id);
  }
  return ids;
}

function inScopePropertyIds(input: ActionRiskInput): Set<string> {
  const ids = new Set<string>();
  const pagePropertyId = input.pageContext?.propertyId;
  if (pagePropertyId) ids.add(pagePropertyId);
  for (const item of input.attachedContext ?? []) {
    if (item.type === 'property') ids.add(item.id);
    if (item.propertyId) ids.add(item.propertyId);
  }
  return ids;
}

function isCrossScope(input: ActionRiskInput): boolean {
  const bookings = inScopeBookingIds(input);
  const properties = inScopePropertyIds(input);
  if (bookings.size > 0 && input.targetBookingId && !bookings.has(input.targetBookingId)) {
    return true;
  }
  if (properties.size > 0 && input.targetPropertyId && !properties.has(input.targetPropertyId)) {
    return true;
  }
  return false;
}

/**
 * Deterministic tier classifier — reads statusMachine.ts's canTransition() (never the model,
 * never a stored/asserted value) as the source of truth for "is this a plain forward edge or
 * a manual-override edge". Highest-tier rule wins. Must be called both at proposal time and
 * again, independently, immediately before execution (dashboardAssistantSafetyGuard.ts).
 */
export function classifyActionRisk(input: ActionRiskInput): ActionRiskTier {
  if (READ_TOOL_NAMES.has(input.toolName)) return 'tier0_read';
  if (TIER2_ONLY_TOOL_NAMES.has(input.toolName)) return 'tier2_confirmed';

  if (input.isBulk) return 'tier2_confirmed';
  if (isCrossScope(input)) return 'tier2_confirmed';

  if (TIER1_ONLY_TOOL_NAMES.has(input.toolName)) return 'tier1_auto';

  if (input.toolName === 'propose_transition_booking') {
    const from = input.fromStatus ?? '';
    const to = input.toStatus ?? '';
    if (!isBookingStatus(from) || !isBookingStatus(to)) return 'tier2_confirmed';

    const isPrimaryGraphEdge = canTransition(from as BookingStatus, to as BookingStatus, {
      manual: false,
    });
    if (!isPrimaryGraphEdge) return 'tier2_confirmed'; // manual-override-only edge
    if (to === 'CANCELLED') return 'tier2_confirmed';
    if (from === 'PENDING_SD_REFUND' && to === 'COMPLETED') return 'tier2_confirmed'; // refund finalization
    if (hasFinancialPayloadValue(input.payload)) return 'tier2_confirmed';

    return 'tier1_auto';
  }

  // Unknown/uncatalogued write tool — the executor's tool-catalog check should already have
  // hard-blocked this before classification is ever reached; tier2 is the safe fallback.
  return 'tier2_confirmed';
}
