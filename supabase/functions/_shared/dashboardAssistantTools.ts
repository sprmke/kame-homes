/**
 * Fixed tool catalog for the AI dashboard assistant (docs/workflow/planned/ai-dashboard-assistant.md §2).
 *
 * Defense-in-depth by construction: every tool independently re-derives the required permission
 * and re-runs the RBAC primitive (`verifyPropertyAccess`/`verifyOrgAccess`) against the ORIGINAL
 * request's JWT — never anything the model asserts (arguments are untrusted input). Write tools
 * additionally re-derive the risk tier via `classifyActionRisk()`/`assertActionSafeToExecute()`
 * immediately before executing, and Tier-2 actions are never executed inline — they return a
 * `proposed` result for the caller (`dashboard-assistant-chat`) to persist as a pending action.
 *
 * `sync_booking_integrations` from the plan's original catalog is intentionally omitted: this
 * repo has no Google Calendar/Sheets re-sync endpoint or service to wrap (confirmed by grep —
 * `sync-booking-integrations`/`backfill-calendar-event-dates` are empty stub directories with no
 * `index.ts`). Do not add a fake tool for functionality that doesn't exist.
 */

import {
  pendingTasksForBooking,
  sdRefundAmountForBooking,
  buildBookingJourneyData,
} from './dashboardAssistantBlocks.ts';
import { formatBookingHostLabel } from './dashboardAssistantHostDisplay.ts';
import {
  collectAssistantBookingDocuments,
  filterDocumentsByKinds,
  parseDocumentKindArgs,
} from './dashboardAssistantBookingDocuments.ts';
import { manilaTodayIso } from './bookingsListSort.ts';
import { DatabaseService } from './databaseService.ts';
import { computeDashboardStats } from './dashboardService.ts';
import {
  computeFinanceSummary,
  createFinanceLineItem,
  financeThisMonthRange,
  formatFinancePhp,
  listFinanceBookings,
  toHostFacingFinanceKpis,
  type FinanceLineItemKind,
} from './financeService.ts';
import {
  computeMaintenanceSummary,
  createMaintenanceItem,
  listMaintenanceItems,
} from './maintenanceService.ts';
import {
  applyOrganizationProfilePatch,
  OrgProfilePatchError,
  type OrgProfilePatchInput,
} from './orgProfileService.ts';
import {
  cancelOrgInvitation,
  createOrgInvitation,
  listOrgTeamInvitations,
  listOrgTeamMembers,
  removeOrgTeamMember,
  updateOrgTeamMember,
} from './orgTeamService.ts';
import { readOrgVerificationFromSettings } from './orgVerification.ts';
import { resolveInboxAccess } from './inboxAccess.ts';
import {
  InboxSendReplyError,
  loadInboxConversationInScope,
  sendInboxReply,
} from './inboxSendReplyAction.ts';
import { resolveMetaConnectionIdsForScope } from './metaInboxScope.ts';
import { loadParkingPricing, saveParkingPricing } from './parkingPricing.ts';
import {
  claimParkingBooking,
  declineParkingBooking,
  ParkingBroadcastActionError,
} from './parkingBroadcastActions.ts';
import { verifyBookingBelongsToParking } from './parkingScope.ts';
import {
  availableTransitions as parkingAvailableTransitions,
  canTransition as canTransitionParking,
  isParkingStatus,
} from './parkingStatusMachine.ts';
import { isValidCalendarDateKey, loadBlockedDateKeys } from './propertyBlockedDates.ts';
import { loadPropertyPricing, savePropertyPricing } from './propertyPricing.ts';
import {
  applyPropertyProfilePatch,
  applyPropertySettingsPatch,
  PropertyProfilePatchError,
  type PropertyProfilePatchInput,
  type PropertySettingsPatchInput,
} from './propertyProfileService.ts';
import { TEAM_API_PERMISSIONS } from './propertyTeamPermissions.ts';
import {
  cancelPropertyInvitation,
  createPropertyInvitation,
  listPropertyTeamInvitations,
  listPropertyTeamMembers,
  removePropertyTeamMember,
  requireTeamPropertyAccess,
  updatePropertyTeamMember,
} from './propertyTeamService.ts';
import {
  backfillMissingReceiptAiVerdicts,
  dbPatchFromReceiptBackfillItems,
} from './receiptValidationService.ts';
import { suggestInboxReply } from './socialInboxAiService.ts';
import { listConversations, listMessages, markConversationRead } from './socialInboxService.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';
import { normalizeDateToYYYYMMDD } from './utils.ts';
import {
  createServiceClient,
  requirePropertyPermissionAndFeature,
  verifyOrgAccess,
  verifyOrgTeamAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
  verifyPropertyOwner,
} from './orgAuth.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import type { PlanFeatureKey } from './planFeatures.ts';
import { requireMarketingPublishAllowed } from './planEntitlements.ts';
import { updatePropertyPatchPermissions } from './settingsPatchPermissions.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';
import { generateMarketingCaption } from './marketingCaptionAi.ts';
import { generateMarketingTemplateTokens } from './marketingTemplateGenerationAi.ts';
import { fetchJamendoTracks, readJamendoClientId } from './jamendoMusic.ts';
import {
  MarketingPublishError,
  META_PUBLISH_TYPES,
  publishMarketingPost,
  type MetaPublishType,
} from './marketingPublishAction.ts';
import {
  availableTransitions,
  canTransition,
  isBookingStatus,
  STATUS_HUMAN_LABEL,
  type BookingStatus,
} from './statusMachine.ts';
import {
  buildHostFacingFieldsSummary,
  buildPricingBaseRateSummary,
  humanizeTransitionError,
} from './dashboardAssistantActionDisplay.ts';
import { WorkflowOrchestrator } from './workflowOrchestrator.ts';
import { buildActorContext, logActivity } from './activityLog.ts';
import {
  classifyActionRisk,
  READ_TOOL_NAMES,
  TIER1_ONLY_TOOL_NAMES,
  TIER2_ONLY_TOOL_NAMES,
  type ActionRiskTier,
} from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import { queueDeferredTier1Write } from './dashboardAssistantDeferredWrites.ts';
import {
  firstAttachedId,
  firstAttachedPropertyId,
  type AttachedContextItem,
} from './dashboardAssistantAttachedContext.ts';
import {
  APPLY_BOOKING_ATTACHMENT_TOOL_DECLARATION,
  SEND_WORKFLOW_EMAIL_TOOL_DECLARATION,
  executeApplyBookingAttachment,
  executeSendWorkflowEmail,
  toolProposeApplyBookingAttachment,
  toolProposeSendWorkflowEmail,
} from './dashboardAssistantBookingAssetTools.ts';
import {
  APPLY_APP_SETTINGS_ATTACHMENT_TOOL_DECLARATION,
  APPLY_ORG_LOGO_TOOL_DECLARATION,
  APPLY_PARKING_MEDIA_TOOL_DECLARATION,
  APPLY_PROPERTY_MEDIA_TOOL_DECLARATION,
  APPLY_TEMPLATE_ATTACHMENT_TOOL_DECLARATION,
  executeApplyAppSettingsAttachment,
  executeApplyOrgLogo,
  executeApplyParkingMedia,
  executeApplyPropertyMedia,
  executeApplyTemplateAttachment,
  toolProposeApplyAppSettingsAttachment,
  toolProposeApplyOrgLogo,
  toolProposeApplyParkingMedia,
  toolProposeApplyPropertyMedia,
  toolProposeApplyTemplateAttachment,
} from './dashboardAssistantHostMediaTools.ts';
import {
  APPLY_LISTING_AUTHORIZATION_ATTACHMENT_TOOL_DECLARATION,
  APPLY_ORG_VERIFICATION_ATTACHMENT_TOOL_DECLARATION,
  STAGE_GCASH_QR_TOOL_DECLARATION,
  SUBMIT_LISTING_AUTHORIZATION_TOOL_DECLARATION,
  SUBMIT_ORG_VERIFICATION_TOOL_DECLARATION,
  executeApplyListingAuthorizationAttachment,
  executeApplyOrgVerificationAttachment,
  executeStageGcashQr,
  executeSubmitListingAuthorization,
  executeSubmitOrgVerification,
  toolProposeApplyListingAuthorizationAttachment,
  toolProposeApplyOrgVerificationAttachment,
  toolProposeStageGcashQr,
  toolProposeSubmitListingAuthorization,
  toolProposeSubmitOrgVerification,
} from './dashboardAssistantVerificationTools.ts';
import {
  executeCreateSupportTicket,
  GET_HOST_ANNOUNCEMENT_TOOL_DECLARATION,
  GET_ORG_PLAN_SNAPSHOT_TOOL_DECLARATION,
  GET_SUPPORT_TICKET_TOOL_DECLARATION,
  LIST_HOST_ANNOUNCEMENTS_TOOL_DECLARATION,
  LIST_SUPPORT_TICKETS_TOOL_DECLARATION,
  PROPOSE_CREATE_SUPPORT_TICKET_TOOL_DECLARATION,
  resolveInboxReplyAttachments,
  toolGetHostAnnouncement,
  toolGetOrgPlanSnapshot,
  toolGetSupportTicket,
  toolListHostAnnouncements,
  toolListSupportTickets,
  toolProposeCreateSupportTicket,
} from './dashboardAssistantPhase4Tools.ts';
import {
  GET_CHANNEL_SYNC_STATUS_TOOL_DECLARATION,
  GET_PUBLIC_PAGES_STATUS_TOOL_DECLARATION,
  RUN_CHANNEL_SYNC_TOOL_DECLARATION,
  UPDATE_PUBLIC_PAGE_TEMPLATE_TOOL_DECLARATION,
  executeRunChannelSync,
  executeUpdatePublicPageTemplate,
  toolGetChannelSyncStatus,
  toolGetPublicPagesStatus,
  toolProposeRunChannelSync,
  toolProposeUpdatePublicPageTemplate,
} from './dashboardAssistantOpsTools.ts';
import {
  EXPLAIN_ANALYTICS_METRIC_TOOL_DECLARATION,
  GET_PROPERTY_ANALYTICS_TOOL_DECLARATION,
  toolExplainAnalyticsMetric,
  toolGetPropertyAnalytics,
} from './dashboardAssistantAnalyticsTools.ts';
import {
  DELETE_FINANCE_LINE_ITEM_TOOL_DECLARATION,
  DELETE_MAINTENANCE_ITEM_TOOL_DECLARATION,
  UPDATE_FINANCE_LINE_ITEM_TOOL_DECLARATION,
  UPDATE_MAINTENANCE_ITEM_TOOL_DECLARATION,
  executeDeleteFinanceLineItem,
  executeDeleteMaintenanceItem,
  executeUpdateFinanceLineItem,
  executeUpdateMaintenanceItem,
  toolProposeDeleteFinanceLineItem,
  toolProposeDeleteMaintenanceItem,
  toolProposeUpdateFinanceLineItem,
  toolProposeUpdateMaintenanceItem,
} from './dashboardAssistantFinanceMaintenanceTools.ts';
import {
  GET_NOTIFICATION_PREFERENCES_TOOL_DECLARATION,
  GET_TELEGRAM_NOTIFICATION_SETTINGS_TOOL_DECLARATION,
  GUIDE_CREATE_BOOKING_TOOL_DECLARATION,
  GUIDE_IMPORT_BOOKINGS_TOOL_DECLARATION,
  GUIDE_NOTIFICATION_SETTINGS_TOOL_DECLARATION,
  GUIDE_TELEGRAM_SETTINGS_TOOL_DECLARATION,
  toolGetNotificationPreferences,
  toolGetTelegramNotificationSettings,
  toolGuideCreateBooking,
  toolGuideImportBookings,
  toolGuideNotificationSettings,
  toolGuideTelegramSettings,
} from './dashboardAssistantGuidanceTools.ts';
import { downloadAssistantAttachment } from './assistantAttachmentApply.ts';
import { uploadMarketingMediaFromAssistantBytes } from './marketingMediaUpload.ts';
import { validateToolArgs } from './ai/toolArgs.ts';

export type ToolExecutionContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; parkingId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  /**
   * Forces Tier 2 (host confirm): more than one write this turn, or the turn already read
   * guest-written content (prompt-injection escalation; see UNTRUSTED_CONTENT_TOOL_NAMES).
   */
  isBulk: boolean;
  /** When true, Tier-1 writes queue until end-of-turn commit (cancel-safe). */
  deferWritesUntilCommit?: boolean;
  deferredWrites?: Array<{ toolName: string; args: Record<string, unknown> }>;
  /** Current assistant conversation — required for attachment apply path checks. */
  conversationId?: string | null;
  /** Storage paths attached on this user turn (host uploaded this message). */
  turnAttachmentPaths?: string[];
};

/** Writes whose own execution path already records activity (workflow orchestrator). */
const SELF_AUDITED_TOOL_NAMES = new Set(['propose_transition_booking', 'propose_cancel_booking']);

/**
 * One org activity-feed event per assistant-executed write, emitted from the two chokepoints
 * every write passes (Tier-1 commit in dashboard-assistant-chat, Tier-2 dashboard-assistant-confirm)
 * so no individual tool can forget it. Never throws (logActivity swallows).
 */
export async function logAssistantWriteActivity(
  ctx: ToolExecutionContext,
  toolName: string,
  result: ToolResult,
  riskTier: 'tier1_auto' | 'tier2_confirmed'
): Promise<void> {
  if (!result.ok || result.proposed || SELF_AUDITED_TOOL_NAMES.has(toolName)) return;
  await logActivity({
    action: 'ai.assistant_action_executed',
    organizationId: ctx.organizationId,
    propertyId: result.auditPropertyId ?? null,
    actor: assistantActorContext(ctx),
    targetType: result.auditBookingId ? 'booking' : 'assistant_action',
    targetId: result.auditBookingId ?? null,
    metadata: {
      tool: toolName,
      action: toolName.replace(/^propose_/, '').replace(/_/g, ' '),
      risk_tier: riskTier,
    },
  });
}

/** Activity-log actor for an AI-assistant-initiated write — single emit path,
 *  attributed to `ai_assistant` with the conversation id + initiating user. */
export function assistantActorContext(ctx: ToolExecutionContext) {
  return buildActorContext(
    'ai_assistant',
    {
      assistant: {
        conversationId: ctx.conversationId ?? 'unknown',
        userId: ctx.userId,
        email: ctx.userEmail,
      },
    },
    ctx.req
  );
}

export type ToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  /** Only set for tools in the write catalog. */
  riskTier?: ActionRiskTier;
  /** True when a Tier-2 write tool returned a proposal rather than executing. */
  proposed?: boolean;
  /** True when a Tier-1 write was queued for end-of-turn commit. */
  deferred?: boolean;
  auditPropertyId?: string | null;
  auditBookingId?: string | null;
};

const ALL_TOOL_NAMES = new Set([
  ...READ_TOOL_NAMES,
  ...TIER1_ONLY_TOOL_NAMES,
  ...TIER2_ONLY_TOOL_NAMES,
  'propose_transition_booking',
]);

export function isKnownTool(toolName: string): boolean {
  return ALL_TOOL_NAMES.has(toolName);
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function defaultPropertyId(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): string | undefined {
  return (
    str(args, 'propertyId') ??
    firstAttachedId(ctx.attachedContext, 'property') ??
    firstAttachedPropertyId(ctx.attachedContext) ??
    ctx.pageContext.propertyId ??
    undefined
  );
}

function defaultBookingId(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): string | undefined {
  return (
    str(args, 'bookingId') ??
    firstAttachedId(ctx.attachedContext, 'booking') ??
    firstAttachedId(ctx.attachedContext, 'parking_booking') ??
    ctx.pageContext.bookingId ??
    undefined
  );
}

/** Resolves + RBAC-verifies the property a tool call targets — explicit arg, else attached, else pageContext. */
async function resolveTargetProperty(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>,
  requiredPermission: Parameters<typeof verifyPropertyAccess>[2]
): Promise<{ propertyId: string; orgId: string }> {
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) {
    throw new Error('propertyId is required (no property in scope)');
  }
  const access = await verifyPropertyAccess(ctx.req, propertyId, requiredPermission);
  return { propertyId: access.property.id, orgId: access.org.id };
}

/** Resolves the property a bookingId belongs to and RBAC-verifies it, org-wide. */
async function resolveBookingProperty(
  ctx: ToolExecutionContext,
  bookingId: string,
  requiredPermission: Parameters<typeof verifyPropertyAccess>[2]
): Promise<string> {
  const resolvedId = bookingId || defaultBookingId(ctx, {}) || '';
  if (!resolvedId) throw new Error('Booking not found');
  const sb = createServiceClient();
  const { data: row, error } = await sb
    .from('guest_submissions')
    .select('property_id')
    .eq('id', resolvedId)
    .maybeSingle();
  if (error || !row) throw new Error(`Booking not found: ${resolvedId}`);
  const propertyId = row.property_id as string;
  await verifyPropertyAccess(ctx.req, propertyId, requiredPermission);
  return propertyId;
}

// ─── Read tools (Tier 0, always allowed) ─────────────────────────────────────

async function toolSearchKnowledgeBase(args: Record<string, unknown>): Promise<ToolResult> {
  const query = str(args, 'query');
  if (!query) return { ok: false, error: 'query is required' };
  // Parameterized, ranked FTS (never interpolate model/user text into a PostgREST filter).
  const { data, error } = await createServiceClient().rpc('search_ai_assistant_knowledge_base', {
    p_query: query,
    p_limit: 5,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      question: row.question,
      answer: row.answer,
      route_path: row.route_path,
      source: row.route_guide_path,
    })),
  };
}

function toolExplainBookingStatus(args: Record<string, unknown>): ToolResult {
  const status = str(args, 'status');
  if (!status || !isBookingStatus(status)) {
    return { ok: false, error: `Unknown status: ${status ?? ''}` };
  }
  const nextOptions = availableTransitions(status, { manual: true });
  return {
    ok: true,
    data: {
      status,
      label: STATUS_HUMAN_LABEL[status],
      nextOptions: nextOptions.map((s) => ({ status: s, label: STATUS_HUMAN_LABEL[s] })),
    },
  };
}

