/**
 * Deterministic tool router for the dashboard assistant (ai-chat-mode.md Phase 6).
 *
 * Sending all ~130 tool schemas on every round costs tokens and dilutes tool choice. The router
 * picks the modules a turn needs from cheap, local signals — no extra model call:
 *   1. the host's words (module keyword patterns)
 *   2. composer pins (attachedContext types) and the page the host is on
 *   3. modules whose tools ran earlier in this conversation (follow-ups stay on topic)
 * The core module (knowledge base, open_page, explanations, dashboard stats) is always sent.
 * When no module matches, the router fails open and sends every tool, so recall never drops
 * below the unrouted baseline. `tests/assistantToolRouter` covers every tool has a module.
 */

export type AssistantToolModule =
  | 'core'
  | 'bookings'
  | 'parking'
  | 'finance'
  | 'maintenance'
  | 'pricing'
  | 'inbox'
  | 'marketing'
  | 'team'
  | 'settings'
  | 'analytics'
  | 'support'
  | 'verification';

/** Every declared tool belongs to exactly one module. Drift-tested against the declarations. */
export const ASSISTANT_TOOL_MODULES: Record<string, AssistantToolModule> = {
  // core — always sent
  search_knowledge_base: 'core',
  open_page: 'core',
  explain_booking_status: 'core',
  explain_metric: 'core',
  get_dashboard_stats: 'core',
  get_org_plan_snapshot: 'core',
  list_activity_log: 'core',
  remember_preference: 'core',

  // bookings
  get_booking: 'bookings',
  get_booking_documents: 'bookings',
  list_bookings: 'bookings',
  get_available_transitions: 'bookings',
  get_available_dates: 'bookings',
  plan_booking_journey: 'bookings',
  propose_transition_booking: 'bookings',
  propose_cancel_booking: 'bookings',
  propose_apply_booking_attachment: 'bookings',
  propose_send_workflow_email: 'bookings',
  run_receipt_validation: 'bookings',
  sync_booking_integrations: 'bookings',
  get_channel_sync_status: 'bookings',
  propose_run_channel_sync: 'bookings',
  guide_create_booking: 'bookings',
  guide_import_bookings: 'bookings',
  get_guest_link: 'bookings',
  get_booking_ai_review: 'bookings',
  propose_run_booking_ai_review: 'bookings',

  // parking
  list_parkings: 'parking',
  list_parking_bookings: 'parking',
  get_parking_booking: 'parking',
  get_parking_available_transitions: 'parking',
  propose_transition_parking_booking: 'parking',
  propose_claim_parking_booking: 'parking',
  propose_decline_parking_booking: 'parking',
  propose_apply_parking_media: 'parking',
  list_parking_team: 'parking',
  propose_invite_parking_team_member: 'parking',
  propose_update_parking_team_member: 'parking',
  propose_remove_parking_team_member: 'parking',
  propose_revoke_parking_invitation: 'parking',
  propose_block_parking_dates: 'parking',
  propose_unblock_parking_dates: 'parking',
  propose_add_parking_finance_line_item: 'parking',

  // finance
  get_finance_summary: 'finance',
  list_finance_bookings: 'finance',
  propose_add_finance_line_item: 'finance',
  propose_update_finance_line_item: 'finance',
  propose_delete_finance_line_item: 'finance',

  // maintenance
  get_maintenance_summary: 'maintenance',
  list_maintenance_items: 'maintenance',
  propose_create_maintenance_item: 'maintenance',
  propose_update_maintenance_item: 'maintenance',
  propose_delete_maintenance_item: 'maintenance',

  // pricing
  get_property_pricing: 'pricing',
  get_parking_pricing: 'pricing',
  propose_update_property_base_rate: 'pricing',
  propose_set_property_date_rate_override: 'pricing',
  propose_add_property_holiday_rule: 'pricing',
  propose_block_property_dates: 'pricing',
  propose_unblock_property_dates: 'pricing',
  propose_update_parking_base_rate: 'pricing',
  propose_set_parking_date_rate_override: 'pricing',
  get_smart_pricing_preview: 'pricing',
  propose_apply_smart_pricing: 'pricing',

  // inbox
  list_inbox_threads: 'inbox',
  get_inbox_thread: 'inbox',
  draft_inbox_reply: 'inbox',
  propose_send_inbox_reply: 'inbox',
  propose_mark_inbox_thread_read: 'inbox',
  get_inbox_settings: 'inbox',
  list_inbox_quick_reply_templates: 'inbox',
  propose_manage_quick_reply_template: 'inbox',

  // marketing
  draft_marketing_caption: 'marketing',
  draft_marketing_template: 'marketing',
  list_marketing_templates: 'marketing',
  get_marketing_publish_history: 'marketing',
  search_marketing_music: 'marketing',
  propose_publish_to_meta: 'marketing',
  get_public_pages_status: 'marketing',
  propose_update_public_page_template: 'marketing',

  // team
  list_team_members: 'team',
  list_pending_invitations: 'team',
  propose_invite_team_member: 'team',
  propose_update_team_member_role: 'team',
  propose_remove_team_member: 'team',
  propose_revoke_invitation: 'team',
  list_property_team_members: 'team',
  list_property_pending_invitations: 'team',
  propose_invite_property_team_member: 'team',
  propose_update_property_team_member_role: 'team',
  propose_remove_property_team_member: 'team',
  propose_revoke_property_invitation: 'team',
  propose_manage_custom_role: 'team',

  // settings
  get_org_profile: 'settings',
  propose_update_org_profile: 'settings',
  propose_apply_org_logo: 'settings',
  get_property_profile: 'settings',
  propose_update_property_profile: 'settings',
  get_property_settings: 'settings',
  propose_update_property_settings: 'settings',
  propose_apply_property_media: 'settings',
  propose_apply_app_settings_attachment: 'settings',
  propose_apply_template_attachment: 'settings',
  propose_stage_gcash_qr: 'settings',
  get_automation_settings: 'settings',
  propose_update_automation_toggles: 'settings',
  get_voice_receptionist_settings: 'settings',
  propose_update_voice_receptionist: 'settings',
  get_notification_preferences: 'settings',
  guide_notification_settings: 'settings',
  get_telegram_notification_settings: 'settings',
  guide_telegram_settings: 'settings',
  guide_create_listing: 'settings',

  // analytics
  get_property_analytics: 'analytics',
  get_org_portfolio_analytics: 'analytics',

  // support (help, tickets, announcements, notifications)
  list_support_tickets: 'support',
  get_support_ticket: 'support',
  propose_create_support_ticket: 'support',
  propose_reply_support_ticket: 'support',
  propose_reopen_support_ticket: 'support',
  list_host_announcements: 'support',
  get_host_announcement: 'support',
  propose_mark_notifications_read: 'support',

  // verification (org + listing authorization)
  get_org_verification_status: 'verification',
  propose_apply_org_verification_attachment: 'verification',
  propose_submit_org_verification: 'verification',
  propose_apply_listing_authorization_attachment: 'verification',
  propose_submit_listing_authorization: 'verification',
};

