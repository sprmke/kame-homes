/**
 * AI assistant tools — channel sync status/trigger and related ops (Phase 5).
 * Wired from dashboardAssistantTools when Phase 4 merge is ready.
 */

import { classifyActionRisk, type ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import { assertActionSafeToExecute } from './dashboardAssistantSafetyGuard.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { createServiceClient, verifyPropertyAccess } from './orgAuth.ts';
import { requirePropertyFeature } from './planEntitlements.ts';
import { resolveOrganizationIdForProperty } from './propertyScope.ts';
import type { FeatureAvailabilityKey } from './featureAvailabilityCatalog.ts';
import { loadCalendarFeed, runFeedSync } from './calendarSyncRun.ts';

export type OpsToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type OpsToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: ActionRiskTier;
  proposed?: boolean;
  auditPropertyId?: string | null;
  auditBookingId?: string | null;
};

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function assistantActor(ctx: OpsToolContext): { id: string; email: string } {
  return { id: ctx.userId, email: ctx.userEmail };
}

async function channelSyncAvailabilityForAssistant(
  ctx: OpsToolContext
): Promise<
  Record<
    'pricing.channel_sync' | 'pricing.channel_sync.import',
    { available: boolean; message: string | null }
  >
> {
  const user = assistantActor(ctx);
  const { getFeatureAvailabilitySnapshot, isFeatureAvailable, resolveFeatureUnavailableMessage } =
    await import('./featureAvailability.ts');
  const snapshot = await getFeatureAvailabilitySnapshot();
  const keys: FeatureAvailabilityKey[] = ['pricing.channel_sync', 'pricing.channel_sync.import'];
  const out = {} as Record<
    'pricing.channel_sync' | 'pricing.channel_sync.import',
    { available: boolean; message: string | null }
  >;
  for (const key of keys) {
    const available = await isFeatureAvailable(key, { user });
    const resolved = snapshot.get(key);
    out[key] = {
      available,
      message: available
        ? null
        : resolved
          ? resolveFeatureUnavailableMessage(resolved)
          : 'This feature is temporarily unavailable.',
    };
  }
  return out;
}