async function toolGetBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  const propertyId = await resolveBookingProperty(ctx, bookingId, 'bookings:view');

  const sb = createServiceClient();
  const [{ data: booking }, { data: property }] = await Promise.all([
    sb.from('guest_submissions').select('*').eq('id', bookingId).maybeSingle(),
    sb.from('properties').select('id, name').eq('id', propertyId).maybeSingle(),
  ]);
  if (!booking) return { ok: false, error: 'Booking not found' };

  const totalDue = computeTotalGuestBalanceFromBooking(booking as Record<string, unknown>);
  const balanceDue = totalDue === null ? null : totalDue - num(booking.guest_balance_paid_amount);
  const status = String(booking.status ?? '');
  const bookingRecord = booking as Record<string, unknown>;

  return {
    ok: true,
    auditPropertyId: propertyId,
    auditBookingId: bookingId,
    data: {
      bookingId: booking.id,
      hostLabel: formatBookingHostLabel({
        guestName: booking.primary_guest_name || booking.guest_facebook_name || '',
        checkIn: booking.check_in_date,
        checkOut: booking.check_out_date,
        statusLabel: isBookingStatus(status) ? STATUS_HUMAN_LABEL[status] : status,
      }),
      guestName: booking.primary_guest_name || booking.guest_facebook_name || '',
      status,
      statusLabel: isBookingStatus(status) ? STATUS_HUMAN_LABEL[status] : status,
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      propertyId,
      propertyName: property?.name ?? '',
      balanceDue,
      securityDeposit: num(booking.security_deposit),
      sdRefundAmount: sdRefundAmountForBooking(bookingRecord),
      sdRefundFormSubmitted: Boolean(booking.sd_refund_form_submitted_at),
      pendingTasks: pendingTasksForBooking(bookingRecord),
      documents: collectAssistantBookingDocuments(bookingRecord),
    },
  };
}

async function toolGetBookingDocuments(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = defaultBookingId(ctx, args);
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  const propertyId = await resolveBookingProperty(ctx, bookingId, 'bookings:view');

  const sb = createServiceClient();
  const { data: booking } = await sb
    .from('guest_submissions')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: 'Booking not found' };

  const kinds = parseDocumentKindArgs(args.kinds);
  const all = collectAssistantBookingDocuments(booking as Record<string, unknown>);
  const documents = filterDocumentsByKinds(all, kinds);
  const missing =
    kinds?.filter((kind) => !documents.some((doc) => doc.group === kind)).map((kind) => kind) ?? [];

  return {
    ok: true,
    auditPropertyId: propertyId,
    auditBookingId: bookingId,
    data: {
      bookingId,
      documents,
      missing,
    },
  };
}

async function toolListBookings(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const explicitPropertyId = defaultPropertyId(ctx, args);
  const status = Array.isArray(args.status)
    ? (args.status as string[]).filter(isBookingStatus)
    : undefined;

  let propertyId: string | undefined;
  let orgId: string | undefined;
  if (explicitPropertyId) {
    const access = await verifyPropertyAccess(ctx.req, explicitPropertyId, 'bookings:view');
    propertyId = access.property.id;
  } else {
    const access = await verifyOrgAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      'org.bookings:view'
    );
    orgId = access.org.id;
  }

  const result = await DatabaseService.listBookings({
    propertyId,
    orgId,
    bookingKind: orgId ? 'property' : undefined,
    status,
    q: str(args, 'q') ?? str(args, 'guestName') ?? undefined,
    from: str(args, 'from') ?? null,
    to: str(args, 'to') ?? null,
    page: 1,
    limit: 40,
    sort: 'check_in_date:asc',
    showCompletedBookings: Boolean(str(args, 'from') || str(args, 'to')),
  });

  const nameById = new Map<string, string>();
  const ids = [
    ...new Set(
      result.rows
        .map((row) => String((row as { property_id?: string }).property_id ?? ''))
        .filter(Boolean)
    ),
  ];
  if (ids.length > 0) {
    const sb = createServiceClient();
    const { data: properties } = await sb.from('properties').select('id, name').in('id', ids);
    for (const property of properties ?? []) {
      nameById.set(String(property.id), String(property.name ?? ''));
    }
  }

  return {
    ok: true,
    data: {
      total: result.total,
      bookings: result.rows.map((row) => {
        const r = row as Record<string, unknown>;
        const rowStatus = String(r.status ?? '');
        return {
          bookingId: r.id,
          hostLabel: formatBookingHostLabel({
            guestName: r.primary_guest_name || r.guest_facebook_name || '',
            checkIn: r.check_in_date,
            checkOut: r.check_out_date,
            statusLabel: isBookingStatus(rowStatus) ? STATUS_HUMAN_LABEL[rowStatus] : rowStatus,
          }),
          guestName: r.primary_guest_name || r.guest_facebook_name || '',
          status: rowStatus,
          statusLabel: isBookingStatus(rowStatus) ? STATUS_HUMAN_LABEL[rowStatus] : rowStatus,
          checkIn: r.check_in_date,
          checkOut: r.check_out_date,
          propertyName: nameById.get(String(r.property_id ?? '')) ?? '',
        };
      }),
    },
  };
}

async function toolGetAvailableTransitions(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  await resolveBookingProperty(ctx, bookingId, 'bookings:view');

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };
  const status = booking.status as string;
  if (!isBookingStatus(status)) return { ok: false, error: `Unrecognized status: ${status}` };

  const options = availableTransitions(status, { manual: true });
  return {
    ok: true,
    data: {
      bookingId,
      currentStatus: status,
      currentStatusLabel: STATUS_HUMAN_LABEL[status],
      options: options.map((s) => ({ status: s, label: STATUS_HUMAN_LABEL[s] })),
    },
  };
}

async function toolPlanBookingJourney(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId') ?? defaultBookingId(ctx, args);
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  await resolveBookingProperty(ctx, bookingId, 'bookings:view');

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };

  return {
    ok: true,
    data: buildBookingJourneyData(booking as Record<string, unknown>),
  };
}

function parseDateOnly(value: string): Date | null {
  const key = normalizeDateToYYYYMMDD(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const MAX_AVAILABILITY_WINDOW_DAYS = 120;

async function toolGetAvailableDates(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'bookings:view');

  const todayKey = manilaTodayIso();
  const today = parseDateOnly(todayKey) ?? new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const fromArg = str(args, 'from');
  const requestedFrom = fromArg ? parseDateOnly(fromArg) : monthStart;
  const windowFrom = requestedFrom ?? monthStart;

  const toArg = str(args, 'to');
  let windowTo = toArg ? parseDateOnly(toArg) : null;
  if (!windowTo || windowTo < windowFrom) {
    windowTo = new Date(windowFrom.getFullYear(), windowFrom.getMonth() + 1, 0);
  }
  const maxTo = addDays(windowFrom, MAX_AVAILABILITY_WINDOW_DAYS);
  if (windowTo > maxTo) windowTo = maxTo;

  const availabilityFrom = windowFrom < today ? today : windowFrom;
  const fromKey = formatDateKey(availabilityFrom);
  const toKey = formatDateKey(windowTo);
  const bookedFromKey = formatDateKey(windowFrom);

  const sb = createServiceClient();
  const [{ data: bookings, error }, { data: property }] = await Promise.all([
    sb
      .from('guest_submissions')
      .select('id, primary_guest_name, guest_facebook_name, check_in_date, check_out_date, status')
      .eq('property_id', propertyId)
      .neq('status', 'CANCELLED')
      .neq('status', 'IMPORTED'),
    sb.from('properties').select('name').eq('id', propertyId).maybeSingle(),
  ]);
  if (error) return { ok: false, error: error.message };

  const blockedKeys = new Set(await loadBlockedDateKeys(propertyId, fromKey, toKey));
  const bookedStays: Array<{
    bookingId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: string;
    statusLabel: string;
  }> = [];

  for (const booking of bookings ?? []) {
    const ci = parseDateOnly(booking.check_in_date as string);
    const co = parseDateOnly(booking.check_out_date as string);
    if (!ci || !co) continue;
    if (co <= windowFrom || ci > windowTo) continue;

    const rowStatus = String(booking.status ?? '');
    bookedStays.push({
      bookingId: String(booking.id),
      hostLabel: formatBookingHostLabel({
        guestName: String(booking.primary_guest_name || booking.guest_facebook_name || ''),
        checkIn: formatDateKey(ci),
        checkOut: formatDateKey(co),
        statusLabel: isBookingStatus(rowStatus) ? STATUS_HUMAN_LABEL[rowStatus] : rowStatus,
      }),
      guestName: String(booking.primary_guest_name || booking.guest_facebook_name || ''),
      checkIn: formatDateKey(ci),
      checkOut: formatDateKey(co),
      status: rowStatus,
      statusLabel: isBookingStatus(rowStatus) ? STATUS_HUMAN_LABEL[rowStatus] : rowStatus,
    });

    let night = ci > availabilityFrom ? ci : availabilityFrom;
    const lastNight = addDays(co, -1);
    const end = lastNight < windowTo ? lastNight : windowTo;
    while (night <= end) {
      blockedKeys.add(formatDateKey(night));
      night = addDays(night, 1);
    }
  }

  bookedStays.sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const availableRanges: Array<{ start: string; end: string }> = [];
  let rangeStart: Date | null = null;
  let cursor = availabilityFrom;
  while (cursor <= windowTo) {
    const isFree = !blockedKeys.has(formatDateKey(cursor));
    if (isFree && rangeStart === null) {
      rangeStart = cursor;
    } else if (!isFree && rangeStart !== null) {
      availableRanges.push({
        start: formatDateKey(rangeStart),
        end: formatDateKey(addDays(cursor, -1)),
      });
      rangeStart = null;
    }
    cursor = addDays(cursor, 1);
  }
  if (rangeStart !== null) {
    availableRanges.push({ start: formatDateKey(rangeStart), end: formatDateKey(windowTo) });
  }

  const availableNightCount = availableRanges.reduce((sum, range) => {
    const start = parseDateOnly(range.start)!;
    const end = parseDateOnly(range.end)!;
    return sum + Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }, 0);

  return {
    ok: true,
    auditPropertyId: propertyId,
    data: {
      propertyId,
      propertyName: property?.name ?? '',
      from: bookedFromKey,
      to: toKey,
      bookedStays,
      bookedStayCount: bookedStays.length,
      availableRanges,
      availableNightCount,
      fullyBooked: availableRanges.length === 0,
    },
  };
}

async function toolGetDashboardStats(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const explicitPropertyId = defaultPropertyId(ctx, args);
  let propertyId: string | undefined;
  let orgId: string | undefined;
  if (explicitPropertyId) {
    const access = await verifyPropertyAccess(ctx.req, explicitPropertyId, 'bookings:view');
    propertyId = access.property.id;
  } else {
    const access = await verifyOrgAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      'org.dashboard:view'
    );
    orgId = access.org.id;
  }
  const data = await computeDashboardStats({
    propertyId,
    orgId,
    from: str(args, 'from') ?? null,
    to: str(args, 'to') ?? null,
  });
  return { ok: true, data };
}

async function toolGetFinanceSummary(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'finance:view');
  const month = financeThisMonthRange(manilaTodayIso());
  const from = str(args, 'from') ?? month.from;
  const to = str(args, 'to') ?? month.to;
  // Match Finance page defaults: check-in basis, include cancelled stays in the period filter set.
  const summary = await computeFinanceSummary({
    propertyId,
    from,
    to,
    basis: 'check_in',
    includeCancelled: true,
    completedOnly: false,
  });
  const kpis = toHostFacingFinanceKpis(summary);
  const sb = createServiceClient();
  const { data: property } = await sb
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .maybeSingle();
  const propertyName = property?.name ? String(property.name) : propertyId;
  return {
    ok: true,
    data: {
      propertyId,
      propertyName,
      period: { from, to, basis: 'check_in' },
      // Same labels/math as Finance page summary cards — use these for profit questions.
      totalIncome: kpis.totalIncome,
      totalExpenses: kpis.totalExpenses,
      netProfit: kpis.netProfit,
      pendingPayments: kpis.pendingPayments,
      display: {
        totalIncome: formatFinancePhp(kpis.totalIncome),
        totalExpenses: formatFinancePhp(kpis.totalExpenses),
        netProfit: formatFinancePhp(kpis.netProfit),
        pendingPayments: formatFinancePhp(kpis.pendingPayments),
      },
      explanation:
        'Net profit = total income − total expenses for this property and period (same as the Finance page). Income includes completed stay net, in-progress stay projections, and manual income. Expenses include manual expenses and stay-related costs.',
      stays: {
        count: summary.stays.count,
        completedCount: summary.stays.completedCount,
        hostNetCompleted: summary.stays.hostNetCompleted,
        projectedNetPipeline: summary.stays.projectedNetPipeline,
      },
      operating: summary.operating,
    },
  };
}

async function toolListFinanceBookings(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'finance:view');
  const month = financeThisMonthRange(manilaTodayIso());
  const { rows, total } = await listFinanceBookings({
    propertyId,
    from: str(args, 'from') ?? month.from,
    to: str(args, 'to') ?? month.to,
    basis: 'check_in',
    includeCancelled: true,
    completedOnly: false,
    page: 1,
    limit: 10,
    sort: 'check_in_date:desc',
  });
  return {
    ok: true,
    data: {
      total,
      rows: rows.map((r) => {
        const guestName = r.primary_guest_name || r.guest_facebook_name || '';
        const statusLabel = isBookingStatus(r.status) ? STATUS_HUMAN_LABEL[r.status] : r.status;
        return {
          ...r,
          hostLabel: formatBookingHostLabel({
            guestName,
            checkIn: r.check_in_date,
            checkOut: r.check_out_date,
            statusLabel,
          }),
          statusLabel,
        };
      }),
    },
  };
}

async function toolGetMaintenanceSummary(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'maintenance:view');
  const data = await computeMaintenanceSummary({
    propertyId,
    from: str(args, 'from') ?? null,
    to: str(args, 'to') ?? null,
  });
  return { ok: true, data };
}

async function toolListMaintenanceItems(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'maintenance:view');
  const items = await listMaintenanceItems({
    propertyId,
    from: str(args, 'from') ?? null,
    to: str(args, 'to') ?? null,
  });
  return {
    ok: true,
    data: items.slice(0, 10).map((item) => ({
      id: item.id,
      hostLabel: [item.label, item.completed_at ? 'Done' : 'Open'].filter(Boolean).join(' · '),
      label: item.label,
      category: item.category,
      scheduledOn: item.scheduled_on,
      completedAt: item.completed_at,
      notes: item.notes,
    })),
  };
}

async function toolGetOrgProfile(ctx: ToolExecutionContext): Promise<ToolResult> {
  await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings:view');
  const sb = createServiceClient();
  const { data: org, error } = await sb
    .from('organizations')
    .select('id, name, slug, description, logo_url, settings')
    .eq('id', ctx.organizationId)
    .maybeSingle();
  if (error || !org) return { ok: false, error: 'Organization not found' };
  const settings = (org.settings ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logo_url,
      tagline: settings.tagline ?? null,
      brandColor: settings.brandColor ?? null,
      contactName: settings.contactName ?? null,
      contactRole: settings.contactRole ?? null,
      contactPhone: settings.contactPhone ?? null,
      contactEmail: settings.contactEmail ?? null,
    },
  };
}

async function toolGetOrgVerificationStatus(ctx: ToolExecutionContext): Promise<ToolResult> {
  await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings:view');
  const sb = createServiceClient();
  const { data: org, error } = await sb
    .from('organizations')
    .select('settings')
    .eq('id', ctx.organizationId)
    .maybeSingle();
  if (error || !org) return { ok: false, error: 'Organization not found' };
  const verification = readOrgVerificationFromSettings(org.settings as Record<string, unknown>);
  return {
    ok: true,
    data: {
      baseStatus: verification.baseStatus,
      enhancedStatus: verification.enhancedStatus,
      verifiedBadge: verification.enhancedStatus === 'approved',
    },
  };
}

async function toolListTeamMembers(ctx: ToolExecutionContext): Promise<ToolResult> {
  const teamCtx = await verifyOrgTeamAccess(ctx.req, { orgId: ctx.organizationId });
  const members = await listOrgTeamMembers(teamCtx);
  return {
    ok: true,
    data: members.map((m) => ({
      id: m.id,
      hostLabel: [m.name, m.role].filter(Boolean).join(' · ') || m.email || 'Team member',
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
      isOwner: m.isOwner,
    })),
  };
}

async function toolListPendingInvitations(ctx: ToolExecutionContext): Promise<ToolResult> {
  const teamCtx = await verifyOrgTeamAccess(ctx.req, { orgId: ctx.organizationId });
  const invitations = await listOrgTeamInvitations(teamCtx.org.id);
  return {
    ok: true,
    data: invitations
      .filter((i) => i.status === 'pending')
      .map((i) => ({
        id: i.id,
        hostLabel: [i.email, i.role].filter(Boolean).join(' · ') || i.email,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
      })),
  };
}

async function toolGetPropertyProfile(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'settings:view');
  const sb = createServiceClient();
  const { data: property, error } = await sb
    .from('properties')
    .select('id, name, slug, status, type, address, tower, unit_number, residence_name, max_guests')
    .eq('id', propertyId)
    .maybeSingle();
  if (error || !property) return { ok: false, error: 'Property not found' };
  return {
    ok: true,
    auditPropertyId: propertyId,
    data: {
      name: property.name,
      slug: property.slug,
      status: property.status,
      type: property.type,
      address: property.address,
      towerAndUnit: [property.tower, property.unit_number].filter(Boolean).join(' '),
      residenceName: property.residence_name,
      maxGuests: property.max_guests,
    },
  };
}

async function toolGetPropertySettings(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'settings:view');
  const sb = createServiceClient();
  const { data: property, error } = await sb
    .from('properties')
    .select('settings')
    .eq('id', propertyId)
    .maybeSingle();
  if (error || !property) return { ok: false, error: 'Property not found' };
  const settings = (property.settings ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    auditPropertyId: propertyId,
    data: {
      contactName: settings.contactName ?? null,
      contactPhone: settings.contactPhone ?? null,
      contactEmail: settings.contactEmail ?? null,
      bedrooms: settings.bedrooms ?? null,
      bathrooms: settings.bathrooms ?? null,
      floors: settings.floors ?? null,
      maxAdults: settings.maxAdults ?? null,
      maxChildren: settings.maxChildren ?? null,
      description: settings.description ?? null,
      customHouseRules: settings.customHouseRules ?? [],
      customAmenities: settings.customAmenities ?? [],
      cancellationPolicy: settings.cancellationPolicy ?? null,
    },
  };
}

