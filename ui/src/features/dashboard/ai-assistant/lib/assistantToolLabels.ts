/**
 * Host-facing labels for dashboard-assistant tool activity.
 * Mirror: ui/src/features/dashboard/ai-assistant/lib/assistantToolLabels.ts — keep in sync.
 */

export type AssistantToolLabelVariant = 'progress' | 'done' | 'failed';

const TOOL_LABELS: Record<string, { progress: string; done: string; failed: string }> = {
  search_knowledge_base: {
    progress: 'Searching help docs…',
    done: 'Searched help docs',
    failed: 'Help doc search failed',
  },
  explain_booking_status: {
    progress: 'Explaining booking status…',
    done: 'Explained booking status',
    failed: 'Could not explain status',
  },
  get_booking: {
    progress: 'Looking up booking…',
    done: 'Looked up booking',
    failed: 'Booking lookup failed',
  },
  get_booking_documents: {
    progress: 'Fetching booking files…',
    done: 'Fetched booking files',
    failed: 'Could not fetch files',
  },
  list_bookings: {
    progress: 'Searching bookings…',
    done: 'Searched bookings',
    failed: 'Booking search failed',
  },
  get_available_transitions: {
    progress: 'Checking available moves…',
    done: 'Checked available moves',
    failed: 'Could not check transitions',
  },
  plan_booking_journey: {
    progress: 'Mapping booking pipeline…',
    done: 'Mapped booking pipeline',
    failed: 'Could not map pipeline',
  },
  get_available_dates: {
    progress: 'Checking calendar availability…',
    done: 'Checked calendar availability',
    failed: 'Calendar check failed',
  },
  get_dashboard_stats: {
    progress: 'Loading dashboard stats…',
    done: 'Loaded dashboard stats',
    failed: 'Stats load failed',
  },
  get_finance_summary: {
    progress: 'Summarizing finance…',
    done: 'Summarized finance',
    failed: 'Finance summary failed',
  },
  list_finance_bookings: {
    progress: 'Listing finance bookings…',
    done: 'Listed finance bookings',
    failed: 'Finance list failed',
  },
  get_maintenance_summary: {
    progress: 'Summarizing maintenance…',
    done: 'Summarized maintenance',
    failed: 'Maintenance summary failed',
  },
  list_maintenance_items: {
    progress: 'Listing maintenance items…',
    done: 'Listed maintenance items',
    failed: 'Maintenance list failed',
  },
  run_receipt_validation: {
    progress: 'Validating receipts…',
    done: 'Validated receipts',
    failed: 'Receipt validation failed',
  },
  propose_transition_booking: {
    progress: 'Preparing status change…',
    done: 'Prepared status change',
    failed: 'Status change failed',
  },
  propose_cancel_booking: {
    progress: 'Preparing cancellation…',
    done: 'Prepared cancellation',
    failed: 'Cancellation prep failed',
  },
  propose_add_finance_line_item: {
    progress: 'Preparing finance entry…',
    done: 'Prepared finance entry',
    failed: 'Finance entry prep failed',
  },
  propose_create_maintenance_item: {
    progress: 'Preparing maintenance item…',
    done: 'Prepared maintenance item',
    failed: 'Maintenance prep failed',
  },
  get_org_profile: {
    progress: 'Loading org profile…',
    done: 'Loaded org profile',
    failed: 'Org profile load failed',
  },
  get_org_verification_status: {
    progress: 'Checking verification status…',
    done: 'Checked verification status',
    failed: 'Verification check failed',
  },
  list_team_members: {
    progress: 'Listing team members…',
    done: 'Listed team members',
    failed: 'Team list failed',
  },
  list_pending_invitations: {
    progress: 'Listing pending invites…',
    done: 'Listed pending invites',
    failed: 'Invite list failed',
  },
  propose_update_org_profile: {
    progress: 'Preparing org update…',
    done: 'Prepared org update',
    failed: 'Org update prep failed',
  },
  propose_invite_team_member: {
    progress: 'Preparing team invite…',
    done: 'Prepared team invite',
    failed: 'Team invite prep failed',
  },
  propose_update_team_member_role: {
    progress: 'Preparing role change…',
    done: 'Prepared role change',
    failed: 'Role change prep failed',
  },
  propose_revoke_invitation: {
    progress: 'Preparing invite revoke…',
    done: 'Prepared invite revoke',
    failed: 'Invite revoke prep failed',
  },
  propose_remove_team_member: {
    progress: 'Preparing member removal…',
    done: 'Prepared member removal',
    failed: 'Member removal prep failed',
  },
  get_property_profile: {
    progress: 'Loading property profile…',
    done: 'Loaded property profile',
    failed: 'Property profile load failed',
  },
  get_property_settings: {
    progress: 'Loading property settings…',
    done: 'Loaded property settings',
    failed: 'Property settings load failed',
  },
  list_property_team_members: {
    progress: 'Listing property team…',
    done: 'Listed property team',
    failed: 'Property team list failed',
  },
  list_property_pending_invitations: {
    progress: 'Listing property invites…',
    done: 'Listed property invites',
    failed: 'Property invite list failed',
  },
  propose_update_property_profile: {
    progress: 'Preparing property update…',
    done: 'Prepared property update',
    failed: 'Property update prep failed',
  },
  propose_update_property_settings: {
    progress: 'Preparing settings update…',
    done: 'Prepared settings update',
    failed: 'Settings update prep failed',
  },
  propose_invite_property_team_member: {
    progress: 'Preparing property invite…',
    done: 'Prepared property invite',
    failed: 'Property invite prep failed',
  },
  propose_update_property_team_member_role: {
    progress: 'Preparing property role change…',
    done: 'Prepared property role change',
    failed: 'Property role change failed',
  },
  propose_revoke_property_invitation: {
    progress: 'Preparing invite revoke…',
    done: 'Prepared invite revoke',
    failed: 'Invite revoke prep failed',
  },
  propose_remove_property_team_member: {
    progress: 'Preparing property member removal…',
    done: 'Prepared property member removal',
    failed: 'Member removal prep failed',
  },
  list_parkings: {
    progress: 'Listing parking slots…',
    done: 'Listed parking slots',
    failed: 'Parking list failed',
  },
  get_parking_booking: {
    progress: 'Looking up parking booking…',
    done: 'Looked up parking booking',
    failed: 'Parking booking lookup failed',
  },
  list_parking_bookings: {
    progress: 'Searching parking bookings…',
    done: 'Searched parking bookings',
    failed: 'Parking search failed',
  },
  get_parking_available_transitions: {
    progress: 'Checking parking moves…',
    done: 'Checked parking moves',
    failed: 'Parking transition check failed',
  },
  propose_claim_parking_booking: {
    progress: 'Preparing parking claim…',
    done: 'Prepared parking claim',
    failed: 'Parking claim prep failed',
  },
  propose_decline_parking_booking: {
    progress: 'Preparing parking decline…',
    done: 'Prepared parking decline',
    failed: 'Parking decline prep failed',
  },
  propose_transition_parking_booking: {
    progress: 'Preparing parking status change…',
    done: 'Prepared parking status change',
    failed: 'Parking status prep failed',
  },
  get_property_pricing: {
    progress: 'Loading property pricing…',
    done: 'Loaded property pricing',
    failed: 'Property pricing load failed',
  },
  get_parking_pricing: {
    progress: 'Loading parking pricing…',
    done: 'Loaded parking pricing',
    failed: 'Parking pricing load failed',
  },
  propose_update_property_base_rate: {
    progress: 'Preparing base rate update…',
    done: 'Prepared base rate update',
    failed: 'Base rate prep failed',
  },
  propose_set_property_date_rate_override: {
    progress: 'Preparing date rate override…',
    done: 'Prepared date rate override',
    failed: 'Date rate prep failed',
  },
  propose_add_property_holiday_rule: {
    progress: 'Preparing holiday rule…',
    done: 'Prepared holiday rule',
    failed: 'Holiday rule prep failed',
  },
  propose_block_property_dates: {
    progress: 'Preparing date block…',
    done: 'Prepared date block',
    failed: 'Date block prep failed',
  },
  propose_unblock_property_dates: {
    progress: 'Preparing date unblock…',
    done: 'Prepared date unblock',
    failed: 'Date unblock prep failed',
  },
  propose_update_parking_base_rate: {
    progress: 'Preparing parking rate update…',
    done: 'Prepared parking rate update',
    failed: 'Parking rate prep failed',
  },
  propose_set_parking_date_rate_override: {
    progress: 'Preparing parking date override…',
    done: 'Prepared parking date override',
    failed: 'Parking date override failed',
  },
  list_inbox_threads: {
    progress: 'Listing inbox threads…',
    done: 'Listed inbox threads',
    failed: 'Inbox list failed',
  },
  get_inbox_thread: {
    progress: 'Loading conversation…',
    done: 'Loaded conversation',
    failed: 'Conversation load failed',
  },
  get_inbox_settings: {
    progress: 'Loading inbox settings…',
    done: 'Loaded inbox settings',
    failed: 'Inbox settings load failed',
  },
  list_inbox_quick_reply_templates: {
    progress: 'Loading quick replies…',
    done: 'Loaded quick replies',
    failed: 'Quick reply load failed',
  },
  propose_mark_inbox_thread_read: {
    progress: 'Marking thread read…',
    done: 'Marked thread read',
    failed: 'Mark read failed',
  },
  draft_inbox_reply: {
    progress: 'Drafting inbox reply…',
    done: 'Drafted inbox reply',
    failed: 'Reply draft failed',
  },
  propose_send_inbox_reply: {
    progress: 'Preparing message send…',
    done: 'Prepared message send',
    failed: 'Message send prep failed',
  },
  list_marketing_templates: {
    progress: 'Listing marketing templates…',
    done: 'Listed marketing templates',
    failed: 'Template list failed',
  },
  get_marketing_publish_history: {
    progress: 'Loading publish history…',
    done: 'Loaded publish history',
    failed: 'Publish history failed',
  },
  search_marketing_music: {
    progress: 'Searching music…',
    done: 'Searched music',
    failed: 'Music search failed',
  },
  draft_marketing_caption: {
    progress: 'Drafting caption…',
    done: 'Drafted caption',
    failed: 'Caption draft failed',
  },
  draft_marketing_template: {
    progress: 'Drafting template…',
    done: 'Drafted template',
    failed: 'Template draft failed',
  },
  propose_publish_to_meta: {
    progress: 'Preparing Meta publish…',
    done: 'Prepared Meta publish',
    failed: 'Meta publish prep failed',
  },
  propose_apply_booking_attachment: {
    progress: 'Preparing file upload…',
    done: 'Prepared file upload',
    failed: 'File upload prep failed',
  },
  propose_send_workflow_email: {
    progress: 'Preparing workflow email…',
    done: 'Prepared workflow email',
    failed: 'Workflow email prep failed',
  },
  propose_apply_org_logo: {
    progress: 'Preparing logo upload…',
    done: 'Prepared logo upload',
    failed: 'Logo upload prep failed',
  },
  propose_apply_property_media: {
    progress: 'Preparing gallery upload…',
    done: 'Prepared gallery upload',
    failed: 'Gallery upload prep failed',
  },
  propose_apply_parking_media: {
    progress: 'Preparing parking photo…',
    done: 'Prepared parking photo',
    failed: 'Parking photo prep failed',
  },
  propose_apply_app_settings_attachment: {
    progress: 'Preparing settings file…',
    done: 'Prepared settings file',
    failed: 'Settings file prep failed',
  },
  propose_apply_template_attachment: {
    progress: 'Preparing template image…',
    done: 'Prepared template image',
    failed: 'Template image prep failed',
  },
  propose_apply_org_verification_attachment: {
    progress: 'Preparing verification proof…',
    done: 'Prepared verification proof',
    failed: 'Verification proof prep failed',
  },
  propose_submit_org_verification: {
    progress: 'Preparing verification submit…',
    done: 'Prepared verification submit',
    failed: 'Verification submit prep failed',
  },
  propose_apply_listing_authorization_attachment: {
    progress: 'Preparing listing proof…',
    done: 'Prepared listing proof',
    failed: 'Listing proof prep failed',
  },
  propose_submit_listing_authorization: {
    progress: 'Preparing listing submit…',
    done: 'Prepared listing submit',
    failed: 'Listing submit prep failed',
  },
  propose_stage_gcash_qr: {
    progress: 'Preparing GCash QR…',
    done: 'Prepared GCash QR',
    failed: 'GCash QR prep failed',
  },
  list_support_tickets: {
    progress: 'Listing support tickets…',
    done: 'Listed support tickets',
    failed: 'Support ticket list failed',
  },
  get_support_ticket: {
    progress: 'Loading support ticket…',
    done: 'Loaded support ticket',
    failed: 'Support ticket load failed',
  },
  propose_create_support_ticket: {
    progress: 'Preparing support ticket…',
    done: 'Prepared support ticket',
    failed: 'Support ticket prep failed',
  },
  list_host_announcements: {
    progress: 'Loading announcements…',
    done: 'Loaded announcements',
    failed: 'Announcements load failed',
  },
  get_host_announcement: {
    progress: 'Loading announcement…',
    done: 'Loaded announcement',
    failed: 'Announcement load failed',
  },

  get_channel_sync_status: {
    progress: 'Checking Channel sync…',
    done: 'Checked Channel sync',
    failed: 'Channel sync check failed',
  },
  propose_run_channel_sync: {
    progress: 'Preparing Channel sync…',
    done: 'Prepared Channel sync',
    failed: 'Channel sync prep failed',
  },
  get_public_pages_status: {
    progress: 'Loading public pages…',
    done: 'Loaded public pages',
    failed: 'Public pages load failed',
  },
  propose_update_public_page_template: {
    progress: 'Preparing page template…',
    done: 'Prepared page template',
    failed: 'Page template prep failed',
  },
  propose_update_finance_line_item: {
    progress: 'Preparing finance update…',
    done: 'Prepared finance update',
    failed: 'Finance update prep failed',
  },
  propose_delete_finance_line_item: {
    progress: 'Preparing finance delete…',
    done: 'Prepared finance delete',
    failed: 'Finance delete prep failed',
  },
  propose_update_maintenance_item: {
    progress: 'Preparing maintenance update…',
    done: 'Prepared maintenance update',
    failed: 'Maintenance update prep failed',
  },
  propose_delete_maintenance_item: {
    progress: 'Preparing maintenance delete…',
    done: 'Prepared maintenance delete',
    failed: 'Maintenance delete prep failed',
  },
  get_org_plan_snapshot: {
    progress: 'Loading plan snapshot…',
    done: 'Loaded plan snapshot',
    failed: 'Plan snapshot failed',
  },
  get_notification_preferences: {
    progress: 'Loading notification prefs…',
    done: 'Loaded notification prefs',
    failed: 'Notification prefs failed',
  },
  guide_notification_settings: {
    progress: 'Loading notification guide…',
    done: 'Loaded notification guide',
    failed: 'Notification guide failed',
  },
  get_telegram_notification_settings: {
    progress: 'Loading Telegram settings…',
    done: 'Loaded Telegram settings',
    failed: 'Telegram settings failed',
  },
  guide_telegram_settings: {
    progress: 'Loading Telegram guide…',
    done: 'Loaded Telegram guide',
    failed: 'Telegram guide failed',
  },
  guide_create_booking: {
    progress: 'Loading new booking guide…',
    done: 'Loaded new booking guide',
    failed: 'New booking guide failed',
  },
  guide_import_bookings: {
    progress: 'Loading import guide…',
    done: 'Loaded import guide',
    failed: 'Import guide failed',
  },
  open_page: {
    progress: 'Finding the page…',
    done: 'Found the page',
    failed: 'Page lookup failed',
  },
  list_parking_team: {
    progress: 'Checking the parking team…',
    done: 'Checked the parking team',
    failed: 'Parking team check failed',
  },
  propose_invite_parking_team_member: {
    progress: 'Preparing the invite…',
    done: 'Prepared the invite',
    failed: 'Invite failed',
  },
  propose_update_parking_team_member: {
    progress: 'Preparing the role change…',
    done: 'Prepared the role change',
    failed: 'Role change failed',
  },
  propose_remove_parking_team_member: {
    progress: 'Preparing the removal…',
    done: 'Prepared the removal',
    failed: 'Removal failed',
  },
  propose_revoke_parking_invitation: {
    progress: 'Cancelling the invitation…',
    done: 'Cancelled the invitation',
    failed: 'Could not cancel the invitation',
  },
  get_automation_settings: {
    progress: 'Checking automatic emails…',
    done: 'Checked automatic emails',
    failed: 'Automatic email check failed',
  },
  propose_update_automation_toggles: {
    progress: 'Preparing email settings…',
    done: 'Prepared email settings',
    failed: 'Email settings failed',
  },
  propose_block_parking_dates: {
    progress: 'Preparing the date block…',
    done: 'Prepared the date block',
    failed: 'Date block failed',
  },
  propose_unblock_parking_dates: {
    progress: 'Preparing to unblock dates…',
    done: 'Prepared to unblock dates',
    failed: 'Unblock failed',
  },
  propose_add_parking_finance_line_item: {
    progress: 'Preparing the finance entry…',
    done: 'Prepared the finance entry',
    failed: 'Finance entry failed',
  },
  get_org_portfolio_analytics: {
    progress: 'Checking portfolio analytics…',
    done: 'Checked portfolio analytics',
    failed: 'Portfolio analytics failed',
  },
  list_activity_log: {
    progress: 'Checking recent activity…',
    done: 'Checked recent activity',
    failed: 'Activity check failed',
  },
  get_guest_link: {
    progress: 'Getting the guest link…',
    done: 'Got the guest link',
    failed: 'Could not get the guest link',
  },
  get_booking_ai_review: {
    progress: 'Checking the AI review…',
    done: 'Checked the AI review',
    failed: 'AI review check failed',
  },
  propose_run_booking_ai_review: {
    progress: 'Preparing the AI review…',
    done: 'Prepared the AI review',
    failed: 'AI review failed',
  },
  get_smart_pricing_preview: {
    progress: 'Calculating Smart Pricing…',
    done: 'Calculated Smart Pricing',
    failed: 'Smart Pricing preview failed',
  },
  propose_apply_smart_pricing: {
    progress: 'Preparing Smart Pricing…',
    done: 'Prepared Smart Pricing',
    failed: 'Smart Pricing failed',
  },
  get_voice_receptionist_settings: {
    progress: 'Checking the voice receptionist…',
    done: 'Checked the voice receptionist',
    failed: 'Voice receptionist check failed',
  },
  propose_update_voice_receptionist: {
    progress: 'Preparing receptionist changes…',
    done: 'Prepared receptionist changes',
    failed: 'Receptionist update failed',
  },
  propose_manage_quick_reply_template: {
    progress: 'Preparing the quick reply…',
    done: 'Prepared the quick reply',
    failed: 'Quick reply failed',
  },
  propose_manage_custom_role: {
    progress: 'Preparing the role…',
    done: 'Prepared the role',
    failed: 'Role update failed',
  },
  guide_create_listing: {
    progress: 'Loading the listing guide…',
    done: 'Loaded the listing guide',
    failed: 'Listing guide failed',
  },
  propose_reply_support_ticket: {
    progress: 'Preparing your reply…',
    done: 'Prepared your reply',
    failed: 'Reply failed',
  },
  propose_reopen_support_ticket: {
    progress: 'Reopening the ticket…',
    done: 'Reopened the ticket',
    failed: 'Could not reopen the ticket',
  },
  propose_mark_notifications_read: {
    progress: 'Marking notifications read…',
    done: 'Marked notifications read',
    failed: 'Could not mark notifications read',
  },
  remember_preference: {
    progress: 'Saving to memory…',
    done: 'Saved to memory',
    failed: 'Could not save to memory',
  },
};

/** Short audit-card label (past tense, no ellipsis). */
export function getAssistantToolAuditLabel(toolName: string): string {
  return TOOL_LABELS[toolName]?.done ?? toolName.replace(/_/g, ' ');
}

export function getAssistantToolActivityLabel(
  toolName: string,
  variant: AssistantToolLabelVariant
): string {
  const entry = TOOL_LABELS[toolName];
  if (entry) return entry[variant];
  const fallback = toolName.replace(/_/g, ' ');
  if (variant === 'progress') return `Running ${fallback}…`;
  if (variant === 'failed') return `${fallback} failed`;
  return fallback;
}
