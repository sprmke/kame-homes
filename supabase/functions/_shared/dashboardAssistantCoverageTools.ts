/**
 * Phase 4 coverage reads for the dashboard assistant: reviews, vouchers, Superhost,
 * setup guide, marketing themes, demographics, notifications, stay guide, custom pages,
 * and help-center search. All Tier 0. activity-log: N/A — reads only.
 */

import { computeAnalyticsBundle } from './analyticsService.ts';
import { getCustomPageTemplateOrDefault } from './customPages.ts';
import { chatTemplateHtmlToPlainText, loadChatTemplate } from './chatTemplateMessage.ts';
import { manilaTodayIso } from './bookingsListSort.ts';
import {
  createServiceClient,
  requirePropertyPermissionAndFeature,
  verifyOrgAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';
import { getPropertyReviewSummary, listReceivedReviews } from './propertyReviewList.ts';
import { resolvePropertySlugById } from './propertyScope.ts';
import { serializePropertyTemplatesForAdmin } from './propertyTemplates.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';
import {
  formatSuperhostCriteria,
  sanitizeHelpQuery,
  type CoverageToolName,
} from './dashboardAssistantCoverageHelpers.ts';
import {
  allSuperhostCriteriaMet,
  loadAndComputeOrgSuperhostCriteria,
  superhostProgressSummary,
} from './superhostMetrics.ts';
import { readOrgSuperhostFromSettings } from './orgSuperhost.ts';

export {
  COVERAGE_READ_TOOL_NAMES,
  formatSuperhostCriteria,
  isCoverageTool,
  sanitizeHelpQuery,
} from './dashboardAssistantCoverageHelpers.ts';
export type { CoverageToolName } from './dashboardAssistantCoverageHelpers.ts';

export type CoverageToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  pageContext: { propertyId?: string | null };
};

export type CoverageToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: 'tier0_read';
};

function str(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function restricted(err: unknown): CoverageToolResult {
  if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

async function requireProperty(
  ctx: CoverageToolContext,
  args: Record<string, unknown>,
  permission: TeamPermissionId
): Promise<string> {
  const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
  if (!propertyId) throw new Error('propertyId is required (no property in scope)');
  await verifyPropertyAccess(ctx.req, propertyId, permission);
  return propertyId;
}

function hostLabel(parts: Array<string | null | undefined>): string {
  return (
    parts
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' · ') || 'Item'
  );
}

const SETUP_STEPS: Array<{ id: string; label: string; routeKey: string }> = [
  { id: 'profile', label: 'Complete property profile', routeKey: 'property.settings' },
  { id: 'photos', label: 'Add at least 5 photos', routeKey: 'property.settings' },
  { id: 'pricing', label: 'Set nightly rates', routeKey: 'property.pricing' },
  { id: 'payment', label: 'Add a payment method', routeKey: 'property.settings' },
  { id: 'templates', label: 'Review email templates', routeKey: 'property.templates' },
  { id: 'meta', label: 'Connect Facebook or Instagram', routeKey: 'property.inbox' },
  { id: 'stay_guide', label: 'Publish the stay guide', routeKey: 'property.public-pages' },
  { id: 'verification', label: 'Verify the organization', routeKey: 'org.settings' },
];

async function toolListGuestReviews(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'reviews:view');
    const page = await listReceivedReviews(propertyId, null);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        items: page.items.map((row) => ({
          id: row.id,
          bookingId: row.bookingId,
          hostLabel: hostLabel([row.guestName, `${row.starRating} stars`]),
          guestName: row.guestName,
          rating: row.starRating,
          excerpt: (row.reviewText ?? '').slice(0, 240),
          responded: Boolean(row.responseText),
          publishedAt: row.publishedAt,
        })),
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetReviewSummary(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'reviews:view');
    const summary = await getPropertyReviewSummary(propertyId);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        count: summary.count,
        average: summary.avgOverall,
        responseRatePct: Math.round(summary.responseRate * 100),
        dueCount: summary.dueCount,
        distribution: summary.distribution,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function loadOrgVouchers(
  organizationId: string,
  propertyId?: string | null
): Promise<Array<Record<string, unknown>>> {
  const sb = createServiceClient();
  let propertyIds: string[] = [];
  if (propertyId) {
    propertyIds = [propertyId];
  } else {
    const { data } = await sb
      .from('properties')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(80);
    propertyIds = (data ?? []).map((row) => row.id as string);
  }
  if (propertyIds.length === 0) return [];
  const { data, error } = await sb
    .from('guest_submissions')
    .select(
      'id, property_id, primary_guest_name, next_stay_voucher_code, next_stay_voucher_amount, next_stay_voucher_awarded_at, next_stay_voucher_redeemed_at'
    )
    .in('property_id', propertyIds)
    .not('next_stay_voucher_code', 'is', null)
    .order('next_stay_voucher_awarded_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('[coverageTools] vouchers failed:', error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const redeemed = Boolean(row.next_stay_voucher_redeemed_at);
    return {
      id: row.id,
      propertyId: row.property_id,
      hostLabel: hostLabel([
        row.primary_guest_name as string | null,
        row.next_stay_voucher_code as string | null,
        redeemed ? 'Redeemed' : 'Open',
      ]),
      guestName: row.primary_guest_name,
      code: row.next_stay_voucher_code,
      amount: row.next_stay_voucher_amount,
      awardedAt: row.next_stay_voucher_awarded_at,
      redeemed,
    };
  });
}