const MODULE_PATTERNS: Array<[AssistantToolModule, RegExp]> = [
  [
    'bookings',
    // Prefix stems (no trailing \b) so "arrives", "cancelled", "checks in" all match.
    /\b(book|reservation|guest|checks? ?-?in|checks? ?-?out|arriv|depart|stay|gaf|pet|document|receipt|valid id|cancel|status|pending|review|workflow|acknowledg|link|airbnb|calendar sync|import|refund|deposit|balance)/i,
  ],
  ['parking', /\b(parking|slot|car|vehicle|plate|spot)\b/i],
  ['finance', /\b(financ|income|expense|revenue|profit|payout|money|paid|cost|earn|net)\w*/i],
  [
    'maintenance',
    /\b(maintenance|repair|fix|broken|clean|aircon|ac unit|leak|ticket for the unit)\w*/i,
  ],
  [
    'pricing',
    /\b(pric|rate|nightly|weekend|weekday|holiday|block|unblock|availability|available|smart pricing|discount)\w*/i,
  ],
  ['inbox', /\b(inbox|message|messages|reply|replies|chat|dm|messenger|instagram|quick repl)\w*/i],
  [
    'marketing',
    /\b(marketing|caption|post|publish|facebook page|social|template design|music|public page|showcase|landing)\w*/i,
  ],
  ['team', /\b(team|member|invite|invitation|staff|role|permission|access for|co-?host)\w*/i],
  [
    'settings',
    /\b(setting|profile|logo|photo|media|house rule|contact|automat|email|notification preference|telegram|receptionist|voice|gcash|payment method|new property|new listing|add (a )?property)\w*/i,
  ],
  [
    'analytics',
    /\b(analytic|occupancy|adr|revpar|performance|portfolio|kpi|trend|compare|all (my )?listings|combined|overall|this month|last month)\w*/i,
  ],
  ['support', /\b(support|help desk|ticket|announcement|notification|bug|feature request)\w*/i],
  ['verification', /\b(verif|verified|authoriz|selfie|proof|badge|listing authorization)\w*/i],
];

