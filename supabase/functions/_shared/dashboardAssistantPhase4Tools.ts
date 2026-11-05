/**
 * AI assistant Phase 4 tools: support tickets, host announcements, org plan snapshot,
 * and inbox send attachment resolution.
 */

import { downloadAssistantAttachment } from './assistantAttachmentApply.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import {
  hostAnnouncementBodyPlainText,
  loadDevelopmentHostAnnouncementsByNames,
  loadPlatformHostAnnouncements,
  mergeLiveHostAnnouncements,
  type HostAnnouncementDto,
} from './hostAnnouncements.ts';
import { uploadAssistantAttachmentsForInbox } from './inboxChatAssetUpload.ts';
import {
  createServiceClient,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';
import { hasOrgPermission } from './orgTeamPermissions.ts';
import {
  checkDashboardAssistantQuota,
  getDashboardAssistantOrgSettings,
} from './dashboardAssistantSettings.ts';
import { getActiveOrgSubscription, resolveOrgEntitlements } from './planEntitlements.ts';
import type { PlanFeatures } from './planFeatures.ts';
import { createSupportTicket, SupportTicketCreateError } from './supportTicketCreate.ts';
import { resolveSupportTicketScope } from './supportTicketScope.ts';
import { uploadSupportTicketAttachmentFromBytes } from './supportTicketAttachments.ts';

export type Phase4ToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type Phase4ToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: ActionRiskTier;
  proposed?: boolean;
};

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function parseAssistantAttachmentPaths(args: Record<string, unknown>): string[] {
  const paths: string[] = [];
  const single = str(args, 'attachmentPath');
  if (single) paths.push(single);
  const multi = args.attachmentPaths;
  if (Array.isArray(multi)) {
    for (const item of multi) {
      if (typeof item === 'string' && item.trim()) paths.push(item.trim());
    }
  }
  return [...new Set(paths)].slice(0, 3);
}

function requireAssistantConversationId(ctx: Phase4ToolContext): string {
  const id = ctx.conversationId?.trim();
  if (!id) throw new Error('Conversation is required to apply attachments');
  return id;
}

function supportScopeInput(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): {
  orgId: string;
  propertyId?: string;
  parkingId?: string;
} {
  return {
    orgId: ctx.organizationId,
    propertyId: str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? undefined,
    parkingId: str(args, 'parkingId') ?? undefined,
  };
}

function ticketHostLabel(ticket: { subject?: string | null; status?: string | null }): string {
  const subject = String(ticket.subject ?? 'Ticket').trim();
  const status = String(ticket.status ?? 'open').replace(/_/g, ' ');
  return `${subject} · ${status}`;
}

function announcementHostLabel(row: HostAnnouncementDto): string {
  const scope =
    row.scope === 'development' && row.developmentName ? row.developmentName : 'Platform';
  return `${row.title} · ${scope}`;
}

const HOST_VISIBLE_PLAN_FEATURES: Array<keyof PlanFeatures> = [
  'automatedBookingFlow',
  'verifiedBadgeEligible',
  'recommendedBadgeEligible',
  'telegramNotifications',
  'searchVisibilityTier',
  'marketingPublishLimitPerGroup',
  'aiValidations',
  'aiMonthlyCreditAllowance',
  'marketingStudio',
  'customPages',
  'propertyShowcase',
  'aiDashboardAssistant',
  'aiReceptionist',
  'aiMarketingGeneration',
  'aiChatAutoReply',
  'financeReporting',
  'maintenanceReporting',
  'metaChatChannel',
  'quickReplies',
  'customTemplates',
  'publicPagesAutosave',
  'bookingImport',
  'calendarSync',
  'customRoles',
];

async function resolveResidenceNamesForAnnouncements(
  orgId: string,
  propertyId: string | null,
  parkingId: string | null
): Promise<string[]> {
  const sb = createServiceClient();

  if (propertyId) {
    const { data } = await sb
      .from('properties')
      .select('residence_name')
      .eq('id', propertyId)
      .eq('organization_id', orgId)
      .maybeSingle();
    const name = typeof data?.residence_name === 'string' ? data.residence_name.trim() : '';
    return name ? [name] : [];
  }

  if (parkingId) {
    const { data } = await sb
      .from('parkings')
      .select('residence_name')
      .eq('id', parkingId)
      .eq('organization_id', orgId)
      .maybeSingle();
    const name = typeof data?.residence_name === 'string' ? data.residence_name.trim() : '';
    return name ? [name] : [];
  }

  const [{ data: properties }, { data: parkings }] = await Promise.all([
    sb.from('properties').select('residence_name').eq('organization_id', orgId),
    sb.from('parkings').select('residence_name').eq('organization_id', orgId),
  ]);

  const names = new Set<string>();
  for (const row of properties ?? []) {
    const name = typeof row.residence_name === 'string' ? row.residence_name.trim() : '';
    if (name) names.add(name);
  }
  for (const row of parkings ?? []) {
    const name = typeof row.residence_name === 'string' ? row.residence_name.trim() : '';
    if (name) names.add(name);
  }
  return [...names];
}

