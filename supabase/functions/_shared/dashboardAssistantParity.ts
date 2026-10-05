/**
 * Capability parity manifest: how every host-facing edge function is reachable from the AI
 * assistant. `tests/assistantParityManifest.test.ts` fails when a function directory is added
 * without an entry, when a listed tool is not declared, or when a handoff route is not in the
 * ASSISTANT_ROUTES allowlist. Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 7) and
 * docs/architecture/ai-dashboard-assistant.md §5 (never-build list).
 *
 * Functions served by serveSuperAdmin / serveCronPost / servePublic are classified by their
 * wrapper automatically in the test; everything else must be listed here.
 *
 * Kinds:
 * - tool      the assistant does it in chat (Tier 0/1/2 tools listed)
 * - handoff   the assistant sends an Open block to the exact screen (open_page routeKey)
 * - excluded  never-build (§5): handoff only, with the reason
 * - read      host read surface; answered by read tools or the page itself, nothing to write
 * - guest / account / system / internal / super_admin: not a host dashboard capability
 */

import type { AssistantRouteKey } from './dashboardAssistantRoutes.ts';

export type ParityEntry =
  | { kind: 'tool'; tools: readonly string[] }
  | { kind: 'handoff'; routeKey: AssistantRouteKey; reason: string }
  | { kind: 'excluded'; routeKey: AssistantRouteKey; reason: string }
  | { kind: 'read' }
  | { kind: 'guest' | 'account' | 'system' | 'internal' | 'super_admin' };

const read = { kind: 'read' } as const;
const guest = { kind: 'guest' } as const;
const account = { kind: 'account' } as const;
const system = { kind: 'system' } as const;
const internal = { kind: 'internal' } as const;
const superAdmin = { kind: 'super_admin' } as const;
const tool = (...tools: string[]): ParityEntry => ({ kind: 'tool', tools });
const handoff = (routeKey: AssistantRouteKey, reason: string): ParityEntry => ({
  kind: 'handoff',
  routeKey,
  reason,
});
const excluded = (routeKey: AssistantRouteKey, reason: string): ParityEntry => ({
  kind: 'excluded',
  routeKey,
  reason,
});