async function toolListPropertyTeamMembers(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };
  const teamCtx = await requireTeamPropertyAccess(
    ctx.req,
    propertyId,
    TEAM_API_PERMISSIONS.listMembers
  );
  const members = await listPropertyTeamMembers(teamCtx);
  return {
    ok: true,
    auditPropertyId: propertyId,
    data: members.map((m) => ({
      id: m.id,
      hostLabel: [m.name, m.role].filter(Boolean).join(' · ') || m.email || 'Team member',
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
    })),
  };
}

async function toolListPropertyPendingInvitations(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };
  const teamCtx = await requireTeamPropertyAccess(
    ctx.req,
    propertyId,
    TEAM_API_PERMISSIONS.listInvitations
  );
  const invitations = await listPropertyTeamInvitations(teamCtx.property.id);
  return {
    ok: true,
    auditPropertyId: propertyId,
    data: invitations
      .filter((i) => i.status === 'pending')
      .map((i) => ({
        id: i.id,
        hostLabel: [i.email, i.role].filter(Boolean).join(' · ') || i.email,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
      })),
  };
}

async function toolListParkings(ctx: ToolExecutionContext): Promise<ToolResult> {
  const access = await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:view');
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('parkings')
    .select('id, name, slug, status, parking_type, rate_per_night')
    .eq('organization_id', access.org.id)
    .order('name', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((p) => ({
      id: p.id,
      hostLabel: p.name || 'Parking',
      name: p.name,
      slug: p.slug,
      status: p.status,
      parkingType: p.parking_type,
      ratePerNight: p.rate_per_night,
    })),
  };
}

async function toolGetParkingBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || !booking.parking_id) return { ok: false, error: 'Parking booking not found' };
  const parkingId = String(booking.parking_id);
  await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:view');

  return {
    ok: true,
    auditBookingId: bookingId,
    data: {
      bookingId: booking.id,
      hostLabel: formatBookingHostLabel({
        guestName: booking.primary_guest_name ?? '',
        checkIn: booking.parking_check_in_date ?? booking.check_in_date,
        checkOut: booking.parking_check_out_date ?? booking.check_out_date,
      }),
      guestName: booking.primary_guest_name ?? '',
      status: booking.status,
      checkIn: booking.parking_check_in_date ?? booking.check_in_date,
      checkOut: booking.parking_check_out_date ?? booking.check_out_date,
      parkingId,
    },
  };
}

async function toolListParkingBookings(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const explicitParkingId = str(args, 'parkingId');
  const status = Array.isArray(args.status)
    ? (args.status as string[]).filter(isParkingStatus)
    : undefined;

  let parkingId: string | undefined;
  let orgId: string | undefined;
  if (explicitParkingId) {
    await verifyParkingTeamAccess(ctx.req, explicitParkingId, 'bookings:view');
    parkingId = explicitParkingId;
  } else {
    const access = await verifyOrgAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      'org.parkings:view'
    );
    orgId = access.org.id;
  }

  const result = await DatabaseService.listBookings({
    parkingId,
    orgId,
    bookingKind: 'parking',
    status,
    from: str(args, 'from') ?? null,
    to: str(args, 'to') ?? null,
    page: 1,
    limit: 10,
    sort: 'check_in_date:asc',
  });

  return {
    ok: true,
    data: {
      total: result.total,
      bookings: result.rows.map((row) => {
        const r = row as Record<string, unknown>;
        const rowStatus = String(r.status ?? '');
        const guestName = String(r.primary_guest_name || r.guest_facebook_name || '');
        const checkIn = String(r.parking_check_in_date ?? r.check_in_date ?? '');
        const checkOut = String(r.parking_check_out_date ?? r.check_out_date ?? '');
        return {
          bookingId: r.id,
          hostLabel: formatBookingHostLabel({ guestName, checkIn, checkOut }),
          guestName,
          status: rowStatus,
          checkIn,
          checkOut,
        };
      }),
    },
  };
}

async function toolGetParkingAvailableTransitions(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || !booking.parking_id) return { ok: false, error: 'Parking booking not found' };
  const parkingId = String(booking.parking_id);
  await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:view');

  const status = String(booking.status ?? '');
  if (!isParkingStatus(status)) return { ok: false, error: `Unrecognized status: ${status}` };
  if (status === 'PENDING_HOST_ACCEPTANCE') {
    return {
      ok: true,
      auditBookingId: bookingId,
      data: {
        bookingId,
        currentStatus: status,
        options: [],
        note: 'This request is still awaiting broadcast response — resolves only via claim, decline, or expiry, not a direct transition.',
      },
    };
  }

  const options = parkingAvailableTransitions(status);
  return {
    ok: true,
    auditBookingId: bookingId,
    data: { bookingId, currentStatus: status, options },
  };
}

async function toolGetPropertyPricing(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const { propertyId } = await resolveTargetProperty(ctx, args, 'pricing:view');
  const data = await loadPropertyPricing(propertyId);
  return {
    ok: true,
    auditPropertyId: propertyId,
    data: {
      weekdayNightlyRate: data.weekdayNightlyRate,
      weekendNightlyRate: data.weekendNightlyRate,
      downPayment: data.downPayment,
      securityDeposit: data.securityDeposit,
      petFee: data.petFee,
      parkingRateGuest: data.parkingRateGuest,
      guestAdditionalFee: data.guestAdditionalFee,
      // Capped — a full-year override map isn't useful in a chat response; ask for a date/range instead.
      dateOverrides: Object.fromEntries(Object.entries(data.dateOverrides).slice(0, 30)),
      blockedDateKeys: data.blockedDateKeys.slice(0, 30),
      holidayRules: data.holidayRules,
    },
  };
}

async function toolGetParkingPricing(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const parkingId = str(args, 'parkingId');
  if (!parkingId) return { ok: false, error: 'parkingId is required' };
  await verifyParkingTeamAccess(ctx.req, parkingId, 'pricing:view');
  const data = await loadParkingPricing(parkingId);
  return {
    ok: true,
    data: {
      weekdayNightlyRate: data.weekdayNightlyRate,
      weekendNightlyRate: data.weekendNightlyRate,
      dateOverrides: Object.fromEntries(Object.entries(data.dateOverrides).slice(0, 30)),
    },
  };
}

function inboxScopeArgs(args: Record<string, unknown>): {
  propertyId?: string;
  parkingId?: string;
} {
  const propertyId = str(args, 'propertyId');
  const parkingId = str(args, 'parkingId');
  return {
    ...(propertyId ? { propertyId } : {}),
    ...(parkingId ? { parkingId } : {}),
  };
}

async function toolListInboxThreads(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'view', scopeArgs);
  const status = str(args, 'status');
  const metaConnectionIds = await resolveMetaConnectionIdsForScope(inboxCtx.orgId, inboxCtx.scope);
  const filter = {
    type: 'all' as const,
    status: (status === 'unread' || status === 'pending' || status === 'replied'
      ? status
      : 'all') as 'unread' | 'pending' | 'replied' | 'all',
    platform: 'all' as const,
    propertyId: inboxCtx.propertyId,
    parkingId: inboxCtx.parkingId,
    metaConnectionIds,
    limit: 10,
  };
  const { conversations } = await listConversations(inboxCtx.orgId, filter);
  return {
    ok: true,
    data: conversations.map((c) => ({
      conversationId: c.id,
      hostLabel: [c.participant_name, c.platform].filter(Boolean).join(' · ') || 'Conversation',
      platform: c.platform,
      participantName: c.participant_name,
      subjectPreview: c.subject_preview,
      lastMessageAt: c.last_message_at,
      unreadCount: c.unread_count,
      replyStatus: c.reply_status,
    })),
  };
}

async function toolGetInboxThread(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const conversationId = str(args, 'conversationId');
  if (!conversationId) return { ok: false, error: 'conversationId is required' };
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'view', scopeArgs);
  const metaConnectionIds = await resolveMetaConnectionIdsForScope(inboxCtx.orgId, inboxCtx.scope);
  const conv = await loadInboxConversationInScope(
    inboxCtx,
    conversationId,
    new Set(metaConnectionIds)
  );
  const { messages } = await listMessages(inboxCtx.orgId, conversationId, { limit: 20 });
  return {
    ok: true,
    data: {
      conversationId: conv.id,
      hostLabel:
        [conv.participant_name, conv.platform].filter(Boolean).join(' · ') || 'Conversation',
      platform: conv.platform,
      participantName: conv.participant_name,
      replyStatus: conv.reply_status,
      messages: messages.map((m) => ({
        direction: m.direction,
        text: m.body_text,
        sentAt: m.sent_at,
      })),
    },
  };
}

async function toolGetInboxSettings(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'automation', scopeArgs);
  const sb = createServiceClient();
  const settingsQuery = sb
    .from('social_inbox_settings')
    .select('auto_reply_enabled, auto_reply_mode')
    .eq('organization_id', inboxCtx.orgId);
  const { data } = await (
    inboxCtx.parkingId
      ? settingsQuery.eq('parking_id', inboxCtx.parkingId)
      : settingsQuery.is('parking_id', null)
  ).maybeSingle();
  return {
    ok: true,
    data: {
      autoReplyEnabled: data?.auto_reply_enabled ?? false,
      autoReplyMode: data?.auto_reply_mode ?? 'draft',
    },
  };
}

async function toolListInboxQuickReplyTemplates(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'quick_replies', scopeArgs);
  const sb = createServiceClient();
  const templatesQuery = sb
    .from('social_reply_templates')
    .select('id, title, body_text')
    .eq('organization_id', inboxCtx.orgId)
    .eq('is_active', true);
  const { data, error } = await (
    inboxCtx.parkingId
      ? templatesQuery.eq('parking_id', inboxCtx.parkingId)
      : templatesQuery.is('parking_id', null)
  ).order('sort_order', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((t) => ({
      id: t.id,
      hostLabel: t.title || 'Quick reply',
      title: t.title,
      bodyText: t.body_text,
    })),
  };
}

/**
 * Marketing Studio tools use the same property-team RBAC + plan gates as the edge functions (Phase 7).
 */
async function verifyMarketingPropertyAccess(
  ctx: ToolExecutionContext,
  propertyId: string,
  permission: TeamPermissionId,
  feature?: PlanFeatureKey
): Promise<{ propertyId: string; organizationId: string }> {
  await requirePropertyPermissionAndFeature(ctx.req, propertyId, permission, feature);
  const organizationId = await resolveOrganizationIdForProperty(propertyId);
  return { propertyId, organizationId };
}

async function toolListMarketingTemplates(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = str(args, 'propertyId');
  if (!propertyId) return { ok: false, error: 'propertyId is required' };
  const access = await verifyMarketingPropertyAccess(
    ctx,
    propertyId,
    'marketing:view',
    'marketingStudio'
  );
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('marketing_templates')
    .select('id, name, content_type, platform, aspect_preset, updated_at')
    .eq('property_id', access.propertyId)
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    auditPropertyId: access.propertyId,
    data: (data ?? []).map((t) => ({
      id: t.id,
      hostLabel: [t.name, t.platform].filter(Boolean).join(' · ') || t.name || 'Template',
      name: t.name,
      contentType: t.content_type,
      platform: t.platform,
      updatedAt: t.updated_at,
    })),
  };
}

async function toolGetMarketingPublishHistory(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = str(args, 'propertyId');
  if (!propertyId) return { ok: false, error: 'propertyId is required' };
  const access = await verifyMarketingPropertyAccess(
    ctx,
    propertyId,
    'marketing:view',
    'marketingStudio'
  );
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('marketing_publications')
    .select('id, platform, publish_type, caption, status, meta_post_id, published_at, created_at')
    .eq('property_id', access.propertyId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    auditPropertyId: access.propertyId,
    data: (data ?? []).map((p) => ({
      id: p.id,
      platform: p.platform,
      publishType: p.publish_type,
      caption: p.caption,
      status: p.status,
      metaPostId: p.meta_post_id,
      publishedAt: p.published_at,
    })),
  };
}

