/**
 * AI assistant — capability parity tools (ai-chat-mode.md Phase 7, waves A–E).
 *
 * Every tool here calls the same shared service and the same RBAC as its dashboard endpoint
 * (parity rule, `.cursor/rules/ai-assistant-parity.mdc`). Tools are declared with
 * `defineReadTool` / `defineWriteTool`; one generic runner handles tiering (propose, defer, run)
 * and the pre-execution safety guard, so a tool only supplies:
 * - `prepare`: validate args + check RBAC, return the frozen payload and host-facing summary
 * - `execute`: re-check RBAC from the payload and perform the write (Confirm or Tier-1 commit)
 *
 * Names, tiers and labels are registered in `dashboardAssistantParityToolNames.ts` (classifier)
 * and `assistantToolLabels.ts`; the parity manifest maps each endpoint to these tools.
 */

import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { activityListingOrFilter, resolveActivityVisibility } from './activityLogVisibility.ts';
import { loadAppSettingsRow, invalidateAppSettingsCache } from './appSettings.ts';
import {
  executeBookingAiReview,
  getBookingAiReviewById,
  hasPriorAiReviewResults,
  prepareBookingAiReviewJob,
  type BookingAiReviewRow,
} from './bookingAiReviewService.ts';
import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import { DatabaseService } from './databaseService.ts';
import {
  addAssistantMemory,
  assertMemoryCapacity,
  normalizeMemoryContent,
} from './dashboardAssistantMemory.ts';
import { createFinanceLineItem } from './financeService.ts';
import { issueGuestFormCompletionToken } from './guestFormCompletion.ts';
import { issueGuestStayGuideAccess } from './guestStayGuide.ts';
import { resolveInboxAccess } from './inboxAccess.ts';
import {
  QUICK_REPLY_BODY_MAX,
  QUICK_REPLY_TITLE_MAX,
  createQuickReplyTemplate,
  deleteQuickReplyTemplate,
  loadQuickReplyTemplate,
  requireQuickRepliesPlan,
  updateQuickReplyTemplate,
} from './inboxQuickReplyTemplates.ts';
import { resolveNotificationsAccess } from './notificationsAccess.ts';
import { markNotificationsRead } from './notificationsMarkRead.ts';
import {
  createServiceClient,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';
import {
  computeOrgPortfolioSummary,
  defaultMonthRange,
  isValidIsoDate,
} from './orgPortfolioSummary.ts';
import {
  createOrgCustomRole,
  deleteOrgCustomRole,
  requireOrgTeamContext,
  updateOrgCustomRole,
} from './orgTeamService.ts';
import {
  mergeParkingAutomationToggles,
  parseParkingAutomationTogglesPatch,
  PARKING_AUTOMATION_TOGGLE_KEYS,
  resolveParkingAutomationToggles,
} from './parkingAutomationToggles.ts';
import { isValidCalendarDateKey } from './parkingBlockedDates.ts';
import { saveParkingPricing } from './parkingPricing.ts';
import { ensureParkingSettings } from './parkingSettingsSeed.ts';
import {
  cancelParkingInvitation,
  createParkingCustomRole,
  createParkingInvitation,
  deleteParkingCustomRole,
  listParkingTeamInvitations,
  listParkingTeamMembers,
  removeParkingTeamMember,
  requireTeamParkingAccess,
  updateParkingCustomRole,
  updateParkingTeamMember,
} from './parkingTeamService.ts';
import {
  requireOrgPropertyFeature,
  requirePropertyFeature,
  resolveListingEntitlementPropertyId,
} from './planEntitlements.ts';
import {
  mergePropertyAutomationToggles,
  parsePropertyAutomationTogglesPatch,
  planBlockedAutomationToggleKeys,
  PROPERTY_AUTOMATION_TOGGLE_KEYS,
  resolvePropertyAutomationToggles,
} from './propertyAutomationToggles.ts';
import {
  resolveOrganizationIdForProperty,
  verifyBookingBelongsToProperty,
} from './propertyScope.ts';
import {
  createPropertyCustomRole,
  deletePropertyCustomRole,
  requireTeamPropertyAccess,
  updatePropertyCustomRole,
} from './propertyTeamService.ts';
import { applyRun, computeSmartPricingForProperty, persistPreviewRun } from './smartPricingRun.ts';
import { resolveSupportTicketScope } from './supportTicketScope.ts';
import { reopenSupportTicket, replyToSupportTicket } from './supportTicketSubmitterActions.ts';
import type { GuestSubmission } from './types.ts';
import { GEMINI_LIVE_VOICES } from './geminiLiveEphemeral.ts';
import {
  getVoiceReceptionistOrgSettings,
  updateVoiceReceptionistOrgSettings,
  validateVoiceReceptionistPatch,
  type VoiceReceptionistOrgSettingsPatch,
  type VoiceReceptionistSettingsPatch,
} from './voiceReceptionistService.ts';

// ─── Framework ───────────────────────────────────────────────────────────────────────────────

/** Structural subset of dashboardAssistantTools.ts#ToolExecutionContext (no import cycle). */
export type ParityToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; parkingId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  deferWritesUntilCommit?: boolean;
  deferredWrites?: Array<{ toolName: string; args: Record<string, unknown> }>;
  conversationId?: string | null;
};

export type ParityToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: ActionRiskTier;
  proposed?: boolean;
  deferred?: boolean;
  auditPropertyId?: string | null;
  auditBookingId?: string | null;
  auditParkingId?: string | null;
  /** Short server-built line shown on an executed confirm card (never model-written). */
  resultNote?: string;
};

type Detail = { label: string; value: string };

type Prepared = {
  /** Frozen payload stored on the pending action and replayed on Confirm. */
  payload: Record<string, unknown>;
  summary: string;
  details?: Detail[];
  target?: { propertyId?: string | null; bookingId?: string | null };
};

type ToolDeclaration = { name: string; description: string; parameters: Record<string, unknown> };

type ReadTool = {
  kind: 'read';
  declaration: ToolDeclaration;
  run: (ctx: ParityToolContext, args: Record<string, unknown>) => Promise<ParityToolResult>;
};

type WriteTool = {
  kind: 'write';
  declaration: ToolDeclaration;
  prepare: (ctx: ParityToolContext, args: Record<string, unknown>) => Promise<Prepared>;
  execute: (ctx: ParityToolContext, payload: Record<string, unknown>) => Promise<ParityToolResult>;
};

export class ParityToolInputError extends Error {}

function fail(message: string): never {
  throw new ParityToolInputError(message);
}

function defineReadTool(declaration: ToolDeclaration, run: ReadTool['run']): ReadTool {
  return { kind: 'read', declaration, run };
}

function defineWriteTool(
  declaration: ToolDeclaration,
  prepare: WriteTool['prepare'],
  execute: WriteTool['execute']
): WriteTool {
  return { kind: 'write', declaration, prepare, execute };
}