async function loadLiveHostAnnouncements(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): Promise<HostAnnouncementDto[]> {
  const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
  const parkingId = str(args, 'parkingId') ?? null;

  if (propertyId) {
    const access = await verifyPropertyAccess(ctx.req, propertyId);
    if (!access.planLimited && !access.permissions.includes('bookings:view')) {
      throw new Error('Access restricted');
    }
  } else if (parkingId) {
    await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:view');
  } else {
    const access = await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
    if (!access.planLimited && !hasOrgPermission(access.permissions, 'org.dashboard:view')) {
      throw new Error('Access restricted');
    }
  }

  const sb = createServiceClient();
  const [platform, residenceNames] = await Promise.all([
    loadPlatformHostAnnouncements(sb),
    resolveResidenceNamesForAnnouncements(ctx.organizationId, propertyId, parkingId),
  ]);
  const developmentGroups = await loadDevelopmentHostAnnouncementsByNames(sb, residenceNames);
  return mergeLiveHostAnnouncements(platform, developmentGroups);
}

export async function resolveInboxReplyAttachments(
  ctx: Phase4ToolContext,
  inboxConversationId: string,
  paths: string[]
) {
  if (paths.length === 0) return [];
  return uploadAssistantAttachmentsForInbox({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    assistantConversationId: requireAssistantConversationId(ctx),
    inboxConversationId,
    paths,
  });
}

export async function toolListSupportTickets(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): Promise<Phase4ToolResult> {
  const scope = await resolveSupportTicketScope(ctx.req, supportScopeInput(ctx, args));
  const sb = createServiceClient();
  let query = sb
    .from('support_tickets')
    .select('id, subject, status, category, updated_at, created_at')
    .eq('submitted_by_user_id', scope.user.id)
    .eq('channel', 'host')
    .order('updated_at', { ascending: false })
    .limit(40);

  if (scope.org) {
    query = query.eq('organization_id', scope.org.id);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      ticketId: row.id,
      hostLabel: ticketHostLabel(row),
      subject: row.subject,
      status: row.status,
      category: row.category,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    })),
  };
}