async function toolSearchMarketingMusic(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = str(args, 'propertyId');
  if (!propertyId) return { ok: false, error: 'propertyId is required' };
  await verifyMarketingPropertyAccess(ctx, propertyId, 'marketing:view', 'marketingStudio');

  const clientId = readJamendoClientId();
  if (!clientId) return { ok: true, data: { tracks: [], jamendoConfigured: false } };

  const search = str(args, 'query');
  try {
    const tracks = await fetchJamendoTracks({
      clientId,
      search,
      order: search ? 'relevance' : 'popularity_week',
      limit: 10,
    });
    return { ok: true, data: { tracks, jamendoConfigured: true } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Jamendo search failed' };
  }
}

/** Pure content generation — never persists or publishes anything. Classified as a read tool (Tier 0), same reasoning as draft_inbox_reply. */
async function toolDraftMarketingCaption(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = str(args, 'propertyId');
  if (!propertyId) return { ok: false, error: 'propertyId is required' };
  const access = await verifyMarketingPropertyAccess(
    ctx,
    propertyId,
    'marketing.generate:add',
    'aiMarketingGeneration'
  );

  const sb = createServiceClient();
  const { data: propertyRow, error } = await sb
    .from('properties')
    .select('name')
    .eq('id', access.propertyId)
    .maybeSingle();
  if (error || !propertyRow?.name) return { ok: false, error: 'Property not found' };

  const platform = args.platform === 'instagram' ? 'instagram' : 'facebook';
  const postType = args.postType === 'story' ? 'story' : 'post';

  try {
    const caption = await generateMarketingCaption({
      organizationId: access.organizationId,
      propertyId: access.propertyId,
      propertyName: String(propertyRow.name),
      platform,
      postType,
      contentHint: str(args, 'contentHint'),
      nightlyRate: str(args, 'nightlyRate'),
      availabilityText: str(args, 'availabilityText'),
      actorUserId: ctx.userId,
      actorType: 'staff',
    });
    return { ok: true, auditPropertyId: access.propertyId, data: { caption } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to draft a caption' };
  }
}

/** Pure content generation — returns design tokens for the visual editor, never persists. Tier 0, same reasoning as toolDraftMarketingCaption. */
async function toolDraftMarketingTemplate(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = str(args, 'propertyId');
  const prompt = str(args, 'prompt');
  if (!propertyId || !prompt) return { ok: false, error: 'propertyId and prompt are required' };
  if (prompt.length > 500) return { ok: false, error: 'Prompt is too long (max 500 characters)' };
  const contentType =
    args.contentType === 'design' || args.contentType === 'video' ? args.contentType : 'calendar';
  const access = await verifyMarketingPropertyAccess(
    ctx,
    propertyId,
    'marketing.generate:add',
    'aiMarketingGeneration'
  );

  const sb = createServiceClient();
  const { data: propertyRow, error } = await sb
    .from('properties')
    .select('name, residence_name, address')
    .eq('id', access.propertyId)
    .maybeSingle();
  if (error || !propertyRow?.name) return { ok: false, error: 'Property not found' };

  const propertyLabel = [propertyRow.name, propertyRow.residence_name, propertyRow.address]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' · ');

  try {
    const result = await generateMarketingTemplateTokens({
      organizationId: access.organizationId,
      propertyId: access.propertyId,
      contentType: contentType as 'calendar' | 'design' | 'video',
      prompt,
      propertyName: propertyLabel || String(propertyRow.name),
      availabilityText: str(args, 'availabilityText'),
      actorUserId: ctx.userId,
      actorType: 'staff',
    });
    return { ok: true, auditPropertyId: access.propertyId, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to draft a template' };
  }
}

// ─── Write tools (Tier 1 auto or Tier 2 confirmed — never trust the model's tier) ────────────

function isFinanceLineItemKind(v: unknown): v is FinanceLineItemKind {
  return v === 'expense' || v === 'income';
}

async function toolProposeAddFinanceLineItem(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const kind = isFinanceLineItemKind(args.kind) ? args.kind : undefined;
  const label = str(args, 'label');
  const category = str(args, 'category');
  const amount = Number(args.amount);
  const occurredOn = str(args, 'occurredOn');
  if (
    !kind ||
    !label ||
    !category ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !occurredOn ||
    !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)
  ) {
    return {
      ok: false,
      error:
        'kind (expense|income), label, category, amount, and occurredOn (YYYY-MM-DD) are required',
    };
  }
  const { propertyId } = await resolveTargetProperty(ctx, args, 'finance.transactions:add');

  // TIER2_ONLY_TOOL_NAMES short-circuits classifyActionRisk — always confirmed, never auto-executed.
  const tier = classifyActionRisk({
    toolName: 'propose_add_finance_line_item',
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
    data: {
      propertyId,
      kind,
      label,
      category,
      amount,
      occurredOn,
      summary: `Add ${kind} "${label}" (${category}) for ${amount} on ${occurredOn}.`,
    },
  };
}

async function toolProposeCreateMaintenanceItem(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const label = str(args, 'label');
  const scheduledOn = str(args, 'scheduledOn');
  if (!label || !scheduledOn || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledOn)) {
    return { ok: false, error: 'label and scheduledOn (YYYY-MM-DD) are required' };
  }
  const category = str(args, 'category') ?? null;
  const notes = str(args, 'notes') ?? null;
  const { propertyId } = await resolveTargetProperty(ctx, args, 'maintenance.reminders:add');

  // TIER2_ONLY_TOOL_NAMES short-circuits classifyActionRisk — always confirmed, never auto-executed.
  const tier = classifyActionRisk({
    toolName: 'propose_create_maintenance_item',
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
    data: {
      propertyId,
      label,
      category,
      scheduledOn,
      notes,
      summary: `Create maintenance item "${label}" scheduled for ${scheduledOn}.`,
    },
  };
}

async function toolRunReceiptValidation(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  const propertyId = await resolveBookingProperty(ctx, bookingId, 'bookings.detail.pricing:edit');

  const tier = classifyActionRisk({
    toolName: 'run_receipt_validation',
    targetBookingId: bookingId,
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });
  if (tier === 'tier2_confirmed') {
    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: { bookingId, summary: 'Re-run AI receipt validation for this booking.' },
    };
  }

  const deferred = queueDeferredTier1Write(ctx, 'run_receipt_validation', args, {
    ok: true,
    riskTier: tier,
    auditPropertyId: propertyId,
    auditBookingId: bookingId,
    data: {
      bookingId,
      summary: 'Re-run AI receipt validation for this booking.',
      pendingCommit: true,
    },
  });
  if (deferred) return deferred;

  await assertActionSafeToExecute({
    toolName: 'run_receipt_validation',
    targetBookingId: bookingId,
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };
  const access = await verifyPropertyAccess(ctx.req, propertyId, 'bookings.detail.pricing:edit');
  const { validated, errors } = await backfillMissingReceiptAiVerdicts(
    booking as Record<string, unknown>,
    {
      organizationId: access.org.id,
      propertyId,
      actorUserId: ctx.userId,
      actorType: 'staff',
    }
  );
  if (validated.length > 0) {
    await DatabaseService.setWorkflowFields(bookingId, dbPatchFromReceiptBackfillItems(validated));
  }

  return {
    ok: true,
    riskTier: tier,
    auditPropertyId: propertyId,
    auditBookingId: bookingId,
    data: { bookingId, validatedCount: validated.length, errors },
  };
}

async function toolProposeTransitionBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  const toStatus = str(args, 'toStatus');
  if (!bookingId || !toStatus || !isBookingStatus(toStatus)) {
    return { ok: false, error: 'bookingId and a valid toStatus are required' };
  }
  const payload = (args.payload && typeof args.payload === 'object' ? args.payload : {}) as Record<
    string,
    unknown
  >;
  const propertyId = await resolveBookingProperty(ctx, bookingId, 'bookings.detail.workflow:edit');

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' };
  const fromStatus = booking.status as string;
  if (!isBookingStatus(fromStatus)) {
    return { ok: false, error: `Unrecognized status: ${fromStatus}` };
  }

  if (!canTransition(fromStatus, toStatus as BookingStatus, { manual: true })) {
    const journey = buildBookingJourneyData(booking as Record<string, unknown>);
    const nextLabel = journey.nextStatusLabel ? String(journey.nextStatusLabel) : null;
    const fromLabel = STATUS_HUMAN_LABEL[fromStatus];
    const toLabel = STATUS_HUMAN_LABEL[toStatus as BookingStatus];
    return {
      ok: false,
      error: nextLabel
        ? `This booking is at ${fromLabel}. Complete each step in order — the next step is ${nextLabel}, not ${toLabel}.`
        : `This booking is at ${fromLabel}. That move to ${toLabel} is not available from here.`,
      data: journey,
    };
  }

  const tier = classifyActionRisk({
    toolName: 'propose_transition_booking',
    fromStatus,
    toStatus,
    payload,
    targetBookingId: bookingId,
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  if (tier === 'tier2_confirmed') {
    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: {
        bookingId,
        toStatus,
        payload,
        summary: `Move booking to ${STATUS_HUMAN_LABEL[toStatus as BookingStatus]}.`,
      },
    };
  }

  const deferred = queueDeferredTier1Write(ctx, 'propose_transition_booking', args, {
    ok: true,
    riskTier: tier,
    auditPropertyId: propertyId,
    auditBookingId: bookingId,
    data: {
      bookingId,
      toStatus,
      payload,
      summary: `Move booking to ${STATUS_HUMAN_LABEL[toStatus as BookingStatus]}.`,
      pendingCommit: true,
    },
  });
  if (deferred) return deferred;

  await assertActionSafeToExecute({
    toolName: 'propose_transition_booking',
    toStatus,
    payload,
    targetBookingId: bookingId,
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  try {
    const result = await WorkflowOrchestrator.transition(
      bookingId,
      toStatus,
      payload,
      {},
      true,
      assistantActorContext(ctx)
    );
    return {
      ok: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: result,
    };
  } catch (err) {
    return {
      ok: false,
      error: humanizeTransitionError(err instanceof Error ? err.message : String(err)),
    };
  }
}

async function toolProposeCancelBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  if (!bookingId) return { ok: false, error: 'bookingId is required' };
  const propertyId = await resolveBookingProperty(ctx, bookingId, 'bookings.detail.workflow:edit');

  // Always Tier 2 — TIER2_ONLY_TOOL_NAMES short-circuits classifyActionRisk before any edge check.
  const tier = classifyActionRisk({
    toolName: 'propose_cancel_booking',
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
    data: { bookingId, toStatus: 'CANCELLED', summary: 'Cancel this booking.' },
  };
}

function buildOrgProfilePatchFromArgs(
  args: Record<string, unknown>
): { patch: OrgProfilePatchInput; summaryFields: string[] } | { error: string } {
  const patch: OrgProfilePatchInput = {};
  if (typeof args.name === 'string' && args.name.trim()) patch.name = args.name;
  if (typeof args.description === 'string') patch.description = args.description;
  if (typeof args.tagline === 'string') patch.tagline = args.tagline;
  if (typeof args.brandColor === 'string') patch.brandColor = args.brandColor;
  if (typeof args.contactName === 'string') patch.contactName = args.contactName;
  if (typeof args.contactRole === 'string') patch.contactRole = args.contactRole;
  if (typeof args.contactPhone === 'string') patch.contactPhone = args.contactPhone;
  if (typeof args.contactEmail === 'string') patch.contactEmail = args.contactEmail;
  const summaryFields = Object.keys(patch);
  if (summaryFields.length === 0) return { error: 'No valid fields to update' };
  return { patch, summaryFields };
}

async function toolProposeUpdateOrgProfile(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const built = buildOrgProfilePatchFromArgs(args);
  if ('error' in built) return { ok: false, error: built.error };

  // update-organization requires org.settings.basic:edit — mirror that leaf (not owner-only).
  await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings.basic:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_update_org_profile',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  const summary = buildHostFacingFieldsSummary('Update organization profile', built.summaryFields);
  if (tier === 'tier2_confirmed') {
    return { ok: true, proposed: true, riskTier: tier, data: { ...built.patch, summary } };
  }

  await assertActionSafeToExecute({
    toolName: 'propose_update_org_profile',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  try {
    const { org } = await verifyOrgAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      'org.settings.basic:edit'
    );
    const organization = await applyOrganizationProfilePatch(org, built.patch);
    return { ok: true, riskTier: tier, data: { organization } };
  } catch (err) {
    if (err instanceof OrgProfilePatchError) return { ok: false, error: err.message };
    throw err;
  }
}

async function toolProposeInviteTeamMember(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const email = str(args, 'email');
  if (!email) return { ok: false, error: 'email is required' };
  const roleId = str(args, 'roleId') ?? 'ADMIN';

  const teamCtx = await verifyOrgTeamAccess(
    ctx.req,
    { orgId: ctx.organizationId },
    { requireInvite: true }
  );

  const tier = classifyActionRisk({
    toolName: 'propose_invite_team_member',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: {
      email,
      roleId,
      orgId: teamCtx.org.id,
      summary: `Invite ${email} to the team as ${roleId}.`,
    },
  };
}

async function toolProposeUpdateTeamMemberRole(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const memberId = str(args, 'memberId');
  const roleId = str(args, 'roleId');
  if (!memberId || !roleId) return { ok: false, error: 'memberId and roleId are required' };

  const teamCtx = await verifyOrgTeamAccess(
    ctx.req,
    { orgId: ctx.organizationId },
    { requireMemberEdit: true }
  );

  const tier = classifyActionRisk({
    toolName: 'propose_update_team_member_role',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: {
      memberId,
      roleId,
      orgId: teamCtx.org.id,
      summary: `Change this team member's role to ${roleId}.`,
    },
  };
}

async function toolProposeRevokeInvitation(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const invitationId = str(args, 'invitationId');
  if (!invitationId) return { ok: false, error: 'invitationId is required' };

  const teamCtx = await verifyOrgTeamAccess(
    ctx.req,
    { orgId: ctx.organizationId },
    { requireInvitationDelete: true }
  );

  const tier = classifyActionRisk({
    toolName: 'propose_revoke_invitation',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  if (tier === 'tier2_confirmed') {
    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      data: { invitationId, summary: 'Cancel this pending invitation.' },
    };
  }

  const deferred = queueDeferredTier1Write(ctx, 'propose_revoke_invitation', args, {
    ok: true,
    riskTier: tier,
    data: { invitationId, summary: 'Cancel this pending invitation.', pendingCommit: true },
  });
  if (deferred) return deferred;

  await assertActionSafeToExecute({
    toolName: 'propose_revoke_invitation',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  await cancelOrgInvitation(teamCtx.org.id, invitationId);
  return { ok: true, riskTier: tier, data: { invitationId, cancelled: true } };
}

async function toolProposeRemoveTeamMember(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const memberId = str(args, 'memberId');
  if (!memberId) return { ok: false, error: 'memberId is required' };

  const teamCtx = await verifyOrgTeamAccess(
    ctx.req,
    { orgId: ctx.organizationId },
    { requireMemberDelete: true }
  );

  const tier = classifyActionRisk({
    toolName: 'propose_remove_team_member',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: {
      memberId,
      orgId: teamCtx.org.id,
      summary: 'Remove this member from the organization.',
    },
  };
}

async function requireUpdatePropertyLeafPermissions(
  req: Request,
  propertyId: string,
  body: Record<string, unknown>
): Promise<void> {
  const needed = updatePropertyPatchPermissions(body);
  if (needed.length === 0) {
    throw new Error('No valid fields to update');
  }
  await verifyPropertyAccess(req, propertyId, needed[0] as TeamPermissionId);
  for (const perm of needed.slice(1)) {
    await verifyPropertyAccess(req, propertyId, perm as TeamPermissionId);
  }
}

function buildPropertyProfilePatchFromArgs(
  args: Record<string, unknown>
): { patch: PropertyProfilePatchInput; summaryFields: string[] } | { error: string } {
  const patch: PropertyProfilePatchInput = {};
  if (typeof args.name === 'string' && args.name.trim()) patch.name = args.name;
  if (typeof args.address === 'string') patch.address = args.address;
  if (typeof args.maxGuests === 'number') patch.maxGuests = args.maxGuests;
  if (typeof args.status === 'string') patch.status = args.status;
  if (typeof args.tower === 'string') patch.tower = args.tower;
  if (typeof args.unitNumber === 'string') patch.unitNumber = args.unitNumber;
  if (typeof args.residenceName === 'string') patch.residenceName = args.residenceName;
  const summaryFields = Object.keys(patch);
  if (summaryFields.length === 0) return { error: 'No valid fields to update' };
  return { patch, summaryFields };
}

async function toolProposeUpdatePropertyProfile(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const built = buildPropertyProfilePatchFromArgs(args);
  if ('error' in built) return { ok: false, error: built.error };

  // update-property uses Phase 5 settings.* leaves — mirror that RBAC here.
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };
  try {
    await requireUpdatePropertyLeafPermissions(
      ctx.req,
      propertyId,
      built.patch as Record<string, unknown>
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Permission denied' };
  }

  const tier = classifyActionRisk({
    toolName: 'propose_update_property_profile',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  const summary = buildHostFacingFieldsSummary('Update property profile', built.summaryFields);
  if (tier === 'tier2_confirmed') {
    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: propertyId,
      data: { ...built.patch, propertyId, summary },
    };
  }

  await assertActionSafeToExecute({
    toolName: 'propose_update_property_profile',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  try {
    const { property } = await verifyPropertyAccess(ctx.req, propertyId);
    const updated = await applyPropertyProfilePatch(property, built.patch);
    return { ok: true, riskTier: tier, auditPropertyId: propertyId, data: { property: updated } };
  } catch (err) {
    if (err instanceof PropertyProfilePatchError) return { ok: false, error: err.message };
    throw err;
  }
}

function buildPropertySettingsPatchFromArgs(
  args: Record<string, unknown>
): { patch: PropertySettingsPatchInput; summaryFields: string[] } | { error: string } {
  const patch: PropertySettingsPatchInput = {};
  if (typeof args.contactName === 'string') patch.contactName = args.contactName;
  if (typeof args.contactPhone === 'string') patch.contactPhone = args.contactPhone;
  if (typeof args.contactEmail === 'string') patch.contactEmail = args.contactEmail;
  if (typeof args.bedrooms === 'number') patch.bedrooms = args.bedrooms;
  if (typeof args.bathrooms === 'number') patch.bathrooms = args.bathrooms;
  if (typeof args.floors === 'number') patch.floors = args.floors;
  if (typeof args.maxAdults === 'number') patch.maxAdults = args.maxAdults;
  if (typeof args.maxChildren === 'number') patch.maxChildren = args.maxChildren;
  if (typeof args.description === 'string') patch.description = args.description;
  if (Array.isArray(args.customHouseRules)) {
    patch.customHouseRules = args.customHouseRules.filter(
      (r): r is { name: string } =>
        typeof r === 'object' && r !== null && typeof (r as { name?: unknown }).name === 'string'
    );
  }
  if (Array.isArray(args.customAmenities)) {
    patch.customAmenities = args.customAmenities.filter(
      (a): a is { name: string } =>
        typeof a === 'object' && a !== null && typeof (a as { name?: unknown }).name === 'string'
    );
  }
  if (args.cancellationPolicy !== undefined) patch.cancellationPolicy = args.cancellationPolicy;
  const summaryFields = Object.keys(patch);
  if (summaryFields.length === 0) return { error: 'No valid fields to update' };
  return { patch, summaryFields };
}

/**
 * Always Tier 2 — TIER2_ONLY_TOOL_NAMES short-circuits classifyActionRisk before any edge check.
 * Unlike propose_update_property_profile (Tier 1, top-level columns only), a settings write can
 * change guest-facing cancellation terms and house rules — the host must explicitly confirm every
 * time, never auto-executed regardless of how small the change looks.
 */
async function toolProposeUpdatePropertySettings(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const built = buildPropertySettingsPatchFromArgs(args);
  if ('error' in built) return { ok: false, error: built.error };

  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };

  // update-property settings blob uses Phase 5 settings.* leaves — mirror that RBAC here.
  try {
    await requireUpdatePropertyLeafPermissions(ctx.req, propertyId, {
      settings: built.patch,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Permission denied' };
  }

  const tier = classifyActionRisk({
    toolName: 'propose_update_property_settings',
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
    data: {
      ...built.patch,
      propertyId,
      summary: buildHostFacingFieldsSummary('Update property settings', built.summaryFields),
    },
  };
}

async function toolProposeRevokePropertyInvitation(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const invitationId = str(args, 'invitationId');
  if (!invitationId) return { ok: false, error: 'invitationId is required' };
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };

  const teamCtx = await requireTeamPropertyAccess(
    ctx.req,
    propertyId,
    TEAM_API_PERMISSIONS.cancelInvitation
  );

  const tier = classifyActionRisk({
    toolName: 'propose_revoke_property_invitation',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  if (tier === 'tier2_confirmed') {
    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      auditPropertyId: teamCtx.property.id,
      data: {
        invitationId,
        propertyId: teamCtx.property.id,
        summary: 'Cancel this pending invitation.',
      },
    };
  }

  const deferred = queueDeferredTier1Write(ctx, 'propose_revoke_property_invitation', args, {
    ok: true,
    riskTier: tier,
    auditPropertyId: teamCtx.property.id,
    data: {
      invitationId,
      propertyId: teamCtx.property.id,
      summary: 'Cancel this pending invitation.',
      pendingCommit: true,
    },
  });
  if (deferred) return deferred;

  await assertActionSafeToExecute({
    toolName: 'propose_revoke_property_invitation',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  await cancelPropertyInvitation(teamCtx.property.id, invitationId);
  return {
    ok: true,
    riskTier: tier,
    auditPropertyId: teamCtx.property.id,
    data: { invitationId, cancelled: true },
  };
}

async function toolProposeInvitePropertyTeamMember(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const email = str(args, 'email');
  const roleId = str(args, 'roleId');
  if (!email || !roleId) return { ok: false, error: 'email and roleId are required' };
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };

  const teamCtx = await requireTeamPropertyAccess(
    ctx.req,
    propertyId,
    TEAM_API_PERMISSIONS.inviteMember
  );

  const tier = classifyActionRisk({
    toolName: 'propose_invite_property_team_member',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditPropertyId: teamCtx.property.id,
    data: {
      email,
      roleId,
      propertyId: teamCtx.property.id,
      summary: `Invite ${email} to the property team as ${roleId}.`,
    },
  };
}

async function toolProposeUpdatePropertyTeamMemberRole(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const memberId = str(args, 'memberId');
  const roleId = str(args, 'roleId');
  if (!memberId || !roleId) return { ok: false, error: 'memberId and roleId are required' };
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };

  const teamCtx = await requireTeamPropertyAccess(
    ctx.req,
    propertyId,
    TEAM_API_PERMISSIONS.updateMember
  );

  const tier = classifyActionRisk({
    toolName: 'propose_update_property_team_member_role',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditPropertyId: teamCtx.property.id,
    data: {
      memberId,
      roleId,
      propertyId: teamCtx.property.id,
      summary: `Change this property team member's role to ${roleId}.`,
    },
  };
}

async function toolProposeRemovePropertyTeamMember(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const memberId = str(args, 'memberId');
  if (!memberId) return { ok: false, error: 'memberId is required' };
  const propertyId = defaultPropertyId(ctx, args);
  if (!propertyId) return { ok: false, error: 'propertyId is required (no property in scope)' };

  const teamCtx = await requireTeamPropertyAccess(
    ctx.req,
    propertyId,
    TEAM_API_PERMISSIONS.removeMember
  );

  const tier = classifyActionRisk({
    toolName: 'propose_remove_property_team_member',
    targetPropertyId: propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditPropertyId: teamCtx.property.id,
    data: {
      memberId,
      propertyId: teamCtx.property.id,
      summary: 'Remove this member from the property team.',
    },
  };
}

/**
 * Always Tier 2 — even a routine post-broadcast transition sends a guest-facing notification,
 * and the claim/decline race guard is safety-critical (first-Accept-wins). Never auto-executed.
 */
async function toolProposeClaimParkingBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  const parkingId = str(args, 'parkingId');
  if (!bookingId || !parkingId) return { ok: false, error: 'bookingId and parkingId are required' };
  const endorsementNote = str(args, 'endorsementNote') ?? '';

  await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_claim_parking_booking',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditBookingId: bookingId,
    data: {
      bookingId,
      parkingId,
      endorsementNote,
      summary: 'Claim this parking request — commits this parking slot and notifies the guest.',
    },
  };
}

async function toolProposeDeclineParkingBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  const parkingId = str(args, 'parkingId');
  if (!bookingId || !parkingId) return { ok: false, error: 'bookingId and parkingId are required' };

  await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_decline_parking_booking',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditBookingId: bookingId,
    data: {
      bookingId,
      parkingId,
      summary: 'Decline this parking request candidacy.',
    },
  };
}

async function toolProposeTransitionParkingBooking(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const bookingId = str(args, 'bookingId');
  const toStatus = str(args, 'toStatus');
  if (!bookingId || !toStatus || !isParkingStatus(toStatus)) {
    return { ok: false, error: 'bookingId and a valid toStatus are required' };
  }

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking || !booking.parking_id) return { ok: false, error: 'Parking booking not found' };
  const parkingId = String(booking.parking_id);
  await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:edit');

  const fromStatus = String(booking.status ?? '');
  if (!isParkingStatus(fromStatus))
    return { ok: false, error: `Unrecognized status: ${fromStatus}` };
  // PENDING_HOST_ACCEPTANCE only resolves via claim/decline/expiry — never a plain transition.
  if (fromStatus === 'PENDING_HOST_ACCEPTANCE') {
    return { ok: false, error: `Cannot transition from ${fromStatus} to ${toStatus}` };
  }
  if (!canTransitionParking(fromStatus, toStatus)) {
    return { ok: false, error: `Cannot transition from ${fromStatus} to ${toStatus}` };
  }

  const tier = classifyActionRisk({
    toolName: 'propose_transition_parking_booking',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditBookingId: bookingId,
    data: {
      bookingId,
      parkingId,
      toStatus,
      summary: `Move parking booking to ${toStatus}.`,
    },
  };
}

const MAX_UNBLOCK_DATE_RANGE_DAYS = 62;

/**
 * All pricing write tools are always Tier 2, single-target only — never a bulk/multi-date write
 * in one call. `savePropertyPricing`/`saveParkingPricing`'s `dateOverrides` and `holidayRules`
 * patch fields are a FULL REPLACE of the stored map/array, not a merge (confirmed by reading
 * `propertyPricing.ts`/`parkingPricing.ts` directly) — every override/holiday-rule tool here
 * loads the current value first and writes back the merged result, never just the one new entry,
 * or it would silently delete every other override/rule the host already configured.
 */
async function toolProposeUpdatePropertyBaseRate(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const patch: Record<string, number> = {};
  for (const key of [
    'weekdayNightlyRate',
    'weekendNightlyRate',
    'downPayment',
    'securityDeposit',
    'petFee',
    'parkingRateGuest',
    'guestAdditionalFee',
  ] as const) {
    if (typeof args[key] === 'number') patch[key] = args[key] as number;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'No valid fields to update' };

  const { propertyId } = await resolveTargetProperty(ctx, args, 'pricing.rates:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_update_property_base_rate',
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
    data: {
      ...patch,
      propertyId,
      summary: buildPricingBaseRateSummary('property', patch),
    },
  };
}

async function toolProposeSetPropertyDateRateOverride(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const date = str(args, 'date');
  const rate = Number(args.rate);
  if (!date || !isValidCalendarDateKey(date) || !Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: 'A valid date (YYYY-MM-DD) and a non-negative rate are required' };
  }
  const { propertyId } = await resolveTargetProperty(ctx, args, 'pricing.rates:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_set_property_date_rate_override',
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
    data: { propertyId, date, rate, summary: `Set the rate for ${date} to ${rate}.` },
  };
}

async function toolProposeAddPropertyHolidayRule(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const name = str(args, 'name');
  const startDate = str(args, 'startDate');
  const endDate = str(args, 'endDate');
  const percentage = Number(args.percentage);
  if (
    !name ||
    !startDate ||
    !endDate ||
    !isValidCalendarDateKey(startDate) ||
    !isValidCalendarDateKey(endDate) ||
    !Number.isFinite(percentage) ||
    percentage < 0
  ) {
    return {
      ok: false,
      error: 'name, startDate, endDate (YYYY-MM-DD), and a non-negative percentage are required',
    };
  }
  const { propertyId } = await resolveTargetProperty(ctx, args, 'pricing.rates:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_add_property_holiday_rule',
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
    data: {
      propertyId,
      name,
      startDate,
      endDate,
      percentage,
      summary: `Add holiday pricing rule "${name}" (${startDate} to ${endDate}, +${percentage}%).`,
    },
  };
}

async function toolProposeBlockPropertyDates(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const startDate = str(args, 'startDate');
  const endDate = str(args, 'endDate');
  if (
    !startDate ||
    !endDate ||
    !isValidCalendarDateKey(startDate) ||
    !isValidCalendarDateKey(endDate)
  ) {
    return { ok: false, error: 'startDate and endDate (YYYY-MM-DD) are required' };
  }
  const note = str(args, 'note');
  const { propertyId } = await resolveTargetProperty(ctx, args, 'pricing.blocks:add');

  const tier = classifyActionRisk({
    toolName: 'propose_block_property_dates',
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
    data: {
      propertyId,
      startDate,
      endDate,
      note,
      summary: `Block ${startDate} to ${endDate} from availability.`,
    },
  };
}

async function toolProposeUnblockPropertyDates(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const startDate = str(args, 'startDate');
  const endDate = str(args, 'endDate');
  if (
    !startDate ||
    !endDate ||
    !isValidCalendarDateKey(startDate) ||
    !isValidCalendarDateKey(endDate)
  ) {
    return { ok: false, error: 'startDate and endDate (YYYY-MM-DD) are required' };
  }
  const start = parseDateOnly(startDate)!;
  const end = parseDateOnly(endDate)!;
  if (end < start) return { ok: false, error: 'endDate must be on or after startDate' };
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_UNBLOCK_DATE_RANGE_DAYS) {
    return {
      ok: false,
      error: `Range too large — unblock at most ${MAX_UNBLOCK_DATE_RANGE_DAYS} days at a time`,
    };
  }

  const { propertyId } = await resolveTargetProperty(ctx, args, 'pricing.blocks:delete');

  const tier = classifyActionRisk({
    toolName: 'propose_unblock_property_dates',
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
    data: {
      propertyId,
      startDate,
      endDate,
      summary: `Unblock ${startDate} to ${endDate}.`,
    },
  };
}

async function toolProposeUpdateParkingBaseRate(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const parkingId = str(args, 'parkingId');
  if (!parkingId) return { ok: false, error: 'parkingId is required' };
  const patch: Record<string, number> = {};
  for (const key of ['weekdayNightlyRate', 'weekendNightlyRate'] as const) {
    if (typeof args[key] === 'number') patch[key] = args[key] as number;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'No valid fields to update' };

  await verifyParkingTeamAccess(ctx.req, parkingId, 'pricing:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_update_parking_base_rate',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: {
      ...patch,
      parkingId,
      summary: buildPricingBaseRateSummary('parking', patch),
    },
  };
}

async function toolProposeSetParkingDateRateOverride(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const parkingId = str(args, 'parkingId');
  const date = str(args, 'date');
  const rate = Number(args.rate);
  if (!parkingId || !date || !isValidCalendarDateKey(date) || !Number.isFinite(rate) || rate < 0) {
    return {
      ok: false,
      error: 'parkingId, a valid date (YYYY-MM-DD), and a non-negative rate are required',
    };
  }

  await verifyParkingTeamAccess(ctx.req, parkingId, 'pricing:edit');

  const tier = classifyActionRisk({
    toolName: 'propose_set_parking_date_rate_override',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: { parkingId, date, rate, summary: `Set the parking rate for ${date} to ${rate}.` },
  };
}

/** Internal, DB-only — never touches the guest. Tier 1 by construction. */
async function toolProposeMarkInboxThreadRead(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const conversationId = str(args, 'conversationId');
  if (!conversationId) return { ok: false, error: 'conversationId is required' };
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'reply', scopeArgs);
  const metaConnectionIds = await resolveMetaConnectionIdsForScope(inboxCtx.orgId, inboxCtx.scope);
  await loadInboxConversationInScope(inboxCtx, conversationId, new Set(metaConnectionIds));

  const tier = classifyActionRisk({
    toolName: 'propose_mark_inbox_thread_read',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  if (tier === 'tier2_confirmed') {
    return {
      ok: true,
      proposed: true,
      riskTier: tier,
      data: { conversationId, summary: 'Mark this conversation as read.' },
    };
  }

  const deferred = queueDeferredTier1Write(ctx, 'propose_mark_inbox_thread_read', args, {
    ok: true,
    riskTier: tier,
    data: { conversationId, summary: 'Mark this conversation as read.', pendingCommit: true },
  });
  if (deferred) return deferred;

  await assertActionSafeToExecute({
    toolName: 'propose_mark_inbox_thread_read',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
    expectedTier: tier,
  });

  await markConversationRead(inboxCtx.orgId, conversationId);
  return { ok: true, riskTier: tier, data: { conversationId, read: true } };
}

/** Generates a draft only — never sends. Tier 1 by construction. */
async function toolDraftInboxReply(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const conversationId = str(args, 'conversationId');
  if (!conversationId) return { ok: false, error: 'conversationId is required' };
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'reply', scopeArgs);
  const metaConnectionIds = await resolveMetaConnectionIdsForScope(inboxCtx.orgId, inboxCtx.scope);
  const conv = await loadInboxConversationInScope(
    inboxCtx,
    conversationId,
    new Set(metaConnectionIds)
  );

  const { messages } = await listMessages(inboxCtx.orgId, conversationId, { limit: 20 });
  const sb = createServiceClient();
  const settingsQuery = sb
    .from('social_inbox_settings')
    .select('ai_system_prompt')
    .eq('organization_id', inboxCtx.orgId);
  const { data: settings } = await (
    inboxCtx.parkingId
      ? settingsQuery.eq('parking_id', inboxCtx.parkingId)
      : settingsQuery.is('parking_id', null)
  ).maybeSingle();

  try {
    const result = await suggestInboxReply({
      orgId: inboxCtx.orgId,
      platform: conv.platform,
      conversationType: conv.conversation_type,
      participantName: conv.participant_name,
      propertyId: conv.property_id ?? null,
      inquiryCheckIn: conv.inquiry_check_in ?? null,
      inquiryCheckOut: conv.inquiry_check_out ?? null,
      messages: messages.map((m) => ({
        direction: m.direction,
        body: m.body_text,
        sentAt: m.sent_at,
      })),
      systemPromptOverride: (settings?.ai_system_prompt as string | null) ?? null,
      actorUserId: ctx.userId,
      actorType: 'staff',
    });
    return {
      ok: true,
      data: { conversationId, draft: result.suggestion, flagged: result.flagged },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to draft a reply' };
  }
}

/**
 * Always Tier 2 AND external_send — TIER2_ONLY_TOOL_NAMES + EXTERNAL_SEND_TOOL_NAMES both
 * short-circuit before any edge check. This is the assistant's first tool that sends something a
 * real guest actually sees, with no undo — never auto-executed, and the confirm UI shows distinct
 * "this sends for real" copy (see ActionConfirmationBlock's isExternalSend handling).
 */
async function toolProposeSendInboxReply(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const conversationId = str(args, 'conversationId');
  const text = str(args, 'text') ?? '';
  if (!conversationId) return { ok: false, error: 'conversationId is required' };
  const attachmentPaths = (() => {
    const paths: string[] = [];
    const single = str(args, 'attachmentPath');
    if (single) paths.push(single);
    if (Array.isArray(args.attachmentPaths)) {
      for (const item of args.attachmentPaths) {
        if (typeof item === 'string' && item.trim()) paths.push(item.trim());
      }
    }
    // Host attached files this turn — include them even if the model omitted attachmentPath
    // (common when it "helpfully" strips media). Meta still refuses below.
    if (paths.length === 0 && (ctx.turnAttachmentPaths?.length ?? 0) > 0) {
      paths.push(...ctx.turnAttachmentPaths!);
    }
    return [...new Set(paths)].slice(0, 3);
  })();
  if (!text.trim() && attachmentPaths.length === 0) {
    return { ok: false, error: 'text or attachmentPath(s) is required' };
  }
  const scopeArgs = inboxScopeArgs(args);
  if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
    return { ok: false, error: 'propertyId or parkingId is required' };
  }
  const inboxCtx = await resolveInboxAccess(ctx.req, 'reply', scopeArgs);
  const metaConnectionIds = await resolveMetaConnectionIdsForScope(inboxCtx.orgId, inboxCtx.scope);
  const conv = await loadInboxConversationInScope(
    inboxCtx,
    conversationId,
    new Set(metaConnectionIds)
  );

  if (attachmentPaths.length > 0) {
    if (!ctx.conversationId?.trim()) {
      return { ok: false, error: 'Conversation is required to send attachments' };
    }
    if (conv.platform !== 'web') {
      return {
        ok: false,
        error:
          'Attachments are only supported for website chat — send text only on Messenger or Instagram',
      };
    }
  }

  const tier = classifyActionRisk({
    toolName: 'propose_send_inbox_reply',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  const previewText = text.trim() || '(attachment)';
  const attachmentNote = attachmentPaths.length > 0 ? ` + ${attachmentPaths.length} file(s)` : '';

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: {
      conversationId,
      text,
      attachmentPaths,
      propertyId: scopeArgs.propertyId,
      parkingId: scopeArgs.parkingId,
      summary: `Send this reply: "${previewText.length > 80 ? `${previewText.slice(0, 80)}…` : previewText}"${attachmentNote}`,
    },
  };
}

/**
 * The single highest-blast-radius tool in this catalog — publishes to a real, public Facebook
 * Page or Instagram account, irreversibly. Always Tier 2 AND external_send (both
 * TIER2_ONLY_TOOL_NAMES and EXTERNAL_SEND_TOOL_NAMES short-circuit before any edge check) —
 * never auto-executed under any circumstance, and the confirm UI shows the exact caption/media/
 * destination before it fires.
 */
async function toolProposePublishToMeta(
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const propertyId = str(args, 'propertyId');
  const connectionId = str(args, 'connectionId');
  const mediaUrl = str(args, 'mediaUrl');
  const attachmentPath = str(args, 'attachmentPath');
  const publishTypeArg = str(args, 'publishType');
  if (!propertyId || !connectionId || !publishTypeArg || !META_PUBLISH_TYPES.has(publishTypeArg)) {
    return {
      ok: false,
      error:
        'propertyId, connectionId, publishType (facebook_post, instagram_post, instagram_story, instagram_reel), and mediaUrl or attachmentPath are required',
    };
  }
  if (!mediaUrl && !attachmentPath) {
    return { ok: false, error: 'Provide mediaUrl or attachmentPath from this conversation' };
  }
  if (mediaUrl && attachmentPath) {
    return { ok: false, error: 'Provide only one of mediaUrl or attachmentPath' };
  }
  if (attachmentPath && !ctx.conversationId?.trim()) {
    return { ok: false, error: 'Conversation is required to publish from a chat attachment' };
  }

  const caption = str(args, 'caption') ?? '';
  const access = await verifyMarketingPropertyAccess(
    ctx,
    propertyId,
    'marketing.publish:add',
    'marketingStudio'
  );
  await requireMarketingPublishAllowed(access.propertyId);

  const tier = classifyActionRisk({
    toolName: 'propose_publish_to_meta',
    targetPropertyId: access.propertyId,
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  const mediaLabel = attachmentPath
    ? `chat file ${attachmentPath.split('/').pop() ?? attachmentPath}`
    : mediaUrl!;

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    auditPropertyId: access.propertyId,
    data: {
      propertyId: access.propertyId,
      connectionId,
      mediaUrl: mediaUrl ?? null,
      attachmentPath: attachmentPath ?? null,
      publishType: publishTypeArg,
      caption,
      summary: `Publish to ${publishTypeArg.replace('_', ' ')}: "${caption.length > 80 ? `${caption.slice(0, 80)}…` : caption || '(no caption)'}" — media: ${mediaLabel}`,
    },
  };
}

/** Executes a Tier-2 proposal that was already confirmed — called only from dashboard-assistant-confirm. */
export async function executeConfirmedAction(
  toolName: string,
  inputPayload: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  if (toolName === 'propose_cancel_booking') {
    const bookingId = str(inputPayload, 'bookingId');
    if (!bookingId) return { ok: false, error: 'bookingId is required' };
    const propertyId = await resolveBookingProperty(
      ctx,
      bookingId,
      'bookings.detail.workflow:edit'
    );

    await assertActionSafeToExecute({
      toolName: 'propose_cancel_booking',
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const result = await WorkflowOrchestrator.transition(
      bookingId,
      'CANCELLED',
      {},
      {},
      true,
      assistantActorContext(ctx)
    );
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: result,
    };
  }

  if (toolName === 'propose_transition_booking') {
    const bookingId = str(inputPayload, 'bookingId');
    const toStatus = str(inputPayload, 'toStatus');
    if (!bookingId || !toStatus || !isBookingStatus(toStatus)) {
      return { ok: false, error: 'bookingId and a valid toStatus are required' };
    }
    const payload = (
      inputPayload.payload && typeof inputPayload.payload === 'object' ? inputPayload.payload : {}
    ) as Record<string, unknown>;
    const propertyId = await resolveBookingProperty(
      ctx,
      bookingId,
      'bookings.detail.workflow:edit'
    );

    await assertActionSafeToExecute({
      toolName: 'propose_transition_booking',
      toStatus,
      payload,
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const result = await WorkflowOrchestrator.transition(
        bookingId,
        toStatus,
        payload,
        {},
        true,
        assistantActorContext(ctx)
      );
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: propertyId,
        auditBookingId: bookingId,
        data: result,
      };
    } catch (err) {
      return {
        ok: false,
        error: humanizeTransitionError(err instanceof Error ? err.message : String(err)),
      };
    }
  }

  if (toolName === 'run_receipt_validation') {
    const bookingId = str(inputPayload, 'bookingId');
    if (!bookingId) return { ok: false, error: 'bookingId is required' };
    const propertyId = await resolveBookingProperty(ctx, bookingId, 'bookings.detail.pricing:edit');

    await assertActionSafeToExecute({
      toolName: 'run_receipt_validation',
      targetBookingId: bookingId,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking) return { ok: false, error: 'Booking not found' };
    const access = await verifyPropertyAccess(ctx.req, propertyId, 'bookings.detail.pricing:edit');
    const { validated, errors } = await backfillMissingReceiptAiVerdicts(
      booking as Record<string, unknown>,
      {
        organizationId: access.org.id,
        propertyId,
        actorUserId: ctx.userId,
        actorType: 'staff',
      }
    );
    if (validated.length > 0) {
      await DatabaseService.setWorkflowFields(
        bookingId,
        dbPatchFromReceiptBackfillItems(validated)
      );
    }
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: { bookingId, validatedCount: validated.length, errors },
    };
  }

  if (toolName === 'propose_add_finance_line_item') {
    const kind = isFinanceLineItemKind(inputPayload.kind) ? inputPayload.kind : undefined;
    const label = str(inputPayload, 'label');
    const category = str(inputPayload, 'category');
    const amount = Number(inputPayload.amount);
    const occurredOn = str(inputPayload, 'occurredOn');
    if (
      !kind ||
      !label ||
      !category ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !occurredOn ||
      !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const { propertyId } = await resolveTargetProperty(
      ctx,
      inputPayload,
      'finance.transactions:add'
    );

    await assertActionSafeToExecute({
      toolName: 'propose_add_finance_line_item',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const result = await createFinanceLineItem(
      { propertyId, kind, label, amount, category, occurred_on: occurredOn },
      ctx.userEmail
    );
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { lineItemId: result.row.id, propertyId, kind, label, amount, occurredOn },
    };
  }

  if (toolName === 'propose_create_maintenance_item') {
    const label = str(inputPayload, 'label');
    const scheduledOn = str(inputPayload, 'scheduledOn');
    if (!label || !scheduledOn || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledOn)) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const category = str(inputPayload, 'category') ?? null;
    const notes = str(inputPayload, 'notes') ?? null;
    const { propertyId } = await resolveTargetProperty(
      ctx,
      inputPayload,
      'maintenance.reminders:add'
    );

    await assertActionSafeToExecute({
      toolName: 'propose_create_maintenance_item',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const result = await createMaintenanceItem(
      { propertyId, label, category, scheduled_on: scheduledOn, notes },
      ctx.userEmail
    );
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { maintenanceItemId: result.row.id, propertyId, label, scheduledOn },
    };
  }

  if (toolName === 'propose_update_org_profile') {
    const { org } = await verifyOrgAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      'org.settings.basic:edit'
    );

    await assertActionSafeToExecute({
      toolName: 'propose_update_org_profile',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const { summary: _summary, ...patchFields } = inputPayload as Record<string, unknown> & {
        summary?: unknown;
      };
      const organization = await applyOrganizationProfilePatch(
        org,
        patchFields as OrgProfilePatchInput
      );
      return { ok: true, riskTier: 'tier2_confirmed', data: { organization } };
    } catch (err) {
      if (err instanceof OrgProfilePatchError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_invite_team_member') {
    const email = str(inputPayload, 'email');
    if (!email) return { ok: false, error: 'Malformed proposal payload' };
    const roleId = str(inputPayload, 'roleId') ?? 'ADMIN';

    const teamCtx = await verifyOrgTeamAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      { requireInvite: true }
    );

    await assertActionSafeToExecute({
      toolName: 'propose_invite_team_member',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const invitation = await createOrgInvitation(teamCtx, { email, roleId });
      return { ok: true, riskTier: 'tier2_confirmed', data: { invitation } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invite failed' };
    }
  }

  if (toolName === 'propose_update_team_member_role') {
    const memberId = str(inputPayload, 'memberId');
    const roleId = str(inputPayload, 'roleId');
    if (!memberId || !roleId) return { ok: false, error: 'Malformed proposal payload' };

    const teamCtx = await verifyOrgTeamAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      { requireMemberEdit: true }
    );

    await assertActionSafeToExecute({
      toolName: 'propose_update_team_member_role',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const member = await updateOrgTeamMember(teamCtx, { memberId, roleId });
      return { ok: true, riskTier: 'tier2_confirmed', data: { member } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Update failed' };
    }
  }

  if (toolName === 'propose_revoke_invitation') {
    const invitationId = str(inputPayload, 'invitationId');
    if (!invitationId) return { ok: false, error: 'Malformed proposal payload' };

    const teamCtx = await verifyOrgTeamAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      { requireInvitationDelete: true }
    );

    await assertActionSafeToExecute({
      toolName: 'propose_revoke_invitation',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    await cancelOrgInvitation(teamCtx.org.id, invitationId);
    return { ok: true, riskTier: 'tier2_confirmed', data: { invitationId, cancelled: true } };
  }

  if (toolName === 'propose_remove_team_member') {
    const memberId = str(inputPayload, 'memberId');
    if (!memberId) return { ok: false, error: 'Malformed proposal payload' };

    const teamCtx = await verifyOrgTeamAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      { requireMemberDelete: true }
    );

    await assertActionSafeToExecute({
      toolName: 'propose_remove_team_member',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      await removeOrgTeamMember(teamCtx, memberId);
      return { ok: true, riskTier: 'tier2_confirmed', data: { memberId, removed: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Remove failed' };
    }
  }

  if (toolName === 'propose_update_property_profile') {
    const propertyId = str(inputPayload, 'propertyId');
    if (!propertyId) return { ok: false, error: 'Malformed proposal payload' };
    const {
      summary: _summary,
      propertyId: _pid,
      ...patchFields
    } = inputPayload as Record<string, unknown> & { summary?: unknown; propertyId?: unknown };
    try {
      await requireUpdatePropertyLeafPermissions(ctx.req, propertyId, patchFields);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Permission denied' };
    }
    const { property } = await verifyPropertyAccess(ctx.req, propertyId);

    await assertActionSafeToExecute({
      toolName: 'propose_update_property_profile',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const updated = await applyPropertyProfilePatch(
        property,
        patchFields as PropertyProfilePatchInput
      );
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: propertyId,
        data: { property: updated },
      };
    } catch (err) {
      if (err instanceof PropertyProfilePatchError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_update_property_settings') {
    const propertyId = str(inputPayload, 'propertyId');
    if (!propertyId) return { ok: false, error: 'Malformed proposal payload' };
    const {
      summary: _summary,
      propertyId: _pid,
      ...patchFields
    } = inputPayload as Record<string, unknown> & { summary?: unknown; propertyId?: unknown };
    try {
      await requireUpdatePropertyLeafPermissions(ctx.req, propertyId, { settings: patchFields });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Permission denied' };
    }
    const { property } = await verifyPropertyAccess(ctx.req, propertyId);

    await assertActionSafeToExecute({
      toolName: 'propose_update_property_settings',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const updated = await applyPropertySettingsPatch(
        property,
        patchFields as PropertySettingsPatchInput
      );
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: propertyId,
        data: { property: updated },
      };
    } catch (err) {
      if (err instanceof PropertyProfilePatchError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_revoke_property_invitation') {
    const invitationId = str(inputPayload, 'invitationId');
    const propertyId = str(inputPayload, 'propertyId');
    if (!invitationId || !propertyId) return { ok: false, error: 'Malformed proposal payload' };

    const teamCtx = await requireTeamPropertyAccess(
      ctx.req,
      propertyId,
      TEAM_API_PERMISSIONS.cancelInvitation
    );

    await assertActionSafeToExecute({
      toolName: 'propose_revoke_property_invitation',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    await cancelPropertyInvitation(teamCtx.property.id, invitationId);
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { invitationId, cancelled: true },
    };
  }

  if (toolName === 'propose_invite_property_team_member') {
    const email = str(inputPayload, 'email');
    const roleId = str(inputPayload, 'roleId');
    const propertyId = str(inputPayload, 'propertyId');
    if (!email || !roleId || !propertyId) return { ok: false, error: 'Malformed proposal payload' };

    const teamCtx = await requireTeamPropertyAccess(
      ctx.req,
      propertyId,
      TEAM_API_PERMISSIONS.inviteMember
    );

    await assertActionSafeToExecute({
      toolName: 'propose_invite_property_team_member',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const invitation = await createPropertyInvitation(teamCtx, { email, roleId });
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: propertyId,
        data: { invitation },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invite failed' };
    }
  }

  if (toolName === 'propose_update_property_team_member_role') {
    const memberId = str(inputPayload, 'memberId');
    const roleId = str(inputPayload, 'roleId');
    const propertyId = str(inputPayload, 'propertyId');
    if (!memberId || !roleId || !propertyId) {
      return { ok: false, error: 'Malformed proposal payload' };
    }

    const teamCtx = await requireTeamPropertyAccess(
      ctx.req,
      propertyId,
      TEAM_API_PERMISSIONS.updateMember
    );

    await assertActionSafeToExecute({
      toolName: 'propose_update_property_team_member_role',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const member = await updatePropertyTeamMember(teamCtx, { memberId, roleId });
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: propertyId,
        data: { member },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Update failed' };
    }
  }

  if (toolName === 'propose_remove_property_team_member') {
    const memberId = str(inputPayload, 'memberId');
    const propertyId = str(inputPayload, 'propertyId');
    if (!memberId || !propertyId) return { ok: false, error: 'Malformed proposal payload' };

    const teamCtx = await requireTeamPropertyAccess(
      ctx.req,
      propertyId,
      TEAM_API_PERMISSIONS.removeMember
    );

    await assertActionSafeToExecute({
      toolName: 'propose_remove_property_team_member',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      await removePropertyTeamMember(teamCtx, memberId);
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: propertyId,
        data: { memberId, removed: true },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Remove failed' };
    }
  }

  if (toolName === 'propose_claim_parking_booking') {
    const bookingId = str(inputPayload, 'bookingId');
    const parkingId = str(inputPayload, 'parkingId');
    if (!bookingId || !parkingId) return { ok: false, error: 'Malformed proposal payload' };
    const endorsementNote = str(inputPayload, 'endorsementNote') ?? '';

    const { parking: parkingRow } = await verifyParkingTeamAccess(
      ctx.req,
      parkingId,
      'bookings:edit'
    );

    await assertActionSafeToExecute({
      toolName: 'propose_claim_parking_booking',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const claimed = await claimParkingBooking(parkingId, bookingId, endorsementNote, parkingRow);
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditBookingId: bookingId,
        data: { booking: claimed },
      };
    } catch (err) {
      if (err instanceof ParkingBroadcastActionError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_decline_parking_booking') {
    const bookingId = str(inputPayload, 'bookingId');
    const parkingId = str(inputPayload, 'parkingId');
    if (!bookingId || !parkingId) return { ok: false, error: 'Malformed proposal payload' };

    await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_decline_parking_booking',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const result = await declineParkingBooking(parkingId, bookingId);
      return { ok: true, riskTier: 'tier2_confirmed', auditBookingId: bookingId, data: result };
    } catch (err) {
      if (err instanceof ParkingBroadcastActionError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_transition_parking_booking') {
    const bookingId = str(inputPayload, 'bookingId');
    const toStatus = str(inputPayload, 'toStatus');
    if (!bookingId || !toStatus || !isParkingStatus(toStatus)) {
      return { ok: false, error: 'Malformed proposal payload' };
    }

    const booking = await DatabaseService.getBookingById(bookingId);
    if (!booking || !booking.parking_id) return { ok: false, error: 'Parking booking not found' };
    const parkingId = String(booking.parking_id);
    await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:edit');
    await verifyBookingBelongsToParking(bookingId, parkingId);

    await assertActionSafeToExecute({
      toolName: 'propose_transition_parking_booking',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const fromStatus = String(booking.status ?? '');
    if (
      !isParkingStatus(fromStatus) ||
      fromStatus === 'PENDING_HOST_ACCEPTANCE' ||
      !canTransitionParking(fromStatus, toStatus)
    ) {
      return { ok: false, error: `Cannot transition from ${fromStatus} to ${toStatus}` };
    }

    const updated = await DatabaseService.updateBookingStatus(bookingId, toStatus, fromStatus);
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditBookingId: bookingId,
      data: updated,
    };
  }

  if (toolName === 'propose_update_property_base_rate') {
    const propertyId = str(inputPayload, 'propertyId');
    if (!propertyId) return { ok: false, error: 'Malformed proposal payload' };
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.rates:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_update_property_base_rate',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const patch: Record<string, number> = {};
    for (const key of [
      'weekdayNightlyRate',
      'weekendNightlyRate',
      'downPayment',
      'securityDeposit',
      'petFee',
      'parkingRateGuest',
      'guestAdditionalFee',
    ] as const) {
      if (typeof inputPayload[key] === 'number') patch[key] = inputPayload[key] as number;
    }

    try {
      const data = await savePropertyPricing(propertyId, patch);
      return { ok: true, riskTier: 'tier2_confirmed', auditPropertyId: propertyId, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update rates' };
    }
  }

  if (toolName === 'propose_set_property_date_rate_override') {
    const propertyId = str(inputPayload, 'propertyId');
    const date = str(inputPayload, 'date');
    const rate = Number(inputPayload.rate);
    if (
      !propertyId ||
      !date ||
      !isValidCalendarDateKey(date) ||
      !Number.isFinite(rate) ||
      rate < 0
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.rates:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_set_property_date_rate_override',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      // FULL REPLACE semantics — merge the new date into the current map first, see comment above.
      const current = await loadPropertyPricing(propertyId);
      const mergedOverrides = { ...current.dateOverrides, [date]: rate };
      const data = await savePropertyPricing(propertyId, { dateOverrides: mergedOverrides });
      return { ok: true, riskTier: 'tier2_confirmed', auditPropertyId: propertyId, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to set rate override',
      };
    }
  }

  if (toolName === 'propose_add_property_holiday_rule') {
    const propertyId = str(inputPayload, 'propertyId');
    const name = str(inputPayload, 'name');
    const startDate = str(inputPayload, 'startDate');
    const endDate = str(inputPayload, 'endDate');
    const percentage = Number(inputPayload.percentage);
    if (
      !propertyId ||
      !name ||
      !startDate ||
      !endDate ||
      !isValidCalendarDateKey(startDate) ||
      !isValidCalendarDateKey(endDate) ||
      !Number.isFinite(percentage) ||
      percentage < 0
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.rates:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_add_property_holiday_rule',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      // FULL REPLACE semantics — append to the current array first, see comment above.
      const current = await loadPropertyPricing(propertyId);
      const mergedRules = [
        ...current.holidayRules,
        { id: crypto.randomUUID(), name, startDate, endDate, percentage },
      ];
      const data = await savePropertyPricing(propertyId, { holidayRules: mergedRules });
      return { ok: true, riskTier: 'tier2_confirmed', auditPropertyId: propertyId, data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to add holiday rule',
      };
    }
  }

  if (toolName === 'propose_block_property_dates') {
    const propertyId = str(inputPayload, 'propertyId');
    const startDate = str(inputPayload, 'startDate');
    const endDate = str(inputPayload, 'endDate');
    if (
      !propertyId ||
      !startDate ||
      !endDate ||
      !isValidCalendarDateKey(startDate) ||
      !isValidCalendarDateKey(endDate)
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const note = str(inputPayload, 'note');
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.blocks:add');

    await assertActionSafeToExecute({
      toolName: 'propose_block_property_dates',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      const data = await savePropertyPricing(propertyId, {
        blockRange: { startDate, endDate, note },
      });
      return { ok: true, riskTier: 'tier2_confirmed', auditPropertyId: propertyId, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to block dates' };
    }
  }

  if (toolName === 'propose_unblock_property_dates') {
    const propertyId = str(inputPayload, 'propertyId');
    const startDate = str(inputPayload, 'startDate');
    const endDate = str(inputPayload, 'endDate');
    if (!propertyId || !startDate || !endDate)
      return { ok: false, error: 'Malformed proposal payload' };
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.blocks:delete');

    await assertActionSafeToExecute({
      toolName: 'propose_unblock_property_dates',
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) return { ok: false, error: 'Invalid date range' };
    const keys: string[] = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      keys.push(formatDateKey(cursor));
    }

    try {
      const data = await savePropertyPricing(propertyId, { unblockDateKeys: keys });
      return { ok: true, riskTier: 'tier2_confirmed', auditPropertyId: propertyId, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to unblock dates' };
    }
  }

  if (toolName === 'propose_update_parking_base_rate') {
    const parkingId = str(inputPayload, 'parkingId');
    if (!parkingId) return { ok: false, error: 'Malformed proposal payload' };
    await verifyParkingTeamAccess(ctx.req, parkingId, 'pricing:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_update_parking_base_rate',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const patch: Record<string, number> = {};
    for (const key of ['weekdayNightlyRate', 'weekendNightlyRate'] as const) {
      if (typeof inputPayload[key] === 'number') patch[key] = inputPayload[key] as number;
    }

    try {
      const data = await saveParkingPricing(parkingId, patch);
      return { ok: true, riskTier: 'tier2_confirmed', data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update rates' };
    }
  }

  if (toolName === 'propose_set_parking_date_rate_override') {
    const parkingId = str(inputPayload, 'parkingId');
    const date = str(inputPayload, 'date');
    const rate = Number(inputPayload.rate);
    if (
      !parkingId ||
      !date ||
      !isValidCalendarDateKey(date) ||
      !Number.isFinite(rate) ||
      rate < 0
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    await verifyParkingTeamAccess(ctx.req, parkingId, 'pricing:edit');

    await assertActionSafeToExecute({
      toolName: 'propose_set_parking_date_rate_override',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    try {
      // FULL REPLACE semantics — merge first, same reasoning as the property version above.
      const current = await loadParkingPricing(parkingId);
      const mergedOverrides = { ...current.dateOverrides, [date]: rate };
      const data = await saveParkingPricing(parkingId, { dateOverrides: mergedOverrides });
      return { ok: true, riskTier: 'tier2_confirmed', data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to set rate override',
      };
    }
  }

  if (toolName === 'propose_mark_inbox_thread_read') {
    const conversationId = str(inputPayload, 'conversationId');
    if (!conversationId) return { ok: false, error: 'Malformed proposal payload' };
    const scopeArgs = inboxScopeArgs(inputPayload);
    if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const inboxCtx = await resolveInboxAccess(ctx.req, 'reply', scopeArgs);

    await assertActionSafeToExecute({
      toolName: 'propose_mark_inbox_thread_read',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    await markConversationRead(inboxCtx.orgId, conversationId);
    return { ok: true, riskTier: 'tier2_confirmed', data: { conversationId, read: true } };
  }

  if (toolName === 'propose_send_inbox_reply') {
    const conversationId = str(inputPayload, 'conversationId');
    const text = str(inputPayload, 'text') ?? '';
    if (!conversationId) return { ok: false, error: 'Malformed proposal payload' };
    const attachmentPaths = Array.isArray(inputPayload.attachmentPaths)
      ? (inputPayload.attachmentPaths as unknown[])
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .slice(0, 3)
      : [];
    if (!text.trim() && attachmentPaths.length === 0) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const scopeArgs = inboxScopeArgs(inputPayload);
    if (!scopeArgs.propertyId && !scopeArgs.parkingId) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const inboxCtx = await resolveInboxAccess(ctx.req, 'reply', scopeArgs);

    await assertActionSafeToExecute({
      toolName: 'propose_send_inbox_reply',
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const metaConnectionIds = await resolveMetaConnectionIdsForScope(
      inboxCtx.orgId,
      inboxCtx.scope
    );
    try {
      const conv = await loadInboxConversationInScope(
        inboxCtx,
        conversationId,
        new Set(metaConnectionIds)
      );
      const attachments = await resolveInboxReplyAttachments(ctx, conversationId, attachmentPaths);
      const result = await sendInboxReply(inboxCtx, conv, ctx.userId, text, { attachments });
      return { ok: true, riskTier: 'tier2_confirmed', data: { conversationId, ...result } };
    } catch (err) {
      if (err instanceof InboxSendReplyError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_create_support_ticket') {
    return await executeCreateSupportTicket(ctx, inputPayload);
  }

  if (toolName === 'propose_publish_to_meta') {
    const propertyId = str(inputPayload, 'propertyId');
    const connectionId = str(inputPayload, 'connectionId');
    const mediaUrlArg = str(inputPayload, 'mediaUrl');
    const attachmentPath = str(inputPayload, 'attachmentPath');
    const publishType = str(inputPayload, 'publishType');
    if (
      !propertyId ||
      !connectionId ||
      !publishType ||
      !META_PUBLISH_TYPES.has(publishType) ||
      (!mediaUrlArg && !attachmentPath)
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }
    const caption = str(inputPayload, 'caption') ?? '';
    const access = await verifyMarketingPropertyAccess(
      ctx,
      propertyId,
      'marketing.publish:add',
      'marketingStudio'
    );
    await requireMarketingPublishAllowed(access.propertyId);

    await assertActionSafeToExecute({
      toolName: 'propose_publish_to_meta',
      targetPropertyId: access.propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    let rawMediaUrl = mediaUrlArg;
    if (attachmentPath) {
      const conversationId = ctx.conversationId?.trim();
      if (!conversationId) {
        return { ok: false, error: 'Conversation is required to publish from a chat attachment' };
      }
      try {
        const attachment = await downloadAssistantAttachment({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          conversationId,
          path: attachmentPath,
        });
        const fileName = attachment.path.split('/').pop() ?? 'attachment';
        rawMediaUrl = await uploadMarketingMediaFromAssistantBytes(
          createServiceClient(),
          access.propertyId,
          attachment.bytes,
          attachment.mimeType,
          fileName
        );
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    if (!rawMediaUrl) return { ok: false, error: 'mediaUrl is required' };

    try {
      const result = await publishMarketingPost({
        propertyId: access.propertyId,
        organizationId: access.organizationId,
        connectionId,
        publishType: publishType as MetaPublishType,
        rawMediaUrl,
        caption,
        createdBy: ctx.userId,
      });
      return {
        ok: true,
        riskTier: 'tier2_confirmed',
        auditPropertyId: access.propertyId,
        data: result,
      };
    } catch (err) {
      if (err instanceof MarketingPublishError) return { ok: false, error: err.message };
      throw err;
    }
  }

  if (toolName === 'propose_apply_booking_attachment') {
    return await executeApplyBookingAttachment(ctx, inputPayload);
  }

  if (toolName === 'propose_send_workflow_email') {
    return await executeSendWorkflowEmail(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_org_logo') {
    return await executeApplyOrgLogo(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_property_media') {
    return await executeApplyPropertyMedia(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_parking_media') {
    return await executeApplyParkingMedia(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_app_settings_attachment') {
    return await executeApplyAppSettingsAttachment(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_template_attachment') {
    return await executeApplyTemplateAttachment(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_org_verification_attachment') {
    return await executeApplyOrgVerificationAttachment(ctx, inputPayload);
  }
  if (toolName === 'propose_submit_org_verification') {
    return await executeSubmitOrgVerification(ctx, inputPayload);
  }
  if (toolName === 'propose_apply_listing_authorization_attachment') {
    return await executeApplyListingAuthorizationAttachment(ctx, inputPayload);
  }
  if (toolName === 'propose_submit_listing_authorization') {
    return await executeSubmitListingAuthorization(ctx, inputPayload);
  }
  if (toolName === 'propose_stage_gcash_qr') {
    return await executeStageGcashQr(ctx, inputPayload);
  }

  if (toolName === 'propose_run_channel_sync') {
    return await executeRunChannelSync(ctx, inputPayload);
  }
  if (toolName === 'propose_update_public_page_template') {
    return await executeUpdatePublicPageTemplate(ctx, inputPayload);
  }
  if (toolName === 'propose_update_finance_line_item') {
    return await executeUpdateFinanceLineItem(ctx, inputPayload);
  }
  if (toolName === 'propose_delete_finance_line_item') {
    return await executeDeleteFinanceLineItem(ctx, inputPayload);
  }
  if (toolName === 'propose_update_maintenance_item') {
    return await executeUpdateMaintenanceItem(ctx, inputPayload);
  }
  if (toolName === 'propose_delete_maintenance_item') {
    return await executeDeleteMaintenanceItem(ctx, inputPayload);
  }

  return { ok: false, error: `Unknown or non-confirmable tool: ${toolName}` };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

type ToolHandler = (
  ctx: ToolExecutionContext,
  args: Record<string, unknown>
) => ToolResult | Promise<ToolResult>;

/**
 * Tool registry: every executable tool name maps to exactly one handler. `executeTool` validates
 * arguments against the tool's declared schema before dispatch; handlers re-check authorization.
 */
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_knowledge_base: (_ctx, args) => toolSearchKnowledgeBase(args),
  explain_booking_status: (_ctx, args) => toolExplainBookingStatus(args),
  get_booking: (ctx, args) => toolGetBooking(ctx, args),
  get_booking_documents: (ctx, args) => toolGetBookingDocuments(ctx, args),
  list_bookings: (ctx, args) => toolListBookings(ctx, args),
  get_available_transitions: (ctx, args) => toolGetAvailableTransitions(ctx, args),
  plan_booking_journey: (ctx, args) => toolPlanBookingJourney(ctx, args),
  get_available_dates: (ctx, args) => toolGetAvailableDates(ctx, args),
  get_dashboard_stats: (ctx, args) => toolGetDashboardStats(ctx, args),
  get_finance_summary: (ctx, args) => toolGetFinanceSummary(ctx, args),
  list_finance_bookings: (ctx, args) => toolListFinanceBookings(ctx, args),
  get_maintenance_summary: (ctx, args) => toolGetMaintenanceSummary(ctx, args),
  list_maintenance_items: (ctx, args) => toolListMaintenanceItems(ctx, args),
  run_receipt_validation: (ctx, args) => toolRunReceiptValidation(ctx, args),
  propose_transition_booking: (ctx, args) => toolProposeTransitionBooking(ctx, args),
  propose_cancel_booking: (ctx, args) => toolProposeCancelBooking(ctx, args),
  propose_add_finance_line_item: (ctx, args) => toolProposeAddFinanceLineItem(ctx, args),
  propose_create_maintenance_item: (ctx, args) => toolProposeCreateMaintenanceItem(ctx, args),
  get_org_profile: (ctx) => toolGetOrgProfile(ctx),
  get_org_verification_status: (ctx) => toolGetOrgVerificationStatus(ctx),
  list_team_members: (ctx) => toolListTeamMembers(ctx),
  list_pending_invitations: (ctx) => toolListPendingInvitations(ctx),
  propose_update_org_profile: (ctx, args) => toolProposeUpdateOrgProfile(ctx, args),
  propose_invite_team_member: (ctx, args) => toolProposeInviteTeamMember(ctx, args),
  propose_update_team_member_role: (ctx, args) => toolProposeUpdateTeamMemberRole(ctx, args),
  propose_revoke_invitation: (ctx, args) => toolProposeRevokeInvitation(ctx, args),
  propose_remove_team_member: (ctx, args) => toolProposeRemoveTeamMember(ctx, args),
  get_property_profile: (ctx, args) => toolGetPropertyProfile(ctx, args),
  get_property_settings: (ctx, args) => toolGetPropertySettings(ctx, args),
  list_property_team_members: (ctx, args) => toolListPropertyTeamMembers(ctx, args),
  list_property_pending_invitations: (ctx, args) => toolListPropertyPendingInvitations(ctx, args),
  propose_update_property_profile: (ctx, args) => toolProposeUpdatePropertyProfile(ctx, args),
  propose_update_property_settings: (ctx, args) => toolProposeUpdatePropertySettings(ctx, args),
  propose_revoke_property_invitation: (ctx, args) => toolProposeRevokePropertyInvitation(ctx, args),
  propose_invite_property_team_member: (ctx, args) => toolProposeInvitePropertyTeamMember(ctx, args),
  propose_update_property_team_member_role: (ctx, args) => toolProposeUpdatePropertyTeamMemberRole(ctx, args),
  propose_remove_property_team_member: (ctx, args) => toolProposeRemovePropertyTeamMember(ctx, args),
  list_parkings: (ctx) => toolListParkings(ctx),
  get_parking_booking: (ctx, args) => toolGetParkingBooking(ctx, args),
  list_parking_bookings: (ctx, args) => toolListParkingBookings(ctx, args),
  get_parking_available_transitions: (ctx, args) => toolGetParkingAvailableTransitions(ctx, args),
  propose_claim_parking_booking: (ctx, args) => toolProposeClaimParkingBooking(ctx, args),
  propose_decline_parking_booking: (ctx, args) => toolProposeDeclineParkingBooking(ctx, args),
  propose_transition_parking_booking: (ctx, args) => toolProposeTransitionParkingBooking(ctx, args),
  get_property_pricing: (ctx, args) => toolGetPropertyPricing(ctx, args),
  get_parking_pricing: (ctx, args) => toolGetParkingPricing(ctx, args),
  propose_update_property_base_rate: (ctx, args) => toolProposeUpdatePropertyBaseRate(ctx, args),
  propose_set_property_date_rate_override: (ctx, args) => toolProposeSetPropertyDateRateOverride(ctx, args),
  propose_add_property_holiday_rule: (ctx, args) => toolProposeAddPropertyHolidayRule(ctx, args),
  propose_block_property_dates: (ctx, args) => toolProposeBlockPropertyDates(ctx, args),
  propose_unblock_property_dates: (ctx, args) => toolProposeUnblockPropertyDates(ctx, args),
  propose_update_parking_base_rate: (ctx, args) => toolProposeUpdateParkingBaseRate(ctx, args),
  propose_set_parking_date_rate_override: (ctx, args) => toolProposeSetParkingDateRateOverride(ctx, args),
  list_inbox_threads: (ctx, args) => toolListInboxThreads(ctx, args),
  get_inbox_thread: (ctx, args) => toolGetInboxThread(ctx, args),
  get_inbox_settings: (ctx, args) => toolGetInboxSettings(ctx, args),
  list_inbox_quick_reply_templates: (ctx, args) => toolListInboxQuickReplyTemplates(ctx, args),
  propose_mark_inbox_thread_read: (ctx, args) => toolProposeMarkInboxThreadRead(ctx, args),
  draft_inbox_reply: (ctx, args) => toolDraftInboxReply(ctx, args),
  propose_send_inbox_reply: (ctx, args) => toolProposeSendInboxReply(ctx, args),
  list_support_tickets: (ctx, args) => toolListSupportTickets(ctx, args),
  get_support_ticket: (ctx, args) => toolGetSupportTicket(ctx, args),
  propose_create_support_ticket: (ctx, args) => toolProposeCreateSupportTicket(ctx, args),
  list_host_announcements: (ctx, args) => toolListHostAnnouncements(ctx, args),
  get_host_announcement: (ctx, args) => toolGetHostAnnouncement(ctx, args),
  get_org_plan_snapshot: (ctx) => toolGetOrgPlanSnapshot(ctx),
  list_marketing_templates: (ctx, args) => toolListMarketingTemplates(ctx, args),
  get_marketing_publish_history: (ctx, args) => toolGetMarketingPublishHistory(ctx, args),
  search_marketing_music: (ctx, args) => toolSearchMarketingMusic(ctx, args),
  draft_marketing_caption: (ctx, args) => toolDraftMarketingCaption(ctx, args),
  draft_marketing_template: (ctx, args) => toolDraftMarketingTemplate(ctx, args),
  propose_publish_to_meta: (ctx, args) => toolProposePublishToMeta(ctx, args),
  propose_apply_booking_attachment: (ctx, args) => toolProposeApplyBookingAttachment(ctx, args),
  propose_send_workflow_email: (ctx, args) => toolProposeSendWorkflowEmail(ctx, args),
  propose_apply_org_logo: (ctx, args) => toolProposeApplyOrgLogo(ctx, args),
  propose_apply_property_media: (ctx, args) => toolProposeApplyPropertyMedia(ctx, args),
  propose_apply_parking_media: (ctx, args) => toolProposeApplyParkingMedia(ctx, args),
  propose_apply_app_settings_attachment: (ctx, args) => toolProposeApplyAppSettingsAttachment(ctx, args),
  propose_apply_template_attachment: (ctx, args) => toolProposeApplyTemplateAttachment(ctx, args),
  propose_apply_org_verification_attachment: (ctx, args) => toolProposeApplyOrgVerificationAttachment(ctx, args),
  propose_submit_org_verification: (ctx, args) => toolProposeSubmitOrgVerification(ctx, args),
  propose_apply_listing_authorization_attachment: (ctx, args) => toolProposeApplyListingAuthorizationAttachment(ctx, args),
  propose_submit_listing_authorization: (ctx, args) => toolProposeSubmitListingAuthorization(ctx, args),
  propose_stage_gcash_qr: (ctx, args) => toolProposeStageGcashQr(ctx, args),
  get_channel_sync_status: (ctx, args) => toolGetChannelSyncStatus(ctx, args),
  propose_run_channel_sync: (ctx, args) => toolProposeRunChannelSync(ctx, args),
  get_public_pages_status: (ctx, args) => toolGetPublicPagesStatus(ctx, args),
  propose_update_public_page_template: (ctx, args) => toolProposeUpdatePublicPageTemplate(ctx, args),
  get_property_analytics: (ctx, args) => toolGetPropertyAnalytics(ctx, args),
  explain_metric: (_ctx, args) => toolExplainAnalyticsMetric(args),
  propose_update_finance_line_item: (ctx, args) => toolProposeUpdateFinanceLineItem(ctx, args),
  propose_delete_finance_line_item: (ctx, args) => toolProposeDeleteFinanceLineItem(ctx, args),
  propose_update_maintenance_item: (ctx, args) => toolProposeUpdateMaintenanceItem(ctx, args),
  propose_delete_maintenance_item: (ctx, args) => toolProposeDeleteMaintenanceItem(ctx, args),
  get_notification_preferences: (ctx, args) => toolGetNotificationPreferences(ctx, args),
  guide_notification_settings: (ctx, args) => toolGuideNotificationSettings(ctx, args),
  get_telegram_notification_settings: (ctx, args) => toolGetTelegramNotificationSettings(ctx, args),
  guide_telegram_settings: (ctx, args) => toolGuideTelegramSettings(ctx, args),
  guide_create_booking: (ctx, args) => toolGuideCreateBooking(ctx, args),
  guide_import_bookings: (ctx, args) => toolGuideImportBookings(ctx, args),
};

/** Test/catalog helper: tool names that have an execution handler. */
export function registeredToolNames(): string[] {
  return Object.keys(TOOL_HANDLERS);
}

export async function executeTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  if (!isKnownTool(toolName)) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }
  const validated = validateToolArgs(toolParameterSchema(toolName), rawArgs);
  if (!validated.ok) return { ok: false, error: validated.error };
  const args = validated.args;

  try {
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) return { ok: false, error: `Unhandled tool: ${toolName}` };
    return await handler(ctx, args);
  } catch (err) {
    // A permission re-check failure (verifyPropertyAccess/verifyOrgAccess throwing a Response)
    // or any other tool error surfaces as a plain refusal — never a confirmation prompt.
    if (err instanceof Response) {
      return { ok: false, error: 'Access restricted for this action.' };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Gemini function declarations ────────────────────────────────────────────

let toolParameterSchemas: Map<string, unknown> | null = null;

/** Declared JSON schema for a tool's arguments (server-side validation source of truth). */
function toolParameterSchema(toolName: string): unknown {
  toolParameterSchemas ??= new Map(TOOL_DECLARATIONS.map((t) => [t.name, t.parameters]));
  return toolParameterSchemas.get(toolName);
}

export const TOOL_DECLARATIONS = [
  {
    name: 'search_knowledge_base',
    description: 'Search the host-facing knowledge base for "how does X work" questions.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'explain_booking_status',
    description: 'Explain what a booking status means and what unblocks the next step.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string' } },
      required: ['status'],
    },
  },
  {
    name: 'get_booking',
    description:
      'Fetch a single booking by id, including human statusLabel, pendingTasks, securityDeposit, sdRefundAmount, and documents (label + storage url for GAF, receipts, IDs, pet forms). When the host asks to see a file, also call get_booking_documents.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'get_booking_documents',
    description:
      'Return booking files the host already has on the Files tab (approved GAF, pet form, receipts, IDs, parking docs) with storage URLs. Use this when the host asks to show, provide, or open a document. Filter with kinds: gaf, pet, receipt, id, parking, booking.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['gaf', 'pet', 'receipt', 'id', 'parking', 'booking'],
          },
        },
      },
    },
  },
  {
    name: 'list_bookings',
    description:
      'List bookings (guest name, human statusLabel, dates, hostLabel). Optionally filter by property, status, check-in date range, or guestName/q (free-text guest search). When the host names a guest, search with guestName/q first — do not claim the booking is missing until that search returns empty. Date-range queries include completed stays.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        status: { type: 'array', items: { type: 'string' } },
        from: { type: 'string' },
        to: { type: 'string' },
        guestName: {
          type: 'string',
          description: 'Guest name to search (preferred over guessing)',
        },
        q: { type: 'string', description: 'Free-text guest search (same as guestName)' },
      },
    },
  },
  {
    name: 'get_available_transitions',
    description: 'List the statuses a booking can currently move to.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'plan_booking_journey',
    description:
      'Read-only remaining booking pipeline (done/current/upcoming stages and required sub-forms). Use when the host asks to guide them through this booking’s remaining steps. Does not execute any transition.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'get_available_dates',
    description:
      'Get booked stays AND open (unbooked) nights for a property in a date window. Use this for "what dates are booked/available this month". Defaults to the current calendar month (Asia/Manila). bookedStays lists guest name + check-in/out overlapping the window (non-cancelled). availableRanges are unbooked nights from today forward.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        to: { type: 'string', description: 'YYYY-MM-DD, defaults to end of the from month' },
      },
    },
  },
  {
    name: 'get_dashboard_stats',
    description:
      'Get aggregate dashboard stats (check-ins, check-outs, occupancy) for a property or org.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
  {
    name: 'get_finance_summary',
    description:
      'Get Finance-page KPIs (total income, total expenses, net profit, pending) for a property. Defaults to this calendar month and the current page property. Use display.* ₱ strings and netProfit for host answers — do not invent Grand Net.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: {
          type: 'string',
          description: 'YYYY-MM-DD inclusive start (default: first day of this Manila month)',
        },
        to: {
          type: 'string',
          description: 'YYYY-MM-DD inclusive end (default: last day of this Manila month)',
        },
      },
    },
  },
  {
    name: 'list_finance_bookings',
    description: 'List bookings with finance figures for a property.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
  {
    name: 'get_maintenance_summary',
    description: 'Get maintenance KPI summary for a property.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
  {
    name: 'list_maintenance_items',
    description: 'List maintenance items for a property.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
  {
    name: 'run_receipt_validation',
    description:
      "Re-run AI validation on a booking's payment receipts (idempotent, no financial change).",
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'propose_transition_booking',
    description:
      'Move a booking to a new status. Financially-sensitive or override transitions require host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        toStatus: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['bookingId', 'toStatus'],
    },
  },
  {
    name: 'propose_cancel_booking',
    description: 'Cancel a booking. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'propose_add_finance_line_item',
    description:
      'Log a finance expense or income entry for a property (e.g. "log a $50 cleaning expense for today"). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        kind: { type: 'string', enum: ['expense', 'income'] },
        label: { type: 'string' },
        category: { type: 'string' },
        amount: { type: 'number' },
        occurredOn: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['kind', 'label', 'category', 'amount', 'occurredOn'],
    },
  },
  {
    name: 'propose_create_maintenance_item',
    description:
      'Create a maintenance ticket for a property (e.g. "add a maintenance item to fix the AC next Tuesday"). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        label: { type: 'string' },
        category: { type: 'string' },
        scheduledOn: { type: 'string', description: 'YYYY-MM-DD' },
        notes: { type: 'string' },
      },
      required: ['label', 'scheduledOn'],
    },
  },
  {
    name: 'get_org_profile',
    description:
      "Get the organization's profile: name, description, tagline, brand color, contact info.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_org_verification_status',
    description:
      "Get the organization's base/enhanced verification status and verified-badge state.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_team_members',
    description: "List the organization's team members with their roles and status.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_pending_invitations',
    description: 'List pending (not yet accepted) organization team invitations.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'propose_update_org_profile',
    description:
      'Update the organization profile (name, description, tagline, brand color, or contact info). Owner-only.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        tagline: { type: 'string' },
        brandColor: { type: 'string', description: 'Hex color, e.g. #24a88e' },
        contactName: { type: 'string' },
        contactRole: { type: 'string' },
        contactPhone: { type: 'string' },
        contactEmail: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_invite_team_member',
    description:
      'Invite someone to join the organization team by email. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        roleId: {
          type: 'string',
          description: 'ADMIN or a permission-template UUID — defaults to ADMIN',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'propose_update_team_member_role',
    description: "Change a team member's role/permissions. Always requires host confirmation.",
    parameters: {
      type: 'object',
      properties: {
        memberId: { type: 'string' },
        roleId: { type: 'string' },
      },
      required: ['memberId', 'roleId'],
    },
  },
  {
    name: 'propose_revoke_invitation',
    description: 'Cancel a pending team invitation before it is accepted.',
    parameters: {
      type: 'object',
      properties: { invitationId: { type: 'string' } },
      required: ['invitationId'],
    },
  },
  {
    name: 'propose_remove_team_member',
    description:
      'Remove a member from the organization team, revoking their access. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: { memberId: { type: 'string' } },
      required: ['memberId'],
    },
  },
  {
    name: 'get_property_profile',
    description:
      "Get a property's profile: name, address, tower/unit, residence name, max guests, status.",
    parameters: { type: 'object', properties: { propertyId: { type: 'string' } } },
  },
  {
    name: 'get_property_settings',
    description:
      "Get a property's configurable settings: contact info, bedrooms/bathrooms/floors, max adults/children, description, custom house rules, custom amenities, cancellation policy.",
    parameters: { type: 'object', properties: { propertyId: { type: 'string' } } },
  },
  {
    name: 'list_property_team_members',
    description: "List a property's team members with their roles and status.",
    parameters: { type: 'object', properties: { propertyId: { type: 'string' } } },
  },
  {
    name: 'list_property_pending_invitations',
    description: 'List pending (not yet accepted) property team invitations.',
    parameters: { type: 'object', properties: { propertyId: { type: 'string' } } },
  },
  {
    name: 'propose_update_property_profile',
    description:
      'Update a property profile (name, address, max guests, status, tower/unit, or residence name). Requires the matching settings.* permission. For amenities, house rules, cancellation policy, or capacity/contact details use propose_update_property_settings instead.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        name: { type: 'string' },
        address: { type: 'string' },
        maxGuests: { type: 'number' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        tower: { type: 'string' },
        unitNumber: { type: 'string' },
        residenceName: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_update_property_settings',
    description:
      "Update a property's configurable settings — contact info, bedrooms/bathrooms/floors, max adults/children, description, custom house rules, custom amenities, or cancellation policy. Owner-only. Always requires host confirmation, even for small changes, since these are guest-facing terms.",
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        contactName: { type: 'string' },
        contactPhone: { type: 'string' },
        contactEmail: { type: 'string' },
        bedrooms: { type: 'number' },
        bathrooms: { type: 'number' },
        floors: { type: 'number' },
        maxAdults: { type: 'number' },
        maxChildren: { type: 'number' },
        description: { type: 'string' },
        customHouseRules: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        },
        customAmenities: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        },
        cancellationPolicy: {
          type: 'object',
          description:
            'Cancellation policy settings object — read current value via get_property_settings first.',
        },
      },
    },
  },
  {
    name: 'propose_invite_property_team_member',
    description:
      'Invite someone to join a property team by email. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        email: { type: 'string' },
        roleId: { type: 'string' },
      },
      required: ['email', 'roleId'],
    },
  },
  {
    name: 'propose_update_property_team_member_role',
    description:
      "Change a property team member's role/permissions. Always requires host confirmation.",
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        memberId: { type: 'string' },
        roleId: { type: 'string' },
      },
      required: ['memberId', 'roleId'],
    },
  },
  {
    name: 'propose_revoke_property_invitation',
    description: 'Cancel a pending property team invitation before it is accepted.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        invitationId: { type: 'string' },
      },
      required: ['invitationId'],
    },
  },
  {
    name: 'propose_remove_property_team_member',
    description:
      'Remove a member from a property team, revoking their access. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        memberId: { type: 'string' },
      },
      required: ['memberId'],
    },
  },
  {
    name: 'list_parkings',
    description: "List the organization's parking slots with type, rate, and status.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_parking_booking',
    description: 'Fetch a single parking booking/request by id.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'list_parking_bookings',
    description:
      'List parking bookings/requests, optionally filtered by parking slot, status, or date range. Statuses: PENDING_HOST_ACCEPTANCE (awaiting broadcast response), PENDING_PAYMENT (host accepted, awaiting guest payment), PENDING_REVIEW (paid & confirmed), READY_FOR_CHECKIN, COMPLETED, CANCELLED, NO_HOST_AVAILABLE.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        status: { type: 'array', items: { type: 'string' } },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
  {
    name: 'get_parking_available_transitions',
    description: 'List the statuses a parking booking can currently move to.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string' } },
      required: ['bookingId'],
    },
  },
  {
    name: 'propose_claim_parking_booking',
    description:
      'Accept/claim a broadcast parking request for this parking slot — commits the slot and emails the guest to pay and confirm (the guest still needs to complete payment before the booking is fully confirmed). Always requires host confirmation; first-Accept-wins, may fail if another host already claimed it.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        parkingId: { type: 'string' },
        endorsementNote: { type: 'string' },
      },
      required: ['bookingId', 'parkingId'],
    },
  },
  {
    name: 'propose_decline_parking_booking',
    description:
      "Decline this parking slot's candidacy for a broadcast request. If every candidate in the current ranked batch has declined, the system offers the next batch of hosts automatically, or terminates and notifies the guest once no candidates remain. Always requires host confirmation.",
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['bookingId', 'parkingId'],
    },
  },
  {
    name: 'propose_transition_parking_booking',
    description:
      'Move a parking booking to a new status (post-broadcast only — cannot be used while a request is still PENDING_HOST_ACCEPTANCE; use claim/decline for that). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        toStatus: { type: 'string' },
      },
      required: ['bookingId', 'toStatus'],
    },
  },
  {
    name: 'get_property_pricing',
    description:
      "Get a property's pricing: base weekday/weekend rates, fee defaults, up to 30 date-specific rate overrides, up to 30 blocked dates, and holiday pricing rules.",
    parameters: { type: 'object', properties: { propertyId: { type: 'string' } } },
  },
  {
    name: 'get_parking_pricing',
    description:
      "Get a parking slot's pricing: base weekday/weekend rates and up to 30 date-specific rate overrides.",
    parameters: {
      type: 'object',
      properties: { parkingId: { type: 'string' } },
      required: ['parkingId'],
    },
  },
  {
    name: 'propose_update_property_base_rate',
    description:
      "Update a property's base pricing (weekday/weekend nightly rate, down payment, security deposit, pet fee, parking rate, or extra-guest fee). Always requires host confirmation.",
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        weekdayNightlyRate: { type: 'number' },
        weekendNightlyRate: { type: 'number' },
        downPayment: { type: 'number' },
        securityDeposit: { type: 'number' },
        petFee: { type: 'number' },
        parkingRateGuest: { type: 'number' },
        guestAdditionalFee: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_set_property_date_rate_override',
    description:
      'Set a special nightly rate for one specific date on a property (e.g. "set Dec 31 to 8000"). Single date only, not a range or bulk change. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        rate: { type: 'number' },
      },
      required: ['date', 'rate'],
    },
  },
  {
    name: 'propose_add_property_holiday_rule',
    description:
      'Add a holiday pricing rule for a property — a date range with a percentage rate increase (e.g. "add 50% for Christmas, Dec 24-26"). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        name: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        percentage: { type: 'number' },
      },
      required: ['name', 'startDate', 'endDate', 'percentage'],
    },
  },
  {
    name: 'propose_block_property_dates',
    description:
      'Block a date range on a property from guest availability (owner-managed block, e.g. for personal use or maintenance). Fails if any date in the range is already booked. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        note: { type: 'string' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'propose_unblock_property_dates',
    description:
      'Remove an owner-managed availability block for a date range on a property (up to 62 days at a time). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'propose_update_parking_base_rate',
    description:
      "Update a parking slot's base pricing (weekday/weekend nightly rate). Always requires host confirmation.",
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        weekdayNightlyRate: { type: 'number' },
        weekendNightlyRate: { type: 'number' },
      },
      required: ['parkingId'],
    },
  },
  {
    name: 'propose_set_parking_date_rate_override',
    description:
      'Set a special nightly rate for one specific date on a parking slot. Single date only, not a range or bulk change. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        rate: { type: 'number' },
      },
      required: ['parkingId', 'date', 'rate'],
    },
  },
  {
    name: 'list_inbox_threads',
    description:
      'List Guest Inbox conversations for a property or parking slot, optionally filtered by status (unread/pending/replied).',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
        status: { type: 'string', enum: ['unread', 'pending', 'replied', 'all'] },
      },
    },
  },
  {
    name: 'get_inbox_thread',
    description: 'Fetch a single Guest Inbox conversation with its recent messages.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'get_inbox_settings',
    description: "Get the Guest Inbox's auto-reply settings (enabled state and mode).",
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
    },
  },
  {
    name: 'list_inbox_quick_reply_templates',
    description: 'List saved quick-reply templates for the Guest Inbox.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_mark_inbox_thread_read',
    description:
      'Mark a Guest Inbox conversation as read. Internal only — does not notify the guest.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'draft_inbox_reply',
    description:
      'Generate an AI-drafted reply suggestion for a Guest Inbox conversation for the host to review — does NOT send it. Use propose_send_inbox_reply to actually send.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'propose_send_inbox_reply',
    description:
      'Send a real reply to a guest in a Guest Inbox conversation (web chat, Messenger, or Instagram DM). Optional attachmentPath(s) from this assistant conversation work on website chat only — Meta DMs are text-only. This sends immediately once confirmed — always requires explicit host confirmation, no exceptions.',
    parameters: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        text: { type: 'string' },
        attachmentPath: { type: 'string' },
        attachmentPaths: { type: 'array', items: { type: 'string' } },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'list_marketing_templates',
    description:
      "List a property's saved Marketing Studio templates (calendar/design/video). Global-admin only — see note on Marketing Studio access.",
    parameters: {
      type: 'object',
      properties: { propertyId: { type: 'string' } },
      required: ['propertyId'],
    },
  },
  {
    name: 'get_marketing_publish_history',
    description:
      "Get a property's recent Meta (Facebook/Instagram) publish history. Global-admin only.",
    parameters: {
      type: 'object',
      properties: { propertyId: { type: 'string' } },
      required: ['propertyId'],
    },
  },
  {
    name: 'search_marketing_music',
    description:
      'Search royalty-free background music (Jamendo) for marketing videos/reels. Global-admin only.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        query: { type: 'string' },
      },
      required: ['propertyId'],
    },
  },
  {
    name: 'draft_marketing_caption',
    description:
      'Generate an AI-drafted social media caption for a property (Facebook or Instagram, post or story) — for host review, does not post anywhere. Global-admin only.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        platform: { type: 'string', enum: ['facebook', 'instagram'] },
        postType: { type: 'string', enum: ['post', 'story'] },
        contentHint: { type: 'string' },
        nightlyRate: { type: 'string' },
        availabilityText: { type: 'string' },
      },
      required: ['propertyId'],
    },
  },
  {
    name: 'draft_marketing_template',
    description:
      'Generate AI design tokens for a Marketing Studio calendar/design/video template from a text prompt — for the host to review and refine in the visual editor. Does not save or publish. Global-admin only.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        contentType: { type: 'string', enum: ['calendar', 'design', 'video'] },
        prompt: { type: 'string' },
        availabilityText: { type: 'string' },
      },
      required: ['propertyId', 'prompt'],
    },
  },
  {
    name: 'propose_publish_to_meta',
    description:
      'Publish an image or video to a connected Facebook Page or Instagram account (post, story, or reel) with a caption. Use mediaUrl (https) or attachmentPath from this conversation. Publishes publicly once confirmed. Global-admin only.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        connectionId: { type: 'string' },
        mediaUrl: { type: 'string', description: 'https URL of the image/video to publish' },
        attachmentPath: {
          type: 'string',
          description: 'Path from this conversation attachments (alternative to mediaUrl)',
        },
        publishType: {
          type: 'string',
          enum: ['facebook_post', 'instagram_post', 'instagram_story', 'instagram_reel'],
        },
        caption: { type: 'string' },
      },
      required: ['propertyId', 'connectionId', 'publishType'],
    },
  },
  APPLY_BOOKING_ATTACHMENT_TOOL_DECLARATION,
  SEND_WORKFLOW_EMAIL_TOOL_DECLARATION,
  APPLY_ORG_LOGO_TOOL_DECLARATION,
  APPLY_PROPERTY_MEDIA_TOOL_DECLARATION,
  APPLY_PARKING_MEDIA_TOOL_DECLARATION,
  APPLY_APP_SETTINGS_ATTACHMENT_TOOL_DECLARATION,
  APPLY_TEMPLATE_ATTACHMENT_TOOL_DECLARATION,
  APPLY_ORG_VERIFICATION_ATTACHMENT_TOOL_DECLARATION,
  SUBMIT_ORG_VERIFICATION_TOOL_DECLARATION,
  APPLY_LISTING_AUTHORIZATION_ATTACHMENT_TOOL_DECLARATION,
  SUBMIT_LISTING_AUTHORIZATION_TOOL_DECLARATION,
  STAGE_GCASH_QR_TOOL_DECLARATION,
  LIST_SUPPORT_TICKETS_TOOL_DECLARATION,
  GET_SUPPORT_TICKET_TOOL_DECLARATION,
  PROPOSE_CREATE_SUPPORT_TICKET_TOOL_DECLARATION,
  LIST_HOST_ANNOUNCEMENTS_TOOL_DECLARATION,
  GET_HOST_ANNOUNCEMENT_TOOL_DECLARATION,
  GET_ORG_PLAN_SNAPSHOT_TOOL_DECLARATION,
  GET_CHANNEL_SYNC_STATUS_TOOL_DECLARATION,
  RUN_CHANNEL_SYNC_TOOL_DECLARATION,
  GET_PUBLIC_PAGES_STATUS_TOOL_DECLARATION,
  UPDATE_PUBLIC_PAGE_TEMPLATE_TOOL_DECLARATION,
  UPDATE_FINANCE_LINE_ITEM_TOOL_DECLARATION,
  DELETE_FINANCE_LINE_ITEM_TOOL_DECLARATION,
  UPDATE_MAINTENANCE_ITEM_TOOL_DECLARATION,
  DELETE_MAINTENANCE_ITEM_TOOL_DECLARATION,
  GET_NOTIFICATION_PREFERENCES_TOOL_DECLARATION,
  GUIDE_NOTIFICATION_SETTINGS_TOOL_DECLARATION,
  GET_TELEGRAM_NOTIFICATION_SETTINGS_TOOL_DECLARATION,
  GUIDE_TELEGRAM_SETTINGS_TOOL_DECLARATION,
  GUIDE_CREATE_BOOKING_TOOL_DECLARATION,
  GUIDE_IMPORT_BOOKINGS_TOOL_DECLARATION,
  GET_PROPERTY_ANALYTICS_TOOL_DECLARATION,
  EXPLAIN_ANALYTICS_METRIC_TOOL_DECLARATION,
];