async function toolListVouchers(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId;
    if (propertyId) await verifyPropertyAccess(ctx.req, propertyId, 'bookings:view');
    else await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
    const items = await loadOrgVouchers(ctx.organizationId, propertyId);
    return { ok: true, riskTier: 'tier0_read', data: { items } };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetRewardsSummary(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  const listed = await toolListVouchers(ctx, args);
  if (!listed.ok) return listed;
  const items = ((listed.data as { items?: Array<{ redeemed?: boolean }> })?.items ?? []) as Array<{
    redeemed?: boolean;
  }>;
  const redeemed = items.filter((row) => row.redeemed).length;
  return {
    ok: true,
    riskTier: 'tier0_read',
    data: {
      total: items.length,
      open: items.length - redeemed,
      redeemed,
    },
  };
}

async function toolGetSuperhostStatus(ctx: CoverageToolContext): Promise<CoverageToolResult> {
  try {
    const access = await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
    const sb = createServiceClient();
    const criteria = await loadAndComputeOrgSuperhostCriteria(sb, ctx.organizationId);
    const stored = readOrgSuperhostFromSettings(access.org.settings);
    const calendar = superhostProgressSummary();
    const mapped = formatSuperhostCriteria(criteria);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        earned: stored.earned === true,
        tier: stored.earned ? 'superhost' : 'none',
        tierLabel: stored.earned ? 'Superhost' : 'Not yet a Superhost',
        criteria: mapped,
        allCriteriaMet: allSuperhostCriteriaMet(criteria),
        nextAssessmentOn: (stored.nextAssessmentAt ?? calendar.nextAssessmentAt).slice(0, 10),
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetSetupGuideProgress(ctx: CoverageToolContext): Promise<CoverageToolResult> {
  try {
    const access = await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
    const guide = (access.org.settings as { setupGuide?: Record<string, unknown> } | null)
      ?.setupGuide;
    const reviewed = new Set(
      Array.isArray(guide?.reviewedSteps) ? (guide.reviewedSteps as string[]) : []
    );
    const skipped = new Set(
      Array.isArray(guide?.skippedSteps) ? (guide.skippedSteps as string[]) : []
    );
    const completedAt = typeof guide?.completedAt === 'string' ? guide.completedAt : null;
    const steps = SETUP_STEPS.map((step) => ({
      ...step,
      done: Boolean(completedAt) || reviewed.has(step.id) || skipped.has(step.id),
    }));
    const nextStep = steps.find((step) => !step.done) ?? null;
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        completed: steps.filter((step) => step.done).length,
        total: steps.length,
        steps,
        nextStep,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolListMarketingThemes(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'marketing:view');
    await requirePropertyPermissionAndFeature(
      ctx.req,
      propertyId,
      'marketing:view',
      'marketingStudio'
    );
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('marketing_themes')
      .select('id, name, tokens, source, source_ref, created_at, updated_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true })
      .limit(40);
    if (error) return { ok: false, error: error.message };
    const items = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      hostLabel: row.name,
      source: row.source,
      tokens: row.tokens,
      thumbnailUrl: null,
    }));
    return { ok: true, riskTier: 'tier0_read', data: { items } };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetMarketingTheme(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'marketing:view');
    const themeId = str(args, 'themeId');
    if (!themeId) return { ok: false, error: 'themeId is required' };
    await requirePropertyPermissionAndFeature(
      ctx.req,
      propertyId,
      'marketing:view',
      'marketingStudio'
    );
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('marketing_themes')
      .select('id, name, tokens, source, source_ref, created_at, updated_at')
      .eq('property_id', propertyId)
      .eq('id', themeId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Theme not found' };
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        id: data.id,
        name: data.name,
        hostLabel: data.name,
        source: data.source,
        tokens: data.tokens,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetAnalyticsDemographics(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'analytics:view');
    const today = manilaTodayIso();
    const from = str(args, 'from') ?? today.slice(0, 8) + '01';
    const to = str(args, 'to') ?? today;
    const bundle = await computeAnalyticsBundle({ propertyId, from, to });
    const partySize = bundle.distributions.partySize.map((row) => ({
      label: row.bucket,
      count: row.count,
    }));
    const leadTimeBands = bundle.distributions.leadTime.map((row) => ({
      label: row.bucket,
      count: row.count,
    }));
    const channelMix = bundle.distributions.channelMix.map((row) => ({
      channel: row.channel,
      count: row.count,
    }));
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        propertyId,
        period: { from, to },
        partySize,
        leadTimeBands,
        channelMix,
        reservations: bundle.kpis.reservations.value,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolListNotifications(ctx: CoverageToolContext): Promise<CoverageToolResult> {
  try {
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('notifications')
      .select('id, type, title, body, created_at, notification_reads!left(id)')
      .eq('organization_id', ctx.organizationId)
      .eq('notification_reads.user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return { ok: false, error: error.message };
    const items = (data ?? []).map((row) => {
      const unread = !Array.isArray(row.notification_reads) || row.notification_reads.length === 0;
      const title = String(row.title ?? 'Notification');
      return {
        id: row.id,
        type: row.type,
        hostLabel: hostLabel([title, unread ? 'Unread' : 'Read']),
        title,
        body: row.body,
        unread,
        createdAt: row.created_at,
      };
    });
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        unreadCount: items.filter((item) => item.unread).length,
        items,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetStayGuideContent(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'settings:view');
    const templateKey = await getCustomPageTemplateOrDefault(propertyId, 'stay_guide');
    const slug = await resolvePropertySlugById(propertyId);
    const sections = [
      { id: 'check-in-instructions', label: 'Check-in' },
      { id: 'house-rules', label: 'House rules' },
      { id: 'parking-reminders', label: 'Parking' },
      { id: 'check-out-instructions', label: 'Check-out' },
    ];
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        templateKey,
        publicPath: slug ? `/properties/${slug}/stay-guide` : null,
        sections,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetCustomPageContent(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'settings:view');
    const stayGuide = await getCustomPageTemplateOrDefault(propertyId, 'stay_guide');
    const showcase = await getCustomPageTemplateOrDefault(propertyId, 'property_showcase');
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        pages: [
          {
            id: 'stay_guide',
            hostLabel: 'Stay guide',
            pageType: 'stay_guide',
            templateKey: stayGuide,
            routeKey: 'property.public-pages',
          },
          {
            id: 'property_showcase',
            hostLabel: 'Showcase',
            pageType: 'property_showcase',
            templateKey: showcase,
            routeKey: 'property.public-pages',
          },
        ],
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolSearchHelpCenter(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId });
    const safe = sanitizeHelpQuery(str(args, 'query'));
    if (!safe) return { ok: false, error: 'query is required' };
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('ai_dashboard_assistant_knowledge_base')
      .select('route_guide_path, route_guide_title, route_path, question, answer')
      .ilike('question', `%${safe}%`)
      .limit(8);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        items: (data ?? []).map((row) => ({
          title: row.route_guide_title ?? row.route_guide_path,
          question: row.question,
          answer: row.answer,
          routePath: row.route_path,
          hostLabel: row.question,
        })),
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

async function toolGetPropertyTemplateContent(
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  try {
    const propertyId = await requireProperty(ctx, args, 'templates:view');
    const requested = str(args, 'templateKey') ?? str(args, 'name');

    if (!requested) {
      const data = await serializePropertyTemplatesForAdmin(propertyId);
      const templates = data.templates
        .filter((template) => template.category !== 'email')
        .map((template) => ({
          templateKey: template.templateKey,
          name: template.name,
          category: template.category,
          updatedAt: template.updatedAt,
          hostLabel: template.name,
        }));
      return {
        ok: true,
        riskTier: 'tier0_read',
        data: { templates, count: templates.length },
      };
    }

    const data = await serializePropertyTemplatesForAdmin(propertyId);
    const available = data.templates.filter((template) => template.category !== 'email');
    const needle = requested.toLowerCase();
    const match =
      available.find((template) => template.templateKey === requested) ??
      available.find((template) => template.name.toLowerCase() === needle) ??
      available.find((template) => template.name.toLowerCase().includes(needle));
    if (!match) {
      return {
        ok: false,
        error: `No template named "${requested}". Available: ${available
          .map((template) => template.name)
          .join(', ')}`,
      };
    }

    const template = await loadChatTemplate(propertyId, match.templateKey);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        templateKey: template.templateKey,
        name: template.name,
        category: template.category,
        text: chatTemplateHtmlToPlainText(template.content).slice(0, 8_000),
        hostLabel: template.name,
      },
    };
  } catch (err) {
    return restricted(err);
  }
}

const HANDLERS: Record<
  CoverageToolName,
  (ctx: CoverageToolContext, args: Record<string, unknown>) => Promise<CoverageToolResult>
> = {
  list_guest_reviews: toolListGuestReviews,
  get_review_summary: toolGetReviewSummary,
  get_rewards_summary: toolGetRewardsSummary,
  list_vouchers: toolListVouchers,
  get_superhost_status: (ctx) => toolGetSuperhostStatus(ctx),
  get_setup_guide_progress: (ctx) => toolGetSetupGuideProgress(ctx),
  list_marketing_themes: toolListMarketingThemes,
  get_marketing_theme: toolGetMarketingTheme,
  get_analytics_demographics: toolGetAnalyticsDemographics,
  list_notifications: (ctx) => toolListNotifications(ctx),
  get_stay_guide_content: toolGetStayGuideContent,
  get_custom_page_content: toolGetCustomPageContent,
  get_property_template_content: toolGetPropertyTemplateContent,
  search_help_center: toolSearchHelpCenter,
};

export async function runCoverageTool(
  name: CoverageToolName,
  ctx: CoverageToolContext,
  args: Record<string, unknown>
): Promise<CoverageToolResult> {
  return HANDLERS[name](ctx, args);
}

const emptyParams = { type: 'object', properties: {}, required: [] as string[] };
const propertyParams = {
  type: 'object',
  properties: { propertyId: { type: 'string' } },
  required: [] as string[],
};

export const COVERAGE_TOOL_DECLARATIONS = [
  {
    name: 'list_guest_reviews',
    description:
      'List recent published guest reviews for this listing (hostLabel, rating, excerpt).',
    parameters: propertyParams,
  },
  {
    name: 'get_review_summary',
    description: 'Average rating, counts, response rate, and rating distribution for this listing.',
    parameters: propertyParams,
  },
  {
    name: 'get_rewards_summary',
    description:
      'Counts of next-stay vouchers (open vs redeemed) for this organization or listing.',
    parameters: propertyParams,
  },
  {
    name: 'list_vouchers',
    description: 'List next-stay vouchers with guest hostLabel, code, and redeemed state.',
    parameters: propertyParams,
  },
  {
    name: 'get_superhost_status',
    description: 'Superhost criteria (met / missing) and next assessment date.',
    parameters: emptyParams,
  },
  {
    name: 'get_setup_guide_progress',
    description: 'Setup guide steps done and pending, with the next recommended step.',
    parameters: emptyParams,
  },
  {
    name: 'list_marketing_themes',
    description: 'List saved Marketing Studio themes (name, palette) for this listing.',
    parameters: propertyParams,
  },
  {
    name: 'get_marketing_theme',
    description: 'Fetch one Marketing Studio theme by id.',
    parameters: {
      type: 'object',
      properties: { propertyId: { type: 'string' }, themeId: { type: 'string' } },
      required: ['themeId'],
    },
  },
  {
    name: 'get_analytics_demographics',
    description:
      'Guest mix for this listing: party size, lead time, and channel mix. Use for "who are my guests".',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'list_notifications',
    description: 'Latest in-app notifications with unread count and hostLabel.',
    parameters: emptyParams,
  },
  {
    name: 'get_stay_guide_content',
    description: 'Stay guide template, public path, and section list for this listing.',
    parameters: propertyParams,
  },
  {
    name: 'get_custom_page_content',
    description: 'Stay guide and showcase page templates, with Open handoff keys.',
    parameters: propertyParams,
  },
  {
    name: 'get_property_template_content',
    description:
      'Read the full copy of a property template (house rules, check-in, check-out, parking, or a custom template). Omit templateKey to list templates; pass the template key or name to read one. Never answer a template content question by only opening the Templates page.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        templateKey: { type: 'string' },
        name: { type: 'string' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'search_help_center',
    description: 'Search host Help Center articles (complements search_knowledge_base).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
];