/**
 * Intents the core module answers alone (plan / billing questions, page handoffs, deleting a
 * listing or org). They count as a routing signal so these turns send ~8 tools, not all of them.
 */
const CORE_INTENT_PATTERN =
  /\b((my|the|our|current|business|free) plan\b|upgrad|downgrad|subscription|billing|checkout|free trial|open (the|my) \w+ page|take me to|go to|remember|forget|where (do|can) i|delete (this|my|the) (property|listing|org|organization|account))/i;

/** Composer pin types → module. */
const PIN_MODULES: Record<string, AssistantToolModule> = {
  booking: 'bookings',
  parking_booking: 'parking',
  property: 'settings',
  team_member: 'team',
  finance_item: 'finance',
  maintenance_item: 'maintenance',
  pricing_date: 'pricing',
  inbox_conversation: 'inbox',
  marketing_template: 'marketing',
  notification_module: 'settings',
  public_page: 'marketing',
  ticket: 'support',
};

export type ToolRouteInput = {
  message: string;
  attachedTypes: readonly string[];
  pageContext: { propertyId?: string | null; parkingId?: string | null; bookingId?: string | null };
  /** Tool names used earlier in this conversation (most recent turns). */
  recentToolNames: readonly string[];
};

export type ToolRoute = {
  modules: AssistantToolModule[];
  /** True when nothing matched and every tool is sent. */
  failOpen: boolean;
};

export function routeAssistantModules(input: ToolRouteInput): ToolRoute {
  const modules = new Set<AssistantToolModule>(['core']);
  for (const [module, pattern] of MODULE_PATTERNS) {
    if (pattern.test(input.message)) modules.add(module);
  }
  for (const type of input.attachedTypes) {
    const module = PIN_MODULES[type];
    if (module) modules.add(module);
  }
  if (input.pageContext.bookingId) {
    modules.add(input.pageContext.parkingId ? 'parking' : 'bookings');
  }
  const signal = modules.size > 1 || CORE_INTENT_PATTERN.test(input.message);
  for (const name of input.recentToolNames) {
    const module = ASSISTANT_TOOL_MODULES[name];
    if (module) modules.add(module);
  }
  // Words and pins are the real signals; history alone keeps a follow-up on topic.
  if (!signal && modules.size === 1) return { modules: [...modules], failOpen: true };
  // Parking pages route parking questions to the parking module too (bookings, team, dates).
  if (input.pageContext.parkingId && (modules.has('bookings') || modules.has('team'))) {
    modules.add('parking');
  }
  return { modules: [...modules], failOpen: false };
}

/** Filters declarations to the routed modules (unknown tools are kept: fail safe). */
export function selectToolDeclarations<T extends { name: string }>(
  declarations: readonly T[],
  route: ToolRoute
): T[] {
  if (route.failOpen) return [...declarations];
  const wanted = new Set(route.modules);
  return declarations.filter((declaration) => {
    const module = ASSISTANT_TOOL_MODULES[declaration.name];
    return !module || wanted.has(module);
  });
}
