/**
 * Tier registry for the parity tools in dashboardAssistantParityTools.ts. Kept import-free so the
 * risk classifier can include these names without pulling the tool implementations.
 * `tests/assistantParityManifest.test.ts` checks this list matches the declared tools.
 */

export const PARITY_READ_TOOL_NAMES = [
  'list_parking_team',
  'get_automation_settings',
  'get_org_portfolio_analytics',
  'list_activity_log',
  'get_guest_link',
  'get_booking_ai_review',
  'get_smart_pricing_preview',
  'get_voice_receptionist_settings',
  'guide_create_listing',
] as const;

/** Internal, reversible writes — auto-run unless the turn escalates them. */
export const PARITY_TIER1_TOOL_NAMES = [
  'propose_revoke_parking_invitation',
  'propose_reopen_support_ticket',
  'propose_mark_notifications_read',
  'remember_preference',
] as const;

/** Always confirmed by the host. */
export const PARITY_TIER2_TOOL_NAMES = [
  'propose_invite_parking_team_member',
  'propose_update_parking_team_member',
  'propose_remove_parking_team_member',
  'propose_update_automation_toggles',
  'propose_block_parking_dates',
  'propose_unblock_parking_dates',
  'propose_add_parking_finance_line_item',
  'propose_run_booking_ai_review',
  'propose_apply_smart_pricing',
  'propose_update_voice_receptionist',
  'propose_manage_quick_reply_template',
  'propose_manage_custom_role',
  'propose_reply_support_ticket',
] as const;

/** Reads whose results carry third-party text (activity summaries include guest names). */
export const PARITY_UNTRUSTED_CONTENT_TOOL_NAMES = ['list_activity_log'] as const;