async function assertChannelSyncImportAvailable(
  ctx: OpsToolContext
): Promise<OpsToolResult | null> {
  const availability = await channelSyncAvailabilityForAssistant(ctx);
  if (availability['pricing.channel_sync.import'].available) return null;
  return {
    ok: false,
    error:
      availability['pricing.channel_sync.import'].message ??
      'Imports from Airbnb are temporarily unavailable.',
  };
}

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<void> {
  const orgId = await resolveOrganizationIdForProperty(propertyId);
  if (orgId !== organizationId) throw new Error('Property is outside this organization');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function toolGetChannelSyncStatus(
  ctx: OpsToolContext,
  args: Record<string, unknown>
): Promise<OpsToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!propertyId) return { ok: false, error: 'propertyId is required' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.channels:view');

    const supabase = createServiceClient();
    const { data: feeds, error } = await supabase
      .from('property_calendar_feeds')
      .select(
        'id, provider, label, is_active, last_attempted_at, last_success_at, last_error, consecutive_failures'
      )
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    const { data: exportRow } = await supabase
      .from('property_calendar_export')
      .select('is_enabled')
      .eq('property_id', propertyId)
      .maybeSingle();

    const availability = await channelSyncAvailabilityForAssistant(ctx);

    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        propertyId,
        availability,
        feeds: (feeds ?? []).map((f) => ({
          feedId: f.id,
          platform: f.provider,
          label: f.label,
          enabled: f.is_active,
          lastAttemptedAt: f.last_attempted_at,
          lastSuccessAt: f.last_success_at,
          lastError: f.last_error,
          consecutiveFailures: f.consecutive_failures,
        })),
        exportEnabled: Boolean(exportRow?.is_enabled),
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolProposeRunChannelSync(
  ctx: OpsToolContext,
  args: Record<string, unknown>
): Promise<OpsToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const feedId = str(args, 'feedId');
    if (!propertyId || !feedId) {
      return { ok: false, error: 'propertyId and feedId are required' };
    }
    if (!UUID_RE.test(feedId)) return { ok: false, error: 'Invalid feedId' };

    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.channels:edit');
    const importBlocked = await assertChannelSyncImportAvailable(ctx);
    if (importBlocked) return importBlocked;
    try {
      await requirePropertyFeature(propertyId, 'calendarSync');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Channel sync requires a higher plan';
      return { ok: false, error: msg };
    }

    const supabase = createServiceClient();
    const feed = await loadCalendarFeed(supabase, feedId);
    if (!feed || feed.property_id !== propertyId) {
      return { ok: false, error: 'Feed not found on this property' };
    }

    const tier = classifyActionRisk({
      toolName: 'propose_run_channel_sync',
      targetBookingId: null,
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
        summary: `Run Channel sync now for the ${String(feed.provider ?? 'calendar')} feed on this property.`,
        payload: { propertyId, feedId },
        details: [
          { label: 'Platform', value: String(feed.provider ?? 'calendar') },
          { label: 'Feed', value: feedId },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeRunChannelSync(
  ctx: OpsToolContext,
  payload: Record<string, unknown>
): Promise<OpsToolResult> {
  try {
    const propertyId = str(payload, 'propertyId');
    const feedId = str(payload, 'feedId');
    if (!propertyId || !feedId) return { ok: false, error: 'Malformed proposal payload' };

    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'pricing.channels:edit');
    const importBlocked = await assertChannelSyncImportAvailable(ctx);
    if (importBlocked) return importBlocked;
    await requirePropertyFeature(propertyId, 'calendarSync');
    await assertActionSafeToExecute({
      toolName: 'propose_run_channel_sync',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const supabase = createServiceClient();
    const feed = await loadCalendarFeed(supabase, feedId);
    if (!feed || feed.property_id !== propertyId) {
      return { ok: false, error: 'Feed not found on this property' };
    }

    const result = await runFeedSync(feed, {
      runId: crypto.randomUUID(),
      force: true,
      supabase,
    });

    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: { result, message: 'Channel sync finished.' },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolGetPublicPagesStatus(
  ctx: OpsToolContext,
  args: Record<string, unknown>
): Promise<OpsToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!propertyId) return { ok: false, error: 'propertyId is required' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'publicPages:view');

    const { getOrCreateCustomPage } = await import('./customPages.ts');
    const stayGuide = await getOrCreateCustomPage(propertyId, 'stay_guide');
    const showcase = await getOrCreateCustomPage(propertyId, 'property_showcase');

    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        pages: [
          {
            pageType: stayGuide.pageType,
            templateKey: stayGuide.templateKey,
            updatedAt: stayGuide.updatedAt,
            hostHint: 'Edit sections in Public pages → Stay guide',
          },
          {
            pageType: showcase.pageType,
            templateKey: showcase.templateKey,
            updatedAt: showcase.updatedAt,
            hostHint: 'Edit sections in Public pages → Showcase',
          },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolProposeUpdatePublicPageTemplate(
  ctx: OpsToolContext,
  args: Record<string, unknown>
): Promise<OpsToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const pageType = str(args, 'pageType');
    const templateKey = str(args, 'templateKey');
    if (!propertyId || !pageType || !templateKey) {
      return {
        ok: false,
        error:
          'propertyId, pageType (stay_guide | property_showcase), and templateKey are required',
      };
    }
    if (pageType !== 'stay_guide' && pageType !== 'property_showcase') {
      return { ok: false, error: 'pageType must be stay_guide or property_showcase' };
    }

    await assertPropertyInOrg(propertyId, ctx.organizationId);
    const permission =
      pageType === 'stay_guide' ? 'publicPages.stayGuide:edit' : 'publicPages.showcase:edit';
    await verifyPropertyAccess(ctx.req, propertyId, permission);
    try {
      await requirePropertyFeature(propertyId, 'publicPagesAutosave');
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Public pages template change requires Pro+',
      };
    }

    const { isShowcaseTemplateKey, SHOWCASE_TEMPLATE_KEYS } = await import('./customPages.ts');
    if (!isShowcaseTemplateKey(templateKey)) {
      return {
        ok: false,
        error: `templateKey must be one of: ${SHOWCASE_TEMPLATE_KEYS.join(', ')}`,
      };
    }

    const tier = classifyActionRisk({
      toolName: 'propose_update_public_page_template',
      targetBookingId: null,
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
        summary: `Set ${pageType === 'stay_guide' ? 'Stay guide' : 'Showcase'} template to “${templateKey}”. Section content still edits in Public pages.`,
        payload: { propertyId, pageType, templateKey },
        details: [
          { label: 'Page', value: pageType === 'stay_guide' ? 'Stay guide' : 'Showcase' },
          { label: 'Template', value: templateKey },
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeUpdatePublicPageTemplate(
  ctx: OpsToolContext,
  payload: Record<string, unknown>
): Promise<OpsToolResult> {
  try {
    const propertyId = str(payload, 'propertyId');
    const pageType = str(payload, 'pageType');
    const templateKey = str(payload, 'templateKey');
    if (
      !propertyId ||
      !templateKey ||
      (pageType !== 'stay_guide' && pageType !== 'property_showcase')
    ) {
      return { ok: false, error: 'Malformed proposal payload' };
    }

    await assertPropertyInOrg(propertyId, ctx.organizationId);
    const permission =
      pageType === 'stay_guide' ? 'publicPages.stayGuide:edit' : 'publicPages.showcase:edit';
    await verifyPropertyAccess(ctx.req, propertyId, permission);
    await requirePropertyFeature(propertyId, 'publicPagesAutosave');
    await assertActionSafeToExecute({
      toolName: 'propose_update_public_page_template',
      targetBookingId: null,
      targetPropertyId: propertyId,
      pageContext: ctx.pageContext,
      attachedContext: ctx.attachedContext,
      isBulk: false,
      expectedTier: 'tier2_confirmed',
    });

    const { updateCustomPageTemplate, isShowcaseTemplateKey } = await import('./customPages.ts');
    if (!isShowcaseTemplateKey(templateKey)) {
      return { ok: false, error: 'Invalid templateKey' };
    }
    const row = await updateCustomPageTemplate(propertyId, pageType, templateKey);
    return {
      ok: true,
      riskTier: 'tier2_confirmed',
      auditPropertyId: propertyId,
      data: {
        pageType: row.pageType,
        templateKey: row.templateKey,
        updatedAt: row.updatedAt,
        message: 'Public page template updated.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const GET_CHANNEL_SYNC_STATUS_TOOL_DECLARATION = {
  name: 'get_channel_sync_status',
  description:
    'Show Airbnb/Channel calendar sync feeds and export status for a property (Pricing → Channel sync).',
  parameters: {
    type: 'object',
    properties: { propertyId: { type: 'string' } },
    required: ['propertyId'],
  },
};

export const RUN_CHANNEL_SYNC_TOOL_DECLARATION = {
  name: 'propose_run_channel_sync',
  description:
    'Force-run Channel sync for one feed (same as Sync now in Pricing → Channel sync). Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      feedId: { type: 'string' },
    },
    required: ['propertyId', 'feedId'],
  },
};

export const GET_PUBLIC_PAGES_STATUS_TOOL_DECLARATION = {
  name: 'get_public_pages_status',
  description: 'Show Stay guide and Showcase template keys for a property.',
  parameters: {
    type: 'object',
    properties: { propertyId: { type: 'string' } },
    required: ['propertyId'],
  },
};

export const UPDATE_PUBLIC_PAGE_TEMPLATE_TOOL_DECLARATION = {
  name: 'propose_update_public_page_template',
  description:
    'Change Stay guide or Showcase template key. Section pixel edits stay in Public pages UI. Requires Confirm.',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      pageType: { type: 'string', enum: ['stay_guide', 'property_showcase'] },
      templateKey: { type: 'string' },
    },
    required: ['propertyId', 'pageType', 'templateKey'],
  },
};