export const DASHBOARD_ASSISTANT_PARITY: Record<string, ParityEntry> = {
  // ── Account / per-user ────────────────────────────────────────────────────────────────────
  'accept-org-invite': account,
  'accept-parking-invite': account,
  'accept-property-invite': account,
  'push-subscribe': account,
  'push-unsubscribe': account,
  'user-ui-preferences': account,

  // ── Guest portal / guest-side ─────────────────────────────────────────────────────────────
  'guest-messages': guest,
  'guest-profile': guest,
  'guest-trips': guest,
  'guest-web-chat-messages': guest,
  'guest-web-chat-resume': guest,
  'guest-web-chat-start': guest,
  'upload-guest-chat-asset': guest,
  'upload-guest-profile-asset': guest,
  'list-guest-vouchers': guest,
  'submit-form': guest,
  'submit-form-completion': guest,
  'submit-pay-parking': guest,
  'submit-sd-form': guest,
  'submit-parking-booking-request': guest,
  'ical-export': guest,
  'voice-receptionist-start': guest,
  'voice-receptionist-session': guest,
  'voice-receptionist-end': guest,
  'voice-receptionist-tool': guest,

  // ── System (crons / webhooks / fan-out without the standard wrappers) ─────────────────────
  'calendar-sync-cron': system,
  'sd-refund-cron': system,
  'superhost-assessment-cron': system,
  'meta-inbox-webhook': system,
  'meta-inbox-oauth-callback': system,
  'meta-inbox-backfill': system,
  'parking-broadcast-email': system,

  // ── Assistant internals ───────────────────────────────────────────────────────────────────
  'dashboard-assistant-briefing': internal,
  'dashboard-assistant-chat': internal,
  'dashboard-assistant-confirm': internal,
  'dashboard-assistant-conversations': internal,
  'dashboard-assistant-feedback': internal,
  'dashboard-assistant-memory': internal,
  'dashboard-assistant-settings': internal,
  'get-booking-ai-assistant-audit': internal,
  'setup-guide-state': internal,

  // ── Super-admin surfaces on serveAuthenticated (checked in-handler) ───────────────────────
  'approve-listing-authorization': superAdmin,
  'approve-listing-recommended': superAdmin,
  'approve-org-verification': superAdmin,
  'reject-listing-authorization': superAdmin,
  'reject-org-verification': superAdmin,
  'list-super-admin-approvals': superAdmin,
  'create-development': superAdmin,
  'update-development': superAdmin,
  'delete-development': superAdmin,
  'upload-development-media': superAdmin,
  'list-hosts': superAdmin,
  'list-platform-properties': superAdmin,

  // ── Host reads ────────────────────────────────────────────────────────────────────────────
  'activity-log-export': read,
  'ai-platform-usage': read,
  'analytics-org-summary': tool('get_org_portfolio_analytics'),
  'analytics-summary': read,
  'check-organization-name': read,
  'check-property-name': read,
  'check-tower-unit': read,
  'dashboard-stats': read,
  'finance-bookings': read,
  'finance-export': read,
  'finance-summary': read,
  'get-booking': read,
  'get-booking-ai-review': read,
  'get-booking-asset-url': read,
  'get-development': read,
  'get-external-review-assets': read,
  'get-host': read,
  'get-host-reward-offer': read,
  'get-linked-parking-booking': read,
  'get-listing-authorization-assets': read,
  'get-marketing-generation-job': read,
  'get-org-superhost-progress': read,
  'get-org-verification-assets': read,
  'get-parking-broadcast-status': read,
  'get-support-ticket': read,
  'import-list-batches': read,
  'list-activity-log': tool('list_activity_log'),
  'list-bookings': read,
  'list-developments': read,
  'list-help-center-articles': read,
  'list-help-center-faqs': read,
  'list-host-announcements': read,
  'list-host-organizations': read,
  'list-host-properties': read,
  'list-linkable-property-bookings': read,
  'list-org-listing-verifications': read,
  'list-org-verifications': read,
  'list-organizations': read,
  'list-parkings': read,
  'list-properties': read,
  'list-property-guest-reviews': read,
  'list-support-tickets': read,
  'maintenance-summary': read,
  'marketing-generations': read,
  'meta-inbox-status': read,
  'notifications-list': read,
  'org-access': read,
  'org-plan': read,
  'parking-access': read,
  'preview-guest-stay-guide': read,
  'property-access': read,
  'property-entitlements': read,
  'property-templates-preview': read,
  'resolve-owner-default-parking': read,
  'smart-pricing-preview': tool('get_smart_pricing_preview'),
  'social-inbox-messages': read,
  'voice-receptionist-usage': read,
  'voice-receptionist-voice-preview': read,

  // ── Host writes done in chat ──────────────────────────────────────────────────────────────
  'calendar-sync-settings': tool('get_channel_sync_status', 'propose_run_channel_sync'),
  'cancel-booking': tool('propose_cancel_booking'),
  'claim-parking-booking': tool('propose_claim_parking_booking'),
  'decline-parking-booking': tool('propose_decline_parking_booking'),
  'finance-line-items': tool(
    'propose_add_finance_line_item',
    'propose_update_finance_line_item',
    'propose_delete_finance_line_item',
    'propose_add_parking_finance_line_item'
  ),
  'generate-marketing-caption': tool('draft_marketing_caption'),
  'generate-marketing-template': tool('draft_marketing_template'),
  'maintenance-items': tool(
    'propose_create_maintenance_item',
    'propose_update_maintenance_item',
    'propose_delete_maintenance_item'
  ),
  'marketing-music': tool('search_marketing_music'),
  'org-settings': tool('propose_update_org_profile', 'propose_apply_org_logo'),
  'org-team-invitations': tool('propose_invite_team_member', 'propose_revoke_invitation'),
  'org-team-members': tool('propose_update_team_member_role', 'propose_remove_team_member'),
  'parking-pricing': tool(
    'propose_update_parking_base_rate',
    'propose_set_parking_date_rate_override',
    'propose_block_parking_dates',
    'propose_unblock_parking_dates'
  ),
  'property-pricing': tool(
    'propose_update_property_base_rate',
    'propose_set_property_date_rate_override',
    'propose_add_property_holiday_rule',
    'propose_block_property_dates',
    'propose_unblock_property_dates'
  ),
  'property-team-invitations': tool(
    'propose_invite_property_team_member',
    'propose_revoke_property_invitation'
  ),
  'property-team-members': tool(
    'propose_update_property_team_member_role',
    'propose_remove_property_team_member'
  ),
  'public-page-configs': tool('propose_update_public_page_template'),
  'publish-to-meta': tool('propose_publish_to_meta'),
  'send-booking-workflow-email': tool('propose_send_workflow_email'),
  'send-sd-refund-form-email': tool('propose_send_workflow_email'),
  'social-inbox-ai-suggest': tool('draft_inbox_reply'),
  'social-inbox-send': tool('propose_send_inbox_reply'),
  'social-inbox-threads': tool('list_inbox_threads', 'propose_mark_inbox_thread_read'),
  'submit-listing-authorization': tool('propose_submit_listing_authorization'),
  'submit-org-verification': tool('propose_submit_org_verification'),
  'submit-support-ticket': tool('propose_create_support_ticket'),
  'transition-booking': tool('propose_transition_booking'),
  'transition-parking-booking': tool('propose_transition_parking_booking'),
  'update-organization': tool('propose_update_org_profile'),
  'update-property': tool('propose_update_property_profile', 'propose_update_property_settings'),
  'upload-app-settings-asset': tool('propose_apply_app_settings_attachment'),
  'upload-booking-asset': tool('propose_apply_booking_attachment'),
  'upload-inbox-chat-asset': tool('propose_send_inbox_reply'),
  'upload-listing-authorization-asset': tool('propose_apply_listing_authorization_attachment'),
  'upload-org-settings-asset': tool('propose_apply_org_logo'),
  'upload-org-verification-asset': tool('propose_apply_org_verification_attachment'),
  'upload-parking-media': tool('propose_apply_parking_media'),
  'upload-property-media': tool('propose_apply_property_media'),
  'upload-property-template-asset': tool('propose_apply_template_attachment'),
  'upload-support-ticket-attachment': tool('propose_create_support_ticket'),
  'validate-booking-receipts': tool('run_receipt_validation'),

  // ── Host writes handed off to the exact screen (candidates for later tool waves) ─────────
  'ai-platform-property-settings': handoff('org.settings', 'AI feature toggles'),
  'ai-platform-settings': handoff('org.settings', 'AI feature toggles'),
  'app-settings': tool(
    'get_automation_settings',
    'propose_update_automation_toggles',
    'propose_update_property_settings'
  ) /* payment methods: OTP handoff */,
  'apply-org-plan-downgrade': handoff('org.plans', 'Plan change with billing impact'),
  'booking-ai-review': tool('get_booking_ai_review', 'propose_run_booking_ai_review'),
  'cancel-parking-booking': handoff('parking.booking', 'Parking cancellation flow'),
  'create-org-subscription-checkout': handoff('org.plans', 'Checkout'),
  'create-parking-payment-checkout': handoff('parking.booking', 'Checkout'),
  'create-parking': handoff('org.parkings', 'Guided create flow'),
  'create-property': handoff('org.properties', 'Guided create flow'),
  'custom-pages-settings': handoff('property.public-pages', 'Page editor'),
  'generate-marketing-media': handoff('property.marketing', 'Marketing Studio canvas'),
  'import-ai-map-columns': handoff('property.bookings', 'Import wizard'),
  'import-parse-file': handoff('property.bookings', 'Import wizard'),
  'import-preview': handoff('property.bookings', 'Import wizard'),
  'import-save-mapping': handoff('property.bookings', 'Import wizard'),
  'import-update-row': handoff('property.bookings', 'Import wizard'),
  'import-cancel': handoff('property.bookings', 'Import wizard'),
  'import-revert': handoff('property.bookings', 'Import wizard'),
  'issue-booking-document-share-token': handoff('property.booking', 'Share link from booking page'),
  'issue-guest-form-completion-token': tool('get_guest_link'),
  'issue-guest-stay-guide-token': tool('get_guest_link'),
  'issue-guest-trip-link': handoff('property.booking', 'Share link from booking page'),
  'meta-inbox-disconnect': handoff('property.inbox', 'Meta connection'),
  'meta-inbox-oauth-complete': handoff('property.inbox', 'Meta OAuth'),
  'meta-inbox-oauth-pages': handoff('property.inbox', 'Meta OAuth'),
  'meta-inbox-oauth-start': handoff('property.inbox', 'Meta OAuth'),
  'meta-inbox-resubscribe': handoff('property.inbox', 'Meta connection'),
  'moderate-external-review': handoff('property.public-pages', 'Review moderation'),
  'notifications-mark-read': tool('propose_mark_notifications_read'),
  'org-team-custom-roles': tool('propose_manage_custom_role'),
  'parking-settings': tool(
    'get_automation_settings',
    'propose_update_automation_toggles'
  ) /* payment methods: OTP handoff */,
  'parking-team-custom-roles': tool('propose_manage_custom_role'),
  'parking-team-invitations': tool(
    'list_parking_team',
    'propose_invite_parking_team_member',
    'propose_revoke_parking_invitation'
  ),
  'parking-team-members': tool(
    'list_parking_team',
    'propose_update_parking_team_member',
    'propose_remove_parking_team_member'
  ),
  'property-team-custom-roles': tool('propose_manage_custom_role'),
  'reassess-org-superhost': handoff('org.dashboard', 'Superhost progress'),
  'reopen-support-ticket': tool('propose_reopen_support_ticket'),
  'reply-support-ticket': tool('propose_reply_support_ticket'),
  'request-parking-endorsement': handoff('property.booking', 'Parking endorsement flow'),
  'send-property-custom-template-email': handoff('property.templates', 'Template email composer'),
  'settings-verification': handoff('property.settings', 'OTP verification'),
  'smart-pricing-apply': tool('get_smart_pricing_preview', 'propose_apply_smart_pricing'),
  'smart-pricing-settings': handoff('property.pricing', 'Smart pricing settings'),
  'social-inbox-settings': handoff('property.inbox', 'Inbox settings'),
  'social-inbox-templates': tool(
    'list_inbox_quick_reply_templates',
    'propose_manage_quick_reply_template'
  ),
  'submit-contract-consideration': handoff('org.settings', 'Contract consideration'),
  'submit-listing-recommended': handoff('property.settings', 'Listing recommendation'),
  'telegram-admin-settings': handoff('property.notifications', 'Telegram credentials'),
  'telegram-chat-settings': handoff('property.notifications', 'Telegram credentials'),
  'telegram-finance-settings': handoff('property.notifications', 'Telegram credentials'),
  'telegram-global-settings': handoff('property.notifications', 'Telegram credentials'),
  'telegram-maintenance-settings': handoff('property.notifications', 'Telegram credentials'),
  'telegram-marketing-settings': handoff('property.notifications', 'Telegram credentials'),
  'telegram-parking-settings': handoff('parking.notifications', 'Telegram credentials'),
  'telegram-staff-settings': handoff('property.notifications', 'Telegram credentials'),
  'update-parking': handoff('parking.settings', 'Parking profile form'),
  'upload-marketing-asset': handoff('property.marketing', 'Marketing Studio'),
  'upload-marketing-generation-reference': handoff('property.marketing', 'Marketing Studio'),
  'upload-parking-settings-asset': handoff('parking.settings', 'Parking settings form'),
  'voice-receptionist-settings': tool(
    'get_voice_receptionist_settings',
    'propose_update_voice_receptionist'
  ),
  // ── Never-build (§5): handoff only ────────────────────────────────────────────────────────
  'analytics-ai-review': excluded('property.analytics', 'AI Performance Review regenerate'),
  'copy-property-settings': excluded('org.properties', 'Multi-target settings clone'),
  'create-organization': excluded('org.dashboard', 'Onboarding flow'),
  'create-parking-booking': excluded('parking.bookings', 'Admin booking create'),
  'delete-organization': excluded('org.settings', 'Irreversible delete'),
  'delete-parking': excluded('parking.settings', 'Irreversible delete'),
  'delete-property': excluded('property.settings', 'Irreversible delete'),
  'import-commit': excluded('property.bookings', 'CSV auto-commit'),
  'marketing-templates': excluded('property.marketing', 'Template save / delete via chat'),
  'property-templates-settings': excluded('property.templates', 'Long-form legal templates'),
  'update-booking-details': excluded('property.booking', 'Admin booking field edits'),
};

export function parityEntryFor(functionName: string): ParityEntry | undefined {
  return Object.prototype.hasOwnProperty.call(DASHBOARD_ASSISTANT_PARITY, functionName)
    ? DASHBOARD_ASSISTANT_PARITY[functionName]
    : undefined;
}