export async function toolGetSupportTicket(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): Promise<Phase4ToolResult> {
  const ticketId = str(args, 'ticketId');
  if (!ticketId) return { ok: false, error: 'ticketId is required' };

  const scope = await resolveSupportTicketScope(ctx.req, supportScopeInput(ctx, args));
  const sb = createServiceClient();
  let ticketQuery = sb
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('submitted_by_user_id', scope.user.id)
    .eq('channel', 'host');
  if (scope.org) ticketQuery = ticketQuery.eq('organization_id', scope.org.id);

  const { data: ticket, error: ticketError } = await ticketQuery.maybeSingle();
  if (ticketError) return { ok: false, error: ticketError.message };
  if (!ticket) return { ok: false, error: 'Ticket not found' };

  const { data: messages, error: messagesError } = await sb
    .from('support_ticket_messages')
    .select('id, sender_type, sender_name, body, attachments, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (messagesError) return { ok: false, error: messagesError.message };

  return {
    ok: true,
    data: {
      ticketId: ticket.id,
      hostLabel: ticketHostLabel(ticket),
      subject: ticket.subject,
      status: ticket.status,
      category: ticket.category,
      categoryFields: ticket.category_fields,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      messages: (messages ?? []).map((m) => ({
        senderType: m.sender_type,
        senderName: m.sender_name,
        body: m.body,
        attachmentCount: Array.isArray(m.attachments) ? m.attachments.length : 0,
        createdAt: m.created_at,
      })),
    },
  };
}

export async function toolProposeCreateSupportTicket(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): Promise<Phase4ToolResult> {
  const category = str(args, 'category');
  const subject = str(args, 'subject');
  const description = str(args, 'description');
  if (!category || !subject || !description) {
    return { ok: false, error: 'category, subject, and description are required' };
  }

  const scope = await resolveSupportTicketScope(ctx.req, supportScopeInput(ctx, args));
  const attachmentPaths = parseAssistantAttachmentPaths(args);
  if (attachmentPaths.length > 0) {
    requireAssistantConversationId(ctx);
  }

  const tier = classifyActionRisk({
    toolName: 'propose_create_support_ticket',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: ctx.isBulk,
  });

  const attachmentNote =
    attachmentPaths.length > 0 ? ` with ${attachmentPaths.length} attachment(s)` : '';

  return {
    ok: true,
    proposed: true,
    riskTier: tier,
    data: {
      category,
      subject,
      description,
      severity: str(args, 'severity'),
      pageUrl: str(args, 'pageUrl'),
      browserInfo: str(args, 'browserInfo'),
      expectedBenefit: str(args, 'expectedBenefit'),
      contactPreference: str(args, 'contactPreference'),
      propertyId: scope.propertyId,
      parkingId: scope.parkingId,
      attachmentPaths,
      summary: `Create support ticket: "${subject.length > 60 ? `${subject.slice(0, 60)}…` : subject}"${attachmentNote}`,
    },
  };
}

export async function executeCreateSupportTicket(
  ctx: Phase4ToolContext,
  inputPayload: Record<string, unknown>
): Promise<Phase4ToolResult> {
  const category = str(inputPayload, 'category');
  const subject = str(inputPayload, 'subject');
  const description = str(inputPayload, 'description');
  if (!category || !subject || !description) {
    return { ok: false, error: 'Malformed proposal payload' };
  }

  await assertActionSafeToExecute({
    toolName: 'propose_create_support_ticket',
    pageContext: ctx.pageContext,
    attachedContext: ctx.attachedContext,
    isBulk: false,
    expectedTier: 'tier2_confirmed',
  });

  const scope = await resolveSupportTicketScope(ctx.req, {
    orgId: ctx.organizationId,
    propertyId: str(inputPayload, 'propertyId') ?? undefined,
    parkingId: str(inputPayload, 'parkingId') ?? undefined,
  });

  const attachmentPaths = Array.isArray(inputPayload.attachmentPaths)
    ? (inputPayload.attachmentPaths as unknown[])
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .slice(0, 3)
    : [];

  const attachments = [];
  if (attachmentPaths.length > 0) {
    const assistantConversationId = requireAssistantConversationId(ctx);
    for (const path of attachmentPaths) {
      const resolved = await downloadAssistantAttachment({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        conversationId: assistantConversationId,
        path,
      });
      attachments.push(
        await uploadSupportTicketAttachmentFromBytes(scope, {
          bytes: resolved.bytes,
          mimeType: resolved.mimeType,
          fileName: path.split('/').pop(),
        })
      );
    }
  }

  try {
    const { ticket, message } = await createSupportTicket(scope, {
      category,
      subject,
      description,
      severity: str(inputPayload, 'severity'),
      pageUrl: str(inputPayload, 'pageUrl'),
      browserInfo: str(inputPayload, 'browserInfo'),
      expectedBenefit: str(inputPayload, 'expectedBenefit'),
      contactPreference: str(inputPayload, 'contactPreference'),
      attachments,
    });
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      data: {
        ticketId: ticket.id,
        hostLabel: ticketHostLabel(ticket as { subject?: string; status?: string }),
        subject: ticket.subject,
        status: ticket.status,
        messageId: message.id,
      },
    };
  } catch (err) {
    if (err instanceof SupportTicketCreateError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

export async function toolListHostAnnouncements(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): Promise<Phase4ToolResult> {
  try {
    const announcements = await loadLiveHostAnnouncements(ctx, args);
    return {
      ok: true,
      data: announcements.map((row) => ({
        announcementId: row.id,
        hostLabel: announcementHostLabel(row),
        title: row.title,
        body: hostAnnouncementBodyPlainText(row.body),
        severity: row.severity,
        scope: row.scope,
        developmentName: row.developmentName,
        linkUrl: row.linkUrl,
        linkLabel: row.linkLabel,
        updatedAt: row.updatedAt,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function toolGetHostAnnouncement(
  ctx: Phase4ToolContext,
  args: Record<string, unknown>
): Promise<Phase4ToolResult> {
  const announcementId = str(args, 'announcementId');
  if (!announcementId) return { ok: false, error: 'announcementId is required' };

  try {
    const announcements = await loadLiveHostAnnouncements(ctx, args);
    const row = announcements.find((a) => a.id === announcementId);
    if (!row) return { ok: false, error: 'Announcement not found or no longer active' };
    return {
      ok: true,
      data: {
        announcementId: row.id,
        hostLabel: announcementHostLabel(row),
        title: row.title,
        body: hostAnnouncementBodyPlainText(row.body),
        severity: row.severity,
        scope: row.scope,
        developmentName: row.developmentName,
        linkUrl: row.linkUrl,
        linkLabel: row.linkLabel,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        updatedAt: row.updatedAt,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function toolGetOrgPlanSnapshot(ctx: Phase4ToolContext): Promise<Phase4ToolResult> {
  const access = await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
  if (!access.planLimited && !hasOrgPermission(access.permissions, 'org.plans:view')) {
    return { ok: false, error: 'Access restricted for this action.' };
  }

  const subscription = await getActiveOrgSubscription(ctx.organizationId);
  const entitlements = await resolveOrgEntitlements(ctx.organizationId);
  const orgSettings = await getDashboardAssistantOrgSettings(ctx.organizationId);
  const quota = await checkDashboardAssistantQuota(ctx.organizationId, orgSettings);

  const sb = createServiceClient();
  const { data: properties } = await sb
    .from('properties')
    .select('id, name, status')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: true });

  let assignedPropertyIds: string[] = [];
  if (subscription) {
    const { data: slots } = await sb
      .from('org_subscription_properties')
      .select('property_id')
      .eq('org_subscription_id', subscription.id);
    assignedPropertyIds = (slots ?? []).map((row) => row.property_id as string);
  }

  const features: Record<string, unknown> = {
    teamManagement: entitlements.teamManagement,
  };
  for (const key of HOST_VISIBLE_PLAN_FEATURES) {
    features[key] = entitlements[key];
  }

  return {
    ok: true,
    data: {
      planCode: entitlements.planCode,
      planName: entitlements.planName,
      status: entitlements.status,
      pricingModel: entitlements.pricingModel,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      assignedPropertyCount: assignedPropertyIds.length,
      assignedPropertyIds,
      properties: (properties ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        enrolled: assignedPropertyIds.includes(row.id as string),
      })),
      features,
      assistantQuota: {
        messagesUsedToday: quota.messageCountToday,
        dailyMessageLimit: quota.dailyMessageLimit,
        messagesRemainingToday: Math.max(0, quota.dailyMessageLimit - quota.messageCountToday),
      },
      note: 'Checkout, payment-method changes, and downgrades still require the Plans & Billing page.',
    },
  };
}

export const LIST_SUPPORT_TICKETS_TOOL_DECLARATION = {
  name: 'list_support_tickets',
  description:
    'List support tickets submitted by the signed-in host for this org (optionally scoped to a property or parking slot).',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
    },
  },
};

export const GET_SUPPORT_TICKET_TOOL_DECLARATION = {
  name: 'get_support_ticket',
  description: 'Fetch one support ticket and its message thread (submitter only).',
  parameters: {
    type: 'object',
    properties: {
      ticketId: { type: 'string' },
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
    },
    required: ['ticketId'],
  },
};

export const PROPOSE_CREATE_SUPPORT_TICKET_TOOL_DECLARATION = {
  name: 'propose_create_support_ticket',
  description:
    'Create a new Help & Support ticket for the platform team. Always requires host confirmation. Optional attachmentPath(s) from this assistant conversation (up to 3).',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['bug_report', 'feature_suggestion', 'general_inquiry', 'business_inquiry'],
      },
      subject: { type: 'string' },
      description: { type: 'string' },
      severity: { type: 'string', enum: ['low', 'medium', 'high'] },
      pageUrl: { type: 'string' },
      browserInfo: { type: 'string' },
      expectedBenefit: { type: 'string' },
      contactPreference: { type: 'string' },
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
      attachmentPath: { type: 'string' },
      attachmentPaths: { type: 'array', items: { type: 'string' } },
    },
    required: ['category', 'subject', 'description'],
  },
};

export const LIST_HOST_ANNOUNCEMENTS_TOOL_DECLARATION = {
  name: 'list_host_announcements',
  description:
    'List active platform and development announcements visible to hosts (same data as the Announcements page).',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
    },
  },
};

export const GET_HOST_ANNOUNCEMENT_TOOL_DECLARATION = {
  name: 'get_host_announcement',
  description: 'Fetch one active host announcement by id.',
  parameters: {
    type: 'object',
    properties: {
      announcementId: { type: 'string' },
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
    },
    required: ['announcementId'],
  },
};

export const GET_ORG_PLAN_SNAPSHOT_TOOL_DECLARATION = {
  name: 'get_org_plan_snapshot',
  description:
    'Read the org subscription plan name, status, enrolled properties, key feature entitlements, and remaining AI assistant messages for today. Does not start checkout or change billing.',
  parameters: { type: 'object', properties: {} },
};