function str(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toRefusal(err: unknown): ParityToolResult {
  if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
  if (err instanceof ParityToolInputError) return { ok: false, error: err.message };
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

// ─── Scope helpers ───────────────────────────────────────────────────────────────────────────

function firstAttached(ctx: ParityToolContext, type: AttachedContextItem['type']): string | null {
  return ctx.attachedContext.find((item) => item.type === type)?.id ?? null;
}

async function resolvePropertyInOrg(
  ctx: ParityToolContext,
  args: Record<string, unknown>
): Promise<string> {
  const propertyId =
    str(args, 'propertyId') ?? firstAttached(ctx, 'property') ?? ctx.pageContext.propertyId ?? null;
  if (!propertyId) fail('Which property? No property is in scope.');
  if ((await resolveOrganizationIdForProperty(propertyId)) !== ctx.organizationId) {
    fail('Property is outside this organization');
  }
  return propertyId;
}

async function resolveParkingInOrg(
  ctx: ParityToolContext,
  args: Record<string, unknown>
): Promise<{ id: string; name: string }> {
  const parkingId = str(args, 'parkingId') ?? ctx.pageContext.parkingId ?? null;
  if (!parkingId) fail('Which parking listing? None is in scope.');
  const { data } = await createServiceClient()
    .from('parkings')
    .select('id, name, organization_id')
    .eq('id', parkingId)
    .maybeSingle();
  if (!data || data.organization_id !== ctx.organizationId) {
    fail('Parking listing is outside this organization');
  }
  return { id: data.id as string, name: (data.name as string) ?? 'Parking' };
}

async function resolvePropertyBooking(
  ctx: ParityToolContext,
  args: Record<string, unknown>,
  permission: Parameters<typeof verifyPropertyAccess>[2]
): Promise<{ propertyId: string; booking: GuestSubmission }> {
  const bookingId =
    str(args, 'bookingId') ?? firstAttached(ctx, 'booking') ?? ctx.pageContext.bookingId ?? null;
  if (!bookingId) fail('Which booking? No booking is in scope.');
  const booking = (await DatabaseService.getBookingById(bookingId)) as GuestSubmission | null;
  const propertyId = (booking as { property_id?: string | null } | null)?.property_id ?? null;
  if (!booking || !propertyId) fail('Booking not found');
  if ((await resolveOrganizationIdForProperty(propertyId)) !== ctx.organizationId) {
    fail('Booking is outside this organization');
  }
  await verifyPropertyAccess(ctx.req, propertyId, permission);
  await verifyBookingBelongsToProperty(bookingId, propertyId);
  return { propertyId, booking };
}

function guestLabel(booking: GuestSubmission): string {
  const record = booking as unknown as Record<string, unknown>;
  const name = [record.guest_facebook_name, record.primary_guest_name].find(
    (value) => typeof value === 'string' && value.trim()
  ) as string | undefined;
  return name?.trim() || 'this booking';
}

// ─── Wave A — parking team ────────────────────────────────────────────────────────────────────

const listParkingTeam = defineReadTool(
  {
    name: 'list_parking_team',
    description:
      'List a parking listing’s team members and pending invitations (name, role, status). Use before inviting, changing a role or removing someone.',
    parameters: { type: 'object', properties: { parkingId: { type: 'string' } } },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const teamCtx = await requireTeamParkingAccess(ctx.req, parking.id, 'team:view');
    const [members, invitations] = await Promise.all([
      listParkingTeamMembers(teamCtx),
      listParkingTeamInvitations(parking.id),
    ]);
    return {
      ok: true,
      riskTier: 'tier0_read',
      auditParkingId: parking.id,
      data: {
        parking: parking.name,
        members: members.map((member) => ({
          memberId: member.id,
          name: member.displayName || member.name,
          email: member.email,
          role: member.role,
          status: member.status,
        })),
        invitations: invitations
          .filter((invite) => invite.status === 'pending')
          .map((invite) => ({
            invitationId: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt,
          })),
      },
    };
  }
);

const inviteParkingTeamMember = defineWriteTool(
  {
    name: 'propose_invite_parking_team_member',
    description:
      'Invite someone to a parking listing’s team. roleId is MANAGER, STAFF, VIEWER or a custom role id. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        email: { type: 'string' },
        roleId: { type: 'string' },
      },
      required: ['email', 'roleId'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const email = str(args, 'email') ?? fail('email is required');
    const roleId = str(args, 'roleId') ?? fail('roleId is required');
    await requireTeamParkingAccess(ctx.req, parking.id, 'team:invite');
    return {
      payload: { parkingId: parking.id, email, roleId },
      summary: `Invite ${email} to ${parking.name} as ${roleId}.`,
      details: [
        { label: 'Parking', value: parking.name },
        { label: 'Email', value: email },
        { label: 'Role', value: roleId },
      ],
    };
  },
  async (ctx, payload) => {
    const parkingId = str(payload, 'parkingId') ?? fail('Malformed proposal payload');
    const teamCtx = await requireTeamParkingAccess(ctx.req, parkingId, 'team:invite');
    const invitation = await createParkingInvitation(teamCtx, {
      email: payload.email,
      roleId: payload.roleId,
    });
    return {
      ok: true,
      auditParkingId: parkingId,
      data: { invitationId: invitation.id, email: invitation.email },
      resultNote: `Invitation sent to ${invitation.email}.`,
    };
  }
);

const updateParkingTeamMemberRole = defineWriteTool(
  {
    name: 'propose_update_parking_team_member',
    description:
      'Change a parking team member’s role (MANAGER, STAFF, VIEWER or a custom role id). Get memberId from list_parking_team. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        memberId: { type: 'string' },
        roleId: { type: 'string' },
      },
      required: ['memberId', 'roleId'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const memberId = str(args, 'memberId') ?? fail('memberId is required');
    const roleId = str(args, 'roleId') ?? fail('roleId is required');
    await requireTeamParkingAccess(ctx.req, parking.id, 'team:manage');
    return {
      payload: { parkingId: parking.id, memberId, roleId },
      summary: `Change this team member's role on ${parking.name} to ${roleId}.`,
      details: [
        { label: 'Parking', value: parking.name },
        { label: 'New role', value: roleId },
      ],
    };
  },
  async (ctx, payload) => {
    const parkingId = str(payload, 'parkingId') ?? fail('Malformed proposal payload');
    const teamCtx = await requireTeamParkingAccess(ctx.req, parkingId, 'team:manage');
    const member = await updateParkingTeamMember(teamCtx, {
      memberId: payload.memberId,
      roleId: payload.roleId,
    });
    return {
      ok: true,
      auditParkingId: parkingId,
      data: { memberId: member.id, role: member.role },
      resultNote: `${member.displayName || member.name} is now ${member.role}.`,
    };
  }
);

const removeParkingTeamMemberTool = defineWriteTool(
  {
    name: 'propose_remove_parking_team_member',
    description:
      'Remove someone from a parking listing’s team. Get memberId from list_parking_team. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: { parkingId: { type: 'string' }, memberId: { type: 'string' } },
      required: ['memberId'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const memberId = str(args, 'memberId') ?? fail('memberId is required');
    await requireTeamParkingAccess(ctx.req, parking.id, 'team:manage');
    return {
      payload: { parkingId: parking.id, memberId },
      summary: `Remove this team member from ${parking.name}.`,
      details: [{ label: 'Parking', value: parking.name }],
    };
  },
  async (ctx, payload) => {
    const parkingId = str(payload, 'parkingId') ?? fail('Malformed proposal payload');
    const memberId = str(payload, 'memberId') ?? fail('Malformed proposal payload');
    const teamCtx = await requireTeamParkingAccess(ctx.req, parkingId, 'team:manage');
    await removeParkingTeamMember(teamCtx, memberId);
    return { ok: true, auditParkingId: parkingId, data: { removed: true }, resultNote: 'Removed.' };
  }
);

const revokeParkingInvitation = defineWriteTool(
  {
    name: 'propose_revoke_parking_invitation',
    description:
      'Cancel a pending parking team invitation. Get invitationId from list_parking_team. Internal and reversible (invite again), so it can run automatically.',
    parameters: {
      type: 'object',
      properties: { parkingId: { type: 'string' }, invitationId: { type: 'string' } },
      required: ['invitationId'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const invitationId = str(args, 'invitationId') ?? fail('invitationId is required');
    await requireTeamParkingAccess(ctx.req, parking.id, 'team:invite');
    return {
      payload: { parkingId: parking.id, invitationId },
      summary: `Cancel this invitation to ${parking.name}.`,
      details: [{ label: 'Parking', value: parking.name }],
    };
  },
  async (ctx, payload) => {
    const parkingId = str(payload, 'parkingId') ?? fail('Malformed proposal payload');
    const invitationId = str(payload, 'invitationId') ?? fail('Malformed proposal payload');
    await requireTeamParkingAccess(ctx.req, parkingId, 'team:invite');
    await cancelParkingInvitation(parkingId, invitationId);
    return {
      ok: true,
      auditParkingId: parkingId,
      data: { cancelled: true },
      resultNote: 'Invitation cancelled.',
    };
  }
);

// ─── Wave A — automation toggles (property + parking), dates, finance ───────────────────────

const PROPERTY_TOGGLE_LABELS: Record<string, string> = {
  emailNewBookingRequest: 'New booking request alert',
  emailGafRequest: 'GAF request email',
  emailBookingAcknowledgement: 'Booking acknowledgement email',
  emailPetRequest: 'Pet request email',
  emailParkingBroadcast: 'Parking request email',
  emailReadyForCheckin: 'Ready for check-in email',
  emailSdRefundCheckout: 'Security deposit refund email',
};
const PARKING_TOGGLE_LABELS: Record<string, string> = {
  emailParkingReservationRequest: 'Parking reservation request email',
  emailParkingGuestConfirmed: 'Parking confirmed email',
  emailParkingNoHostAvailable: 'No host available email',
  autoAcceptTopMatch: 'Auto-accept top match',
};

function toggleDetails(patch: Record<string, boolean>, labels: Record<string, string>): Detail[] {
  return Object.entries(patch).map(([key, on]) => ({
    label: labels[key] ?? key,
    value: on ? 'On' : 'Off',
  }));
}

const getAutomationSettings = defineReadTool(
  {
    name: 'get_automation_settings',
    description:
      'Read the automatic email switches for a property (or parkingId for a parking listing): which workflow emails send on their own, and which ones the plan turns off.',
    parameters: {
      type: 'object',
      properties: { propertyId: { type: 'string' }, parkingId: { type: 'string' } },
    },
  },
  async (ctx, args) => {
    if (str(args, 'parkingId') || (!str(args, 'propertyId') && ctx.pageContext.parkingId)) {
      const parking = await resolveParkingInOrg(ctx, args);
      await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:view');
      const toggles = await resolveParkingAutomationToggles(parking.id);
      return {
        ok: true,
        riskTier: 'tier0_read',
        data: {
          parking: parking.name,
          toggles: Object.fromEntries(
            PARKING_AUTOMATION_TOGGLE_KEYS.map((key) => [PARKING_TOGGLE_LABELS[key], toggles[key]])
          ),
        },
      };
    }
    const propertyId = await resolvePropertyInOrg(ctx, args);
    await verifyPropertyAccess(ctx.req, propertyId, 'settings:view');
    const [toggles, planBlocked] = await Promise.all([
      resolvePropertyAutomationToggles(propertyId),
      planBlockedAutomationToggleKeys(propertyId),
    ]);
    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        toggles: Object.fromEntries(
          PROPERTY_AUTOMATION_TOGGLE_KEYS.map((key) => [PROPERTY_TOGGLE_LABELS[key], toggles[key]])
        ),
        offBecauseOfPlan: planBlocked.map((key) => PROPERTY_TOGGLE_LABELS[key]),
      },
    };
  }
);

const updateAutomationToggles = defineWriteTool(
  {
    name: 'propose_update_automation_toggles',
    description: `Turn automatic workflow emails on or off for a property (toggles keys: ${PROPERTY_AUTOMATION_TOGGLE_KEYS.join(', ')}) or, with parkingId, a parking listing (keys: ${PARKING_AUTOMATION_TOGGLE_KEYS.join(', ')}). Always requires host confirmation.`,
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
        toggles: {
          type: 'object',
          description: 'Map of toggle key to true (on) or false (off).',
          properties: Object.fromEntries(
            [...PROPERTY_AUTOMATION_TOGGLE_KEYS, ...PARKING_AUTOMATION_TOGGLE_KEYS].map((key) => [
              key,
              { type: 'boolean' },
            ])
          ),
        },
      },
      required: ['toggles'],
    },
  },
  async (ctx, args) => {
    const raw = args.toggles;
    if (str(args, 'parkingId') || (!str(args, 'propertyId') && ctx.pageContext.parkingId)) {
      const parking = await resolveParkingInOrg(ctx, args);
      const patch = parseParkingAutomationTogglesPatch(raw) ?? fail('No valid parking toggles');
      await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
      return {
        payload: { scope: 'parking', parkingId: parking.id, toggles: patch },
        summary: `Update automatic emails for ${parking.name}.`,
        details: toggleDetails(patch as Record<string, boolean>, PARKING_TOGGLE_LABELS),
      };
    }
    const propertyId = await resolvePropertyInOrg(ctx, args);
    const patch = parsePropertyAutomationTogglesPatch(raw) ?? fail('No valid property toggles');
    await verifyPropertyAccess(ctx.req, propertyId, 'settings.emailAutomations:edit');
    return {
      payload: { scope: 'property', propertyId, toggles: patch },
      summary: 'Update automatic emails for this property.',
      details: toggleDetails(patch as Record<string, boolean>, PROPERTY_TOGGLE_LABELS),
      target: { propertyId },
    };
  },
  async (ctx, payload) => {
    if (payload.scope === 'parking') {
      const parkingId = str(payload, 'parkingId') ?? fail('Malformed proposal payload');
      const parking = await resolveParkingInOrg(ctx, { parkingId });
      await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
      const patch = parseParkingAutomationTogglesPatch(payload.toggles) ?? fail('No toggles');
      await ensureParkingSettings(parking.id);
      const sb = createServiceClient();
      const { data: existing } = await sb
        .from('parking_settings')
        .select('automation_toggles')
        .eq('parking_id', parking.id)
        .maybeSingle();
      const merged = { ...mergeParkingAutomationToggles(existing?.automation_toggles), ...patch };
      const { error } = await sb
        .from('parking_settings')
        .update({ automation_toggles: merged, updated_at: new Date().toISOString() })
        .eq('parking_id', parking.id);
      if (error) throw new Error('Failed to update parking settings');
      return {
        ok: true,
        auditParkingId: parking.id,
        data: { toggles: merged },
        resultNote: 'Saved.',
      };
    }
    const propertyId = str(payload, 'propertyId') ?? fail('Malformed proposal payload');
    await verifyPropertyAccess(ctx.req, propertyId, 'settings.emailAutomations:edit');
    const patch = parsePropertyAutomationTogglesPatch(payload.toggles) ?? fail('No toggles');
    const merged = {
      ...mergePropertyAutomationToggles((await loadAppSettingsRow(propertyId))?.automation_toggles),
      ...patch,
    };
    await DatabaseService.updateAppSettings({ automation_toggles: merged }, propertyId);
    invalidateAppSettingsCache(propertyId);
    const planBlocked = await planBlockedAutomationToggleKeys(propertyId);
    const blockedOn = planBlocked.filter((key) => merged[key]);
    return {
      ok: true,
      auditPropertyId: propertyId,
      data: { toggles: merged },
      resultNote:
        blockedOn.length > 0
          ? `Saved. ${blockedOn.length} of these stay off until the plan includes automated emails.`
          : 'Saved.',
    };
  }
);

const MAX_BLOCK_DAYS = 62;

/** Service ranges are [start, end) — the tool's inclusive last night + 1 day. */
function nextDay(dateKey: string): string {
  const next = new Date(`${dateKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return (
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
  );
}

const blockParkingDates = defineWriteTool(
  {
    name: 'propose_block_parking_dates',
    description:
      'Block nights on a parking listing so they cannot be booked (max 62 nights). startDate and endDate are the first and last blocked night, inclusive, as YYYY-MM-DD. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const startDate = str(args, 'startDate') ?? fail('startDate is required');
    const endDate = str(args, 'endDate') ?? fail('endDate is required');
    if (
      !isValidCalendarDateKey(startDate) ||
      !isValidCalendarDateKey(endDate) ||
      startDate > endDate
    ) {
      fail('startDate and endDate must be valid YYYY-MM-DD dates in order');
    }
    if (daysBetween(startDate, endDate) > MAX_BLOCK_DAYS)
      fail(`Block at most ${MAX_BLOCK_DAYS} days at a time`);
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
    const note = str(args, 'note')?.slice(0, 200) ?? null;
    return {
      payload: { parkingId: parking.id, startDate, endDate, note },
      summary:
        startDate === endDate
          ? `Block ${parking.name} on ${startDate}.`
          : `Block ${parking.name} from ${startDate} to ${endDate}.`,
      details: [
        { label: 'Parking', value: parking.name },
        { label: 'First night', value: startDate },
        { label: 'Last night', value: endDate },
        ...(note ? [{ label: 'Note', value: note }] : []),
      ],
    };
  },
  async (ctx, payload) => {
    const parking = await resolveParkingInOrg(ctx, payload);
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
    await saveParkingPricing(
      parking.id,
      {
        blockRange: {
          startDate: String(payload.startDate),
          endDate: nextDay(String(payload.endDate)),
          note: typeof payload.note === 'string' ? payload.note : undefined,
        },
      },
      { userId: ctx.userId }
    );
    return {
      ok: true,
      auditParkingId: parking.id,
      data: { blocked: true },
      resultNote: 'Dates blocked.',
    };
  }
);

const unblockParkingDates = defineWriteTool(
  {
    name: 'propose_unblock_parking_dates',
    description:
      'Unblock specific dates on a parking listing (list of YYYY-MM-DD, max 62). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        dates: { type: 'array', items: { type: 'string' } },
      },
      required: ['dates'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const dates = Array.isArray(args.dates)
      ? [
          ...new Set(
            args.dates.filter((d): d is string => typeof d === 'string').map((d) => d.trim())
          ),
        ]
      : [];
    if (dates.length === 0 || dates.some((d) => !isValidCalendarDateKey(d))) {
      fail('dates must be a list of YYYY-MM-DD dates');
    }
    if (dates.length > MAX_BLOCK_DAYS) fail(`Unblock at most ${MAX_BLOCK_DAYS} dates at a time`);
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
    dates.sort();
    return {
      payload: { parkingId: parking.id, dates },
      summary: `Unblock ${dates.length} ${dates.length === 1 ? 'date' : 'dates'} on ${parking.name}.`,
      details: [
        { label: 'Parking', value: parking.name },
        {
          label: 'Dates',
          value:
            dates.length <= 5
              ? dates.join(', ')
              : `${dates[0]} to ${dates[dates.length - 1]} (${dates.length})`,
        },
      ],
    };
  },
  async (ctx, payload) => {
    const parking = await resolveParkingInOrg(ctx, payload);
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:manage');
    const dates = (payload.dates as unknown[]).filter(
      (d): d is string => typeof d === 'string' && isValidCalendarDateKey(d)
    );
    await saveParkingPricing(parking.id, { unblockDateKeys: dates }, { userId: ctx.userId });
    return {
      ok: true,
      auditParkingId: parking.id,
      data: { unblocked: dates.length },
      resultNote: `${dates.length} ${dates.length === 1 ? 'date' : 'dates'} unblocked.`,
    };
  }
);

const addParkingFinanceLineItem = defineWriteTool(
  {
    name: 'propose_add_parking_finance_line_item',
    description:
      'Log an expense or income entry for a parking listing (e.g. "log a 500 cleaning expense for the parking today"). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        parkingId: { type: 'string' },
        kind: { type: 'string', enum: ['expense', 'income'] },
        label: { type: 'string' },
        category: { type: 'string' },
        amount: { type: 'number' },
        occurredOn: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['kind', 'label', 'category', 'amount', 'occurredOn'],
    },
  },
  async (ctx, args) => {
    const parking = await resolveParkingInOrg(ctx, args);
    const kind =
      args.kind === 'expense' || args.kind === 'income'
        ? args.kind
        : fail('kind must be expense or income');
    const label = str(args, 'label') ?? fail('label is required');
    const category = str(args, 'category') ?? fail('category is required');
    const amount = Number(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) fail('amount must be greater than 0');
    const occurredOn = str(args, 'occurredOn') ?? fail('occurredOn is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) fail('occurredOn must be YYYY-MM-DD');
    await verifyParkingTeamAccess(ctx.req, parking.id, 'finance:edit');
    return {
      payload: { parkingId: parking.id, kind, label, category, amount, occurredOn },
      summary: `Log a ${kind} of ${amount} for ${parking.name}: ${label}.`,
      details: [
        { label: 'Parking', value: parking.name },
        { label: 'Type', value: kind === 'expense' ? 'Expense' : 'Income' },
        { label: 'Label', value: label },
        { label: 'Category', value: category },
        { label: 'Amount', value: `₱${amount.toLocaleString('en-PH')}` },
        { label: 'Date', value: occurredOn },
      ],
    };
  },
  async (ctx, payload) => {
    const parkingId = str(payload, 'parkingId') ?? fail('Malformed proposal payload');
    await verifyParkingTeamAccess(ctx.req, parkingId, 'finance:edit');
    const result = await createFinanceLineItem(
      {
        parkingId,
        kind: payload.kind as 'expense' | 'income',
        label: String(payload.label),
        amount: Number(payload.amount),
        category: String(payload.category),
        occurred_on: String(payload.occurredOn),
      },
      ctx.userEmail
    );
    return {
      ok: true,
      auditParkingId: parkingId,
      data: { lineItemId: result.row.id },
      resultNote: 'Logged.',
    };
  }
);

// ─── Wave A — org analytics + activity log (reads) ───────────────────────────────────────────

const getOrgPortfolioAnalytics = defineReadTool(
  {
    name: 'get_org_portfolio_analytics',
    description:
      'Portfolio analytics across every property and parking listing in the org for a period (default this month): revenue, occupancy, reservations, change vs the previous period, and per-listing rows. Dates are YYYY-MM-DD.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
    },
  },
  async (ctx, args) => {
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.analytics:view');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const range = defaultMonthRange(today);
    const from = isValidIsoDate(str(args, 'from')) ? (str(args, 'from') as string) : range.from;
    const to = isValidIsoDate(str(args, 'to')) ? (str(args, 'to') as string) : range.to;
    if (from > to) fail('from must be on or before to');
    const summary = await computeOrgPortfolioSummary(ctx.organizationId, from, to);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        period: summary.period,
        portfolio: summary.portfolio,
        listings: summary.rows.slice(0, 25).map((row) => ({
          kind: row.kind,
          name: row.name,
          occupancyRatePct: row.occupancyRate,
          adr: row.adr,
          grossRevenue: row.grossRevenue,
          reservations: row.reservations,
          revenueChangePct: row.revenueChangePct,
          unpaidBalanceUpcomingTotal: row.unpaidBalanceUpcomingTotal,
        })),
      },
    };
  }
);

const ACTIVITY_CATEGORIES = [
  'booking',
  'finance',
  'maintenance',
  'pricing',
  'team',
  'settings',
  'inbox',
  'marketing',
  'integrations',
  'ai',
  'org',
  'plans',
] as const;

const listActivityLog = defineReadTool(
  {
    name: 'list_activity_log',
    description:
      'Recent activity / audit trail ("who changed the rates?", "what happened to this booking?"). Optional filters: propertyId, parkingId, category, search text q, days back (1–90, default 14). Returns at most 20 events, newest first.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
        category: { type: 'string', enum: [...ACTIVITY_CATEGORIES] },
        q: { type: 'string' },
        days: { type: 'number' },
      },
    },
  },
  async (ctx, args) => {
    const { user, org, accessKind, permissions } = await verifyOrgAccess(ctx.req, {
      orgId: ctx.organizationId,
    });
    const visibility = await resolveActivityVisibility({
      userId: user.id,
      orgId: org.id,
      accessKind,
      permissions,
    });
    if (visibility.kind === 'none')
      return { ok: true, riskTier: 'tier0_read', data: { events: [] } };

    const days = Math.min(90, Math.max(1, Math.round(Number(args.days) || 14)));
    let query = createServiceClient()
      .from('activity_log')
      .select(
        'created_at, actor_type, actor_display_name, action, category, severity, target_label, summary, property_id, parking_id'
      )
      .eq('organization_id', org.id)
      .gte('created_at', new Date(Date.now() - days * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    if (visibility.kind === 'listings') {
      query = query.neq('scope', 'org').or(activityListingOrFilter(visibility));
    }
    const propertyId = str(args, 'propertyId');
    if (propertyId && /^[0-9a-f-]{36}$/i.test(propertyId))
      query = query.eq('property_id', propertyId);
    const parkingId = str(args, 'parkingId');
    if (parkingId && /^[0-9a-f-]{36}$/i.test(parkingId)) query = query.eq('parking_id', parkingId);
    const category = str(args, 'category');
    if (category && (ACTIVITY_CATEGORIES as readonly string[]).includes(category)) {
      query = query.eq('category', category);
    }
    const q = str(args, 'q');
    if (q) {
      const pattern = `%${q.slice(0, 60).replace(/[%_,()]/g, ' ')}%`;
      query = query.or(`summary.ilike.${pattern},target_label.ilike.${pattern}`);
    }
    const { data, error } = await query;
    if (error) throw new Error('Failed to load activity');
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        days,
        events: (data ?? []).map((row) => ({
          at: row.created_at,
          who:
            (row.actor_display_name as string | null) ??
            (row.actor_type === 'ai_assistant' ? 'AI assistant' : row.actor_type),
          what: row.summary,
          target: row.target_label,
          category: row.category,
          severity: row.severity,
        })),
      },
    };
  }
);

// ─── Wave B — guest links + booking AI review ───────────────────────────────────────────────

const getGuestLink = defineReadTool(
  {
    name: 'get_guest_link',
    description:
      'Get the guest link for a booking so the host can share it: kind "stay_guide" (check-in instructions, available from Ready for check-in) or "form_completion" (guest form for OTA-synced bookings still pending review). Returns the URL; never sends it.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        kind: { type: 'string', enum: ['stay_guide', 'form_completion'] },
      },
      required: ['kind'],
    },
  },
  async (ctx, args) => {
    const kind =
      args.kind === 'stay_guide' || args.kind === 'form_completion'
        ? args.kind
        : fail('kind is required');
    const { propertyId, booking } = await resolvePropertyBooking(
      ctx,
      args,
      'bookings.detail.workflow:edit'
    );
    const bookingId = (booking as unknown as { id: string }).id;
    if (kind === 'stay_guide') {
      const issued = await issueGuestStayGuideAccess(booking);
      if (!issued) fail('The stay guide link opens once the booking is ready for check-in.');
      return {
        ok: true,
        riskTier: 'tier0_read',
        auditPropertyId: propertyId,
        auditBookingId: bookingId,
        data: { kind, guest: guestLabel(booking), url: issued.url, validUntil: issued.validUntil },
      };
    }
    const issued = await issueGuestFormCompletionToken(booking);
    if (!issued.ok) {
      const reasons: Record<string, string> = {
        not_external: 'This booking did not come from an OTA calendar sync.',
        wrong_status: 'The guest form link is only available while the booking is pending review.',
        link_expired: 'This stay has already ended.',
      };
      fail(reasons[issued.reason] ?? 'The guest form link is not available for this booking.');
    }
    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: { kind, guest: guestLabel(booking), url: issued.url },
    };
  }
);

function summarizeAiReview(row: BookingAiReviewRow | null) {
  if (!row) return { status: 'not_run' };
  const sections = (['stay_details', 'guests', 'parking', 'pets', 'pricing'] as const).map(
    (key) => {
      const result = row[`${key}_result` as const];
      return {
        section: key.replace('_', ' '),
        status: row[`${key}_status` as const],
        summary: result?.summary ?? null,
        flags: (result?.flags ?? [])
          .slice(0, 5)
          .map((flag) =>
            typeof flag === 'object' && flag && 'message' in flag
              ? String((flag as { message: unknown }).message)
              : String(flag)
          ),
      };
    }
  );
  return {
    status: row.job_status,
    flagCount: row.flag_count,
    hasBlockingFlag: row.has_blocking_flag,
    updatedAt: row.updated_at ?? null,
    sections,
  };
}

const getBookingAiReview = defineReadTool(
  {
    name: 'get_booking_ai_review',
    description:
      'Read the latest AI review of a booking (stay details, guests, parking, pets, pricing): per-section summary and flags. Use before suggesting a new review.',
    parameters: { type: 'object', properties: { bookingId: { type: 'string' } } },
  },
  async (ctx, args) => {
    const { propertyId, booking } = await resolvePropertyBooking(ctx, args, 'bookings:view');
    const bookingId = (booking as unknown as { id: string }).id;
    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: {
        guest: guestLabel(booking),
        review: summarizeAiReview(await getBookingAiReviewById(bookingId)),
      },
    };
  }
);

const runBookingAiReview = defineWriteTool(
  {
    name: 'propose_run_booking_ai_review',
    description:
      'Run (or refresh) the AI review of a booking — checks stay details, guests, parking, pets and pricing, uses AI credits. Always requires host confirmation.',
    parameters: { type: 'object', properties: { bookingId: { type: 'string' } } },
  },
  async (ctx, args) => {
    const { propertyId, booking } = await resolvePropertyBooking(
      ctx,
      args,
      'bookings.detail.stay:edit'
    );
    await requirePropertyFeature(propertyId, 'aiValidations');
    const bookingId = (booking as unknown as { id: string }).id;
    return {
      payload: { bookingId, propertyId },
      summary: `Run the AI review for ${guestLabel(booking)}.`,
      details: [{ label: 'Booking', value: guestLabel(booking) }],
      target: { propertyId, bookingId },
    };
  },
  async (ctx, payload) => {
    const { propertyId } = await resolvePropertyBooking(ctx, payload, 'bookings.detail.stay:edit');
    await requirePropertyFeature(propertyId, 'aiValidations');
    const bookingId = String(payload.bookingId);
    const existing = await getBookingAiReviewById(bookingId);
    await prepareBookingAiReviewJob(bookingId, propertyId, ctx.userId, {
      keepPriorResults: hasPriorAiReviewResults(existing),
    });
    const row = await executeBookingAiReview(bookingId, propertyId, ctx.userId, ctx.organizationId);
    return {
      ok: row.job_status !== 'failed',
      error: row.job_status === 'failed' ? 'The AI review did not finish. Try again.' : undefined,
      auditPropertyId: propertyId,
      auditBookingId: bookingId,
      data: summarizeAiReview(row),
      resultNote:
        row.flag_count > 0
          ? `Review done: ${row.flag_count} ${row.flag_count === 1 ? 'flag' : 'flags'} to check.`
          : 'Review done: nothing flagged.',
    };
  }
);

// ─── Wave C — smart pricing ──────────────────────────────────────────────────────────────────

const getSmartPricingPreview = defineReadTool(
  {
    name: 'get_smart_pricing_preview',
    description:
      'Compute Smart Pricing recommendations for a property without applying them. Returns a runId (needed to apply), the next-30-nights totals now vs recommended, and the first changed nights. Pass the runId to propose_apply_smart_pricing to apply.',
    parameters: { type: 'object', properties: { propertyId: { type: 'string' } } },
  },
  async (ctx, args) => {
    const propertyId = await resolvePropertyInOrg(ctx, args);
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.smartPricing:edit');
    await requirePropertyFeature(propertyId, 'smartPricing');
    const comp = await computeSmartPricingForProperty(propertyId);
    // No AI rationale from chat: the numbers are deterministic and the explain pass costs credits.
    const runId = await persistPreviewRun(propertyId, comp, {
      createdBy: ctx.userId,
      ai: null,
      creditsConsumed: 0,
    });
    const diff = comp.results.filter((r) => r.skipped === null);
    const next30 = diff.slice(0, 30).reduce(
      (acc, r) => ({
        nights: acc.nights + 1,
        currentTotal: acc.currentTotal + r.baseRate,
        smartTotal: acc.smartTotal + r.recommendedRate,
      }),
      { nights: 0, currentTotal: 0, smartTotal: 0 }
    );
    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        runId,
        windowStart: comp.windowStart,
        windowEnd: comp.windowEnd,
        next30,
        nightsRaised: diff.filter((r) => r.recommendedRate > r.baseRate).length,
        nightsLowered: diff.filter((r) => r.recommendedRate < r.baseRate).length,
        firstChanges: diff
          .filter((r) => r.recommendedRate !== r.baseRate)
          .slice(0, 10)
          .map((r) => ({ date: r.date, current: r.baseRate, recommended: r.recommendedRate })),
        historyConfidence: comp.historyConfidence,
      },
    };
  }
);

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const applySmartPricing = defineWriteTool(
  {
    name: 'propose_apply_smart_pricing',
    description:
      'Apply a Smart Pricing preview (runId from get_smart_pricing_preview) to the calendar — all recommended nights, or only the given ranges. This is the reviewed preview the Pricing page applies; never invent rates. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        runId: { type: 'string' },
        ranges: {
          type: 'array',
          items: {
            type: 'object',
            properties: { start: { type: 'string' }, end: { type: 'string' } },
            required: ['start', 'end'],
          },
        },
      },
      required: ['runId'],
    },
  },
  async (ctx, args) => {
    const propertyId = await resolvePropertyInOrg(ctx, args);
    const runId = str(args, 'runId') ?? fail('runId is required');
    if (!UUID.test(runId)) fail('runId must come from get_smart_pricing_preview');
    let ranges: Array<{ start: string; end: string }> | undefined;
    if (Array.isArray(args.ranges) && args.ranges.length > 0) {
      ranges = args.ranges.map((raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const start = String(r.start ?? '');
        const end = String(r.end ?? '');
        if (!YMD.test(start) || !YMD.test(end) || start > end)
          fail('each range needs start <= end as YYYY-MM-DD');
        return { start, end };
      });
    }
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.smartPricing:edit');
    await requirePropertyFeature(propertyId, 'smartPricing');
    const { data: run } = await createServiceClient()
      .from('property_smart_pricing_runs')
      .select('id, property_id, payload')
      .eq('id', runId)
      .maybeSingle();
    if (!run || run.property_id !== propertyId)
      fail('That preview was not found. Run a new preview first.');
    const results = (Array.isArray(run.payload) ? run.payload : []) as Array<{
      date: string;
      baseRate: number;
      recommendedRate: number;
      skipped: unknown;
    }>;
    const inRange = results.filter(
      (r) =>
        r.skipped === null &&
        (!ranges || ranges.some((range) => r.date >= range.start && r.date <= range.end))
    );
    const changed = inRange.filter((r) => r.recommendedRate !== r.baseRate);
    const delta = inRange.reduce((sum, r) => sum + (r.recommendedRate - r.baseRate), 0);
    return {
      payload: { propertyId, runId, ranges: ranges ?? null },
      summary: `Apply Smart Pricing to ${inRange.length} nights (${changed.length} change).`,
      details: [
        { label: 'Nights', value: String(inRange.length) },
        { label: 'Rates that change', value: String(changed.length) },
        {
          label: 'Net change',
          value: `${delta >= 0 ? '+' : '−'}₱${Math.abs(Math.round(delta)).toLocaleString('en-PH')}`,
        },
        ...(ranges
          ? [{ label: 'Dates', value: ranges.map((r) => `${r.start} to ${r.end}`).join(', ') }]
          : []),
      ],
      target: { propertyId },
    };
  },
  async (ctx, payload) => {
    const propertyId = str(payload, 'propertyId') ?? fail('Malformed proposal payload');
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.smartPricing:edit');
    await requirePropertyFeature(propertyId, 'smartPricing');
    const ranges = Array.isArray(payload.ranges)
      ? (payload.ranges as Array<{ start: string; end: string }>)
      : undefined;
    const result = await applyRun(propertyId, String(payload.runId), {
      ranges,
      createdBy: ctx.userId,
    });
    return {
      ok: true,
      auditPropertyId: propertyId,
      data: result,
      resultNote:
        result.skippedUnavailable > 0
          ? `Applied to ${result.applied} nights; ${result.skippedUnavailable} were already booked or blocked.`
          : `Applied to ${result.applied} nights.`,
    };
  }
);

// ─── Wave D — voice receptionist, quick replies, custom roles ────────────────────────────────

const getVoiceReceptionist = defineReadTool(
  {
    name: 'get_voice_receptionist_settings',
    description:
      'Read the organization AI voice receptionist settings: on/off, voice, persona text, and properties opted out. Session limits are platform-managed.',
    parameters: { type: 'object', properties: {} },
  },
  async (ctx) => {
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings:view');
    const settings = await getVoiceReceptionistOrgSettings(ctx.organizationId);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        enabled: settings.enabled,
        voiceId: settings.voiceId,
        personaPrompt: settings.personaPrompt,
        disabledPropertyIds: settings.disabledPropertyIds,
        availableVoices: [...GEMINI_LIVE_VOICES],
      },
    };
  }
);

/** Voice config is org-wide; `propertyId` + `enabled` only flips that property's opt-out. */
async function applyVoiceReceptionistProposal(
  ctx: { req: Request; organizationId: string },
  patch: VoiceReceptionistSettingsPatch,
  propertyId: string | null
): Promise<VoiceReceptionistOrgSettingsPatch> {
  await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.settings.aiPlatform:edit');
  if (patch.enabled === true) await requireOrgPropertyFeature(ctx.organizationId, 'aiReceptionist');
  if (!propertyId || patch.enabled === undefined) return patch;
  const current = await getVoiceReceptionistOrgSettings(ctx.organizationId);
  const disabled = new Set(current.disabledPropertyIds);
  if (patch.enabled) disabled.delete(propertyId);
  else disabled.add(propertyId);
  const { enabled: _propertyToggle, ...orgFields } = patch;
  return {
    ...orgFields,
    ...(patch.enabled && !current.enabled ? { enabled: true } : {}),
    disabledPropertyIds: [...disabled],
  };
}

const updateVoiceReceptionist = defineWriteTool(
  {
    name: 'propose_update_voice_receptionist',
    description: `Change the organization AI voice receptionist: enabled (on/off), voiceId (${GEMINI_LIVE_VOICES.join(', ')}), personaPrompt (short tone description, max 300 characters, or null to clear). Pass propertyId with enabled to turn it on or off for one property only. Session limits cannot be changed here. Always requires host confirmation.`,
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        enabled: { type: 'boolean' },
        voiceId: { type: 'string', enum: [...GEMINI_LIVE_VOICES] },
        personaPrompt: { type: 'string' },
      },
    },
  },
  async (ctx, args) => {
    const propertyId =
      typeof args.propertyId === 'string' && args.propertyId
        ? await resolvePropertyInOrg(ctx, args)
        : null;
    const body: Record<string, unknown> = {};
    for (const key of ['enabled', 'voiceId', 'personaPrompt'] as const) {
      if (args[key] !== undefined) body[key] = args[key];
    }
    if (Object.keys(body).length === 0) fail('Nothing to change');
    const { patch, error } = validateVoiceReceptionistPatch(body);
    if (error) fail(error);
    await applyVoiceReceptionistProposal(ctx, patch, propertyId);
    const details: Detail[] = [];
    if (patch.enabled !== undefined)
      details.push({
        label: propertyId ? 'Receptionist (this property)' : 'Receptionist',
        value: patch.enabled ? 'On' : 'Off',
      });
    if (patch.voiceId) details.push({ label: 'Voice', value: patch.voiceId });
    if (patch.personaPrompt !== undefined)
      details.push({ label: 'Persona', value: patch.personaPrompt ?? 'Default' });
    return {
      payload: { propertyId, patch },
      summary: 'Update the AI voice receptionist.',
      details,
      target: propertyId ? { propertyId } : {},
    };
  },
  async (ctx, payload) => {
    const propertyId = str(payload, 'propertyId') ?? null;
    if (propertyId) await resolvePropertyInOrg(ctx, { propertyId });
    const { patch, error } = validateVoiceReceptionistPatch(
      (payload.patch ?? {}) as Record<string, unknown>
    );
    if (error) fail(error);
    const orgPatch = await applyVoiceReceptionistProposal(ctx, patch, propertyId);
    await updateVoiceReceptionistOrgSettings({
      organizationId: ctx.organizationId,
      patch: orgPatch,
      updatedBy: ctx.userId,
    });
    return {
      ok: true,
      ...(propertyId ? { auditPropertyId: propertyId } : {}),
      data: { updated: Object.keys(patch) },
      resultNote: 'Saved.',
    };
  }
);

const manageQuickReplyTemplate = defineWriteTool(
  {
    name: 'propose_manage_quick_reply_template',
    description:
      'Create, edit or delete a Guest Inbox quick reply template for a property (or parkingId). operation: create (title + bodyText), update (templateId + title and/or bodyText), delete (templateId). Get ids from list_inbox_quick_reply_templates. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
        operation: { type: 'string', enum: ['create', 'update', 'delete'] },
        templateId: { type: 'string' },
        title: { type: 'string' },
        bodyText: { type: 'string' },
      },
      required: ['operation'],
    },
  },
  async (ctx, args) => {
    const operation = args.operation;
    if (operation !== 'create' && operation !== 'update' && operation !== 'delete')
      fail('operation is required');
    const scopeBody =
      str(args, 'parkingId') || (!str(args, 'propertyId') && ctx.pageContext.parkingId)
        ? { parkingId: (await resolveParkingInOrg(ctx, args)).id }
        : { propertyId: await resolvePropertyInOrg(ctx, args) };
    const capability =
      operation === 'create'
        ? 'quick_replies_add'
        : operation === 'update'
          ? 'quick_replies_edit'
          : 'quick_replies_delete';
    const inbox = await resolveInboxAccess(ctx.req, capability, scopeBody);
    if (operation !== 'delete') await requireQuickRepliesPlan(inbox);

    const title = str(args, 'title')?.slice(0, QUICK_REPLY_TITLE_MAX) ?? null;
    const bodyText = str(args, 'bodyText')?.slice(0, QUICK_REPLY_BODY_MAX) ?? null;
    if (operation === 'create') {
      if (!title || !bodyText) fail('title and bodyText are required');
      return {
        payload: { ...scopeBody, operation, title, bodyText },
        summary: `Add the quick reply "${title}".`,
        details: [
          { label: 'Title', value: title },
          {
            label: 'Message',
            value: bodyText.length > 160 ? `${bodyText.slice(0, 157)}…` : bodyText,
          },
        ],
      };
    }
    const templateId = str(args, 'templateId') ?? fail('templateId is required');
    const existing =
      (await loadQuickReplyTemplate(inbox, templateId)) ?? fail('Quick reply not found');
    if (operation === 'delete') {
      return {
        payload: { ...scopeBody, operation, templateId },
        summary: `Delete the quick reply "${existing.title}".`,
        details: [{ label: 'Title', value: existing.title }],
      };
    }
    if (!title && !bodyText) fail('Give a new title or bodyText');
    return {
      payload: { ...scopeBody, operation, templateId, title, bodyText },
      summary: `Update the quick reply "${existing.title}".`,
      details: [
        ...(title ? [{ label: 'New title', value: title }] : []),
        ...(bodyText
          ? [
              {
                label: 'New message',
                value: bodyText.length > 160 ? `${bodyText.slice(0, 157)}…` : bodyText,
              },
            ]
          : []),
      ],
    };
  },
  async (ctx, payload) => {
    const operation = String(payload.operation);
    const scopeBody = payload.parkingId
      ? { parkingId: String(payload.parkingId) }
      : { propertyId: String(payload.propertyId) };
    const capability =
      operation === 'create'
        ? 'quick_replies_add'
        : operation === 'update'
          ? 'quick_replies_edit'
          : 'quick_replies_delete';
    const inbox = await resolveInboxAccess(ctx.req, capability, scopeBody);
    if (operation === 'create') {
      await requireQuickRepliesPlan(inbox);
      const template = await createQuickReplyTemplate(inbox, {
        title: String(payload.title),
        bodyText: String(payload.bodyText),
      });
      return {
        ok: true,
        auditPropertyId: inbox.propertyId,
        data: { templateId: template?.id },
        resultNote: 'Quick reply added.',
      };
    }
    const templateId = String(payload.templateId);
    if (!(await loadQuickReplyTemplate(inbox, templateId))) fail('Quick reply not found');
    if (operation === 'delete') {
      await deleteQuickReplyTemplate(inbox, templateId);
      return {
        ok: true,
        auditPropertyId: inbox.propertyId,
        data: { deleted: true },
        resultNote: 'Quick reply deleted.',
      };
    }
    await requireQuickRepliesPlan(inbox);
    const patch: Record<string, unknown> = {};
    if (typeof payload.title === 'string') patch.title = payload.title;
    if (typeof payload.bodyText === 'string') patch.bodyText = payload.bodyText;
    await updateQuickReplyTemplate(inbox, templateId, patch);
    return {
      ok: true,
      auditPropertyId: inbox.propertyId,
      data: { updated: true },
      resultNote: 'Quick reply updated.',
    };
  }
);

const manageCustomRole = defineWriteTool(
  {
    name: 'propose_manage_custom_role',
    description:
      'Create, edit or delete a custom team role. scope: org (org team), property (propertyId) or parking (parkingId). operation: create (name + permissions), update (roleId + name/permissions/description), delete (roleId). permissions are permission ids from the Team page (e.g. bookings:view). Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['org', 'property', 'parking'] },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
        operation: { type: 'string', enum: ['create', 'update', 'delete'] },
        roleId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
      required: ['scope', 'operation'],
    },
  },
  async (ctx, args) => {
    const scope = args.scope;
    const operation = args.operation;
    if (scope !== 'org' && scope !== 'property' && scope !== 'parking') fail('scope is required');
    if (operation !== 'create' && operation !== 'update' && operation !== 'delete')
      fail('operation is required');
    const name = str(args, 'name');
    const description = str(args, 'description');
    const permissions = Array.isArray(args.permissions)
      ? [
          ...new Set(
            args.permissions.filter((p): p is string => typeof p === 'string').map((p) => p.trim())
          ),
        ].slice(0, 200)
      : undefined;
    const roleId = str(args, 'roleId');
    if (operation === 'create' && (!name || !permissions?.length))
      fail('name and permissions are required');
    if (operation !== 'create' && !roleId) fail('roleId is required');

    let where = 'the organization';
    const target: Record<string, unknown> = { scope };
    if (scope === 'org') {
      await verifyOrgAccess(
        ctx.req,
        { orgId: ctx.organizationId },
        operation === 'create'
          ? 'org.team.roles:add'
          : operation === 'update'
            ? 'org.team.roles:edit'
            : 'org.team.roles:delete'
      );
      await requireOrgPropertyFeature(ctx.organizationId, 'customRoles');
    } else if (scope === 'property') {
      const propertyId = await resolvePropertyInOrg(ctx, args);
      await requireTeamPropertyAccess(
        ctx.req,
        propertyId,
        operation === 'create'
          ? 'team.customRoles:add'
          : operation === 'update'
            ? 'team.customRoles:edit'
            : 'team.customRoles:delete'
      );
      await requirePropertyFeature(propertyId, 'customRoles');
      target.propertyId = propertyId;
      where = 'this property';
    } else {
      const parking = await resolveParkingInOrg(ctx, args);
      await requireTeamParkingAccess(ctx.req, parking.id, 'team:manage');
      await requirePropertyFeature(
        await resolveListingEntitlementPropertyId('parking', parking.id),
        'customRoles'
      );
      target.parkingId = parking.id;
      where = parking.name;
    }

    const verb = operation === 'create' ? 'Create' : operation === 'update' ? 'Update' : 'Delete';
    return {
      payload: {
        ...target,
        operation,
        roleId,
        name,
        description,
        permissions: permissions ?? null,
      },
      summary: `${verb} the custom role${name ? ` "${name}"` : ''} for ${where}.`,
      details: [
        ...(name ? [{ label: 'Name', value: name }] : []),
        ...(permissions ? [{ label: 'Permissions', value: `${permissions.length} selected` }] : []),
      ],
    };
  },
  async (ctx, payload) => {
    const operation = String(payload.operation);
    const body: Record<string, unknown> = {};
    if (payload.roleId) body.roleId = payload.roleId;
    if (payload.name) body.name = payload.name;
    if (payload.description) body.description = payload.description;
    if (Array.isArray(payload.permissions)) body.permissions = payload.permissions;
    const roleId = typeof payload.roleId === 'string' ? payload.roleId : '';

    if (payload.scope === 'org') {
      await verifyOrgAccess(
        ctx.req,
        { orgId: ctx.organizationId },
        operation === 'create'
          ? 'org.team.roles:add'
          : operation === 'update'
            ? 'org.team.roles:edit'
            : 'org.team.roles:delete'
      );
      await requireOrgPropertyFeature(ctx.organizationId, 'customRoles');
      const teamCtx = await requireOrgTeamContext(ctx.req, ctx.organizationId, null);
      if (operation === 'create') await createOrgCustomRole(teamCtx, body);
      else if (operation === 'update') await updateOrgCustomRole(teamCtx, body);
      else await deleteOrgCustomRole(teamCtx, roleId);
      return { ok: true, data: { operation }, resultNote: 'Saved.' };
    }
    if (payload.scope === 'property') {
      const propertyId = String(payload.propertyId);
      const teamCtx = await requireTeamPropertyAccess(
        ctx.req,
        propertyId,
        operation === 'create'
          ? 'team.customRoles:add'
          : operation === 'update'
            ? 'team.customRoles:edit'
            : 'team.customRoles:delete'
      );
      await requirePropertyFeature(propertyId, 'customRoles');
      if (operation === 'create') await createPropertyCustomRole(teamCtx, body);
      else if (operation === 'update') await updatePropertyCustomRole(teamCtx, body);
      else await deletePropertyCustomRole(teamCtx, roleId);
      return { ok: true, auditPropertyId: propertyId, data: { operation }, resultNote: 'Saved.' };
    }
    const parkingId = String(payload.parkingId);
    const teamCtx = await requireTeamParkingAccess(ctx.req, parkingId, 'team:manage');
    await requirePropertyFeature(
      await resolveListingEntitlementPropertyId('parking', parkingId),
      'customRoles'
    );
    if (operation === 'create') await createParkingCustomRole(teamCtx, body);
    else if (operation === 'update') await updateParkingCustomRole(teamCtx, body);
    else await deleteParkingCustomRole(teamCtx, roleId);
    return { ok: true, auditParkingId: parkingId, data: { operation }, resultNote: 'Saved.' };
  }
);

// ─── Wave E — guided create, support tickets, notifications ──────────────────────────────────

const guideCreateListing = defineReadTool(
  {
    name: 'guide_create_listing',
    description:
      'How to add a new property or parking listing (kind: property | parking): the checklist and where to start. Creating a listing happens in the guided form on the Properties / Parking page, not in chat. Pair with open_page.',
    parameters: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['property', 'parking'] } },
      required: ['kind'],
    },
  },
  async (ctx, args) => {
    const kind = args.kind === 'parking' ? 'parking' : 'property';
    await verifyOrgAccess(
      ctx.req,
      { orgId: ctx.organizationId },
      kind === 'property' ? 'org.properties:create' : 'org.parkings:create'
    );
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        kind,
        routeKey: kind === 'property' ? 'org.properties' : 'org.parkings',
        action:
          kind === 'property'
            ? 'Click **Add property** on the Properties page.'
            : 'Click **Add parking** on the Parking page.',
        checklist:
          kind === 'property'
            ? [
                'Name and address',
                'Tower and unit (if in a condo)',
                'Nightly rates',
                'Photos',
                'House rules and check-in times',
              ]
            : ['Name and location', 'Slot details', 'Rates', 'Photos'],
      },
    };
  }
);

async function ticketScope(ctx: ParityToolContext, args: Record<string, unknown>) {
  const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
  const parkingId = propertyId
    ? null
    : (str(args, 'parkingId') ?? ctx.pageContext.parkingId ?? null);
  return resolveSupportTicketScope(ctx.req, {
    orgId: ctx.organizationId,
    propertyId,
    parkingId,
  });
}

const replySupportTicket = defineWriteTool(
  {
    name: 'propose_reply_support_ticket',
    description:
      'Send a reply on one of the host’s own support tickets to the platform support team (ticketId from list_support_tickets). Closed tickets must be reopened first. Always requires host confirmation.',
    parameters: {
      type: 'object',
      properties: {
        ticketId: { type: 'string' },
        message: { type: 'string' },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['ticketId', 'message'],
    },
  },
  async (ctx, args) => {
    const ticketId = str(args, 'ticketId') ?? fail('ticketId is required');
    const message = str(args, 'message') ?? fail('message is required');
    if (message.length > 5000) fail('message must be 5000 characters or fewer');
    const scope = await ticketScope(ctx, args);
    const { data: ticket } = await createServiceClient()
      .from('support_tickets')
      .select('id, subject, status, submitted_by_user_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket || ticket.submitted_by_user_id !== scope.user.id) fail('Ticket not found');
    return {
      payload: { ticketId, message, propertyId: scope.propertyId, parkingId: scope.parkingId },
      summary: `Reply to your support ticket "${ticket.subject}".`,
      details: [
        { label: 'Ticket', value: String(ticket.subject) },
        { label: 'Message', value: message.length > 200 ? `${message.slice(0, 197)}…` : message },
      ],
    };
  },
  async (ctx, payload) => {
    const scope = await ticketScope(ctx, payload);
    await replyToSupportTicket(scope, {
      ticketId: String(payload.ticketId),
      message: String(payload.message),
      attachments: [],
    });
    return { ok: true, data: { sent: true }, resultNote: 'Reply sent to support.' };
  }
);

const reopenSupportTicketTool = defineWriteTool(
  {
    name: 'propose_reopen_support_ticket',
    description:
      'Reopen one of the host’s own closed support tickets (ticketId from list_support_tickets). Internal and harmless, so it can run automatically.',
    parameters: {
      type: 'object',
      properties: {
        ticketId: { type: 'string' },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
      required: ['ticketId'],
    },
  },
  async (ctx, args) => {
    const ticketId = str(args, 'ticketId') ?? fail('ticketId is required');
    const scope = await ticketScope(ctx, args);
    return {
      payload: { ticketId, propertyId: scope.propertyId, parkingId: scope.parkingId },
      summary: 'Reopen this support ticket.',
    };
  },
  async (ctx, payload) => {
    const scope = await ticketScope(ctx, payload);
    await reopenSupportTicket(scope, String(payload.ticketId));
    return { ok: true, data: { reopened: true }, resultNote: 'Ticket reopened.' };
  }
);

const markNotificationsReadTool = defineWriteTool(
  {
    name: 'propose_mark_notifications_read',
    description:
      'Mark one notification (notificationId) or all unread notifications in the current scope (markAll: true) as read for the host. Internal, so it can run automatically.',
    parameters: {
      type: 'object',
      properties: {
        notificationId: { type: 'string' },
        markAll: { type: 'boolean' },
        propertyId: { type: 'string' },
        parkingId: { type: 'string' },
      },
    },
  },
  async (ctx, args) => {
    const notificationId = str(args, 'notificationId');
    const markAll = args.markAll === true;
    if (!markAll && !notificationId) fail('notificationId or markAll is required');
    const scopeBody = notificationScopeBody(ctx, args);
    await resolveNotificationsAccess(ctx.req, scopeBody);
    return {
      payload: { ...scopeBody, notificationId: markAll ? null : notificationId, markAll },
      summary: markAll ? 'Mark all notifications as read.' : 'Mark this notification as read.',
    };
  },
  async (ctx, payload) => {
    const scopeBody = notificationScopeBody(ctx, payload);
    const access = await resolveNotificationsAccess(ctx.req, scopeBody);
    if (access.planLimited) return { ok: true, data: { markedCount: 0 } };
    const result = await markNotificationsRead(
      access,
      ctx.userId,
      payload.markAll === true
        ? { markAll: true }
        : { notificationId: String(payload.notificationId) }
    );
    return {
      ok: true,
      data: result,
      resultNote: `${result.markedCount} marked as read.`,
    };
  }
);

function notificationScopeBody(ctx: ParityToolContext, args: Record<string, unknown>) {
  const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
  const parkingId = propertyId
    ? null
    : (str(args, 'parkingId') ?? ctx.pageContext.parkingId ?? null);
  return { orgId: ctx.organizationId, propertyId, parkingId };
}

// ─── Phase 6 — memory ────────────────────────────────────────────────────────────────────────

const rememberPreference = defineWriteTool(
  {
    name: 'remember_preference',
    description:
      'Save a standing preference the host asked you to remember for future chats (e.g. "always show amounts in pesos", "call me Mike", "keep replies short"). Only when the host explicitly asks you to remember something. One short sentence, max 300 characters.',
    parameters: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
    },
  },
  async (ctx, args) => {
    const content = normalizeMemoryContent(args.content);
    // Checked here too so a full list is refused this turn, not after the deferred commit.
    await assertMemoryCapacity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      kind: 'preference',
      content,
    });
    return {
      payload: { content },
      summary: 'Remember this for future chats.',
      details: [{ label: 'Preference', value: content }],
    };
  },
  async (ctx, payload) => {
    const memory = await addAssistantMemory({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      kind: 'preference',
      content: String(payload.content),
    });
    return { ok: true, data: { memoryId: memory.id }, resultNote: 'Saved to memory.' };
  }
);

// ─── Registry ────────────────────────────────────────────────────────────────────────────────

const TOOLS: Array<ReadTool | WriteTool> = [
  listParkingTeam,
  inviteParkingTeamMember,
  updateParkingTeamMemberRole,
  removeParkingTeamMemberTool,
  revokeParkingInvitation,
  getAutomationSettings,
  updateAutomationToggles,
  blockParkingDates,
  unblockParkingDates,
  addParkingFinanceLineItem,
  getOrgPortfolioAnalytics,
  listActivityLog,
  getGuestLink,
  getBookingAiReview,
  runBookingAiReview,
  getSmartPricingPreview,
  applySmartPricing,
  getVoiceReceptionist,
  updateVoiceReceptionist,
  manageQuickReplyTemplate,
  manageCustomRole,
  guideCreateListing,
  replySupportTicket,
  reopenSupportTicketTool,
  markNotificationsReadTool,
  rememberPreference,
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.declaration.name, tool]));

export const PARITY_TOOL_DECLARATIONS = TOOLS.map((tool) => tool.declaration);

export function isParityTool(toolName: string): boolean {
  return BY_NAME.has(toolName);
}

/** Executed Tier 1 receipts show the prepared host rows, never result ids. */
function withReceiptDetails(data: unknown, prepared: Prepared): unknown {
  if (!prepared.details || (data != null && (typeof data !== 'object' || Array.isArray(data)))) {
    return data;
  }
  return { ...(data as Record<string, unknown> | null), displayDetails: prepared.details };
}

/** Tool-loop entry: reads run; writes propose (Tier 2), defer (Tier 1 in a turn) or run. */
export async function runParityTool(
  toolName: string,
  ctx: ParityToolContext,
  args: Record<string, unknown>
): Promise<ParityToolResult> {
  const tool = BY_NAME.get(toolName);
  if (!tool) return { ok: false, error: `Unknown tool: ${toolName}` };
  try {
    if (tool.kind === 'read') return await tool.run(ctx, args);

    const prepared = await tool.prepare(ctx, args);
    const tier = classifyActionRisk({
      toolName,
      targetPropertyId: prepared.target?.propertyId ?? null,
      targetBookingId: prepared.target?.bookingId ?? null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
    });
    const proposal = {
      ...prepared.payload,
      summary: prepared.summary,
      ...(prepared.details ? { displayDetails: prepared.details } : {}),
    };
    if (tier === 'tier2_confirmed') {
      return { ok: true, proposed: true, riskTier: tier, data: proposal };
    }
    if (ctx.deferWritesUntilCommit && ctx.deferredWrites) {
      ctx.deferredWrites.push({ toolName, args });
      return {
        ok: true,
        deferred: true,
        riskTier: tier,
        data: { ...proposal, pendingCommit: true },
      };
    }
    await assertActionSafeToExecute({
      toolName,
      targetPropertyId: prepared.target?.propertyId ?? null,
      targetBookingId: prepared.target?.bookingId ?? null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: ctx.isBulk,
      expectedTier: tier,
    });
    const executed = await tool.execute(ctx, prepared.payload);
    return { ...executed, data: withReceiptDetails(executed.data, prepared), riskTier: tier };
  } catch (err) {
    return toRefusal(err);
  }
}

/** Confirm entry (dashboard-assistant-confirm): re-checks safety, then executes the payload. */
export async function executeParityConfirmedAction(
  toolName: string,
  payload: Record<string, unknown>,
  ctx: ParityToolContext
): Promise<ParityToolResult> {
  const tool = BY_NAME.get(toolName);
  if (!tool || tool.kind !== 'write') return { ok: false, error: `Unknown tool: ${toolName}` };
  try {
    await assertActionSafeToExecute({
      toolName,
      targetPropertyId: typeof payload.propertyId === 'string' ? payload.propertyId : null,
      targetBookingId: typeof payload.bookingId === 'string' ? payload.bookingId : null,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });
    return { ...(await tool.execute(ctx, payload)), riskTier: 'tier2_confirmed' };
  } catch (err) {
    return toRefusal(err);
  }
}
