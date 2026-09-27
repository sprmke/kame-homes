/**
 * `open_page` — Tier 0 navigation handoff. Returns the exact in-app screen for a host request
 * (from the ASSISTANT_ROUTES allowlist) after re-checking the section's view permission, so the
 * assistant can hand off anything it cannot do in chat. The chat turn turns each successful call
 * into an `open_page` block (server-built href; the model never writes it).
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5 + parity handoffs).
 */

import type { ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import {
  ASSISTANT_ROUTE_KEYS,
  ASSISTANT_ROUTES,
  buildAssistantRouteHref,
  isAssistantRouteKey,
  type AssistantRouteDef,
} from './dashboardAssistantRoutes.ts';
import {
  createServiceClient,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';
import { resolveOrganizationIdForProperty, resolvePropertySlugById } from './propertyScope.ts';

export type NavigationToolContext = {
  req: Request;
  organizationId: string;
  pageContext: { propertyId?: string | null; parkingId?: string | null; bookingId?: string | null };
  attachedContext: AttachedContextItem[];
};

export type NavigationToolResult = {
  ok: boolean;
  error?: string;
  data?: { routeKey: string; label: string; href: string };
  riskTier?: ActionRiskTier;
  auditPropertyId?: string | null;
};

export type OpenPageBlock = { type: 'open_page'; routeKey: string; label: string; href: string };

export const OPEN_PAGE_TOOL_DECLARATION = {
  name: 'open_page',
  description:
    'Hand off to an exact dashboard screen the host can open (Open button in chat). Use when the task is done in the UI rather than in chat (OAuth, checkout, editors, create or edit a booking, import commit, delete), or when the host asks to see a page. routeKey must be one of the allowed keys. Pass bookingId for *.booking, propertyId / parkingId to target another listing, and query only for filters the screen supports (status, from, to, q, tab, section, module).',
  parameters: {
    type: 'object',
    properties: {
      routeKey: { type: 'string', enum: [...ASSISTANT_ROUTE_KEYS] },
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
      bookingId: { type: 'string' },
      label: { type: 'string', description: 'Short button label, e.g. "Open payment settings".' },
      query: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          q: { type: 'string' },
          tab: { type: 'string' },
          section: { type: 'string' },
          module: { type: 'string' },
        },
      },
    },
    required: ['routeKey'],
  },
};

function str(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function firstAttached(ctx: NavigationToolContext, type: AttachedContextItem['type']) {
  return ctx.attachedContext.find((item) => item.type === type)?.id ?? null;
}

async function orgSlugFor(organizationId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

async function parkingSlugFor(parkingId: string, organizationId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('parkings')
    .select('slug')
    .eq('id', parkingId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

const LABEL_MAX = 60;

export async function toolOpenPage(
  ctx: NavigationToolContext,
  args: Record<string, unknown>
): Promise<NavigationToolResult> {
  const routeKey = args.routeKey;
  if (!isAssistantRouteKey(routeKey)) return { ok: false, error: 'Unknown page' };
  const route: AssistantRouteDef = ASSISTANT_ROUTES[routeKey];

  const orgSlug = await orgSlugFor(ctx.organizationId);
  if (!orgSlug) return { ok: false, error: 'Organization not found' };

  let propertySlug: string | null = null;
  let parkingSlug: string | null = null;
  let auditPropertyId: string | null = null;

  // Permission strings come from the typed allowlist; orgAuth's unions are narrower per scope.
  // deno-lint-ignore no-explicit-any
  const permission = route.permission as any;

  if (route.scope === 'property') {
    const propertyId =
      str(args, 'propertyId') ?? firstAttached(ctx, 'property') ?? ctx.pageContext.propertyId;
    if (!propertyId) return { ok: false, error: 'Which property? No property is in scope.' };
    if ((await resolveOrganizationIdForProperty(propertyId)) !== ctx.organizationId) {
      return { ok: false, error: 'Property is outside this organization' };
    }
    await verifyPropertyAccess(ctx.req, propertyId, permission);
    propertySlug = await resolvePropertySlugById(propertyId);
    auditPropertyId = propertyId;
  } else if (route.scope === 'parking') {
    const parkingId = str(args, 'parkingId') ?? ctx.pageContext.parkingId ?? null;
    if (!parkingId) return { ok: false, error: 'Which parking listing? None is in scope.' };
    await verifyParkingTeamAccess(ctx.req, parkingId, permission);
    parkingSlug = await parkingSlugFor(parkingId, ctx.organizationId);
    if (!parkingSlug) return { ok: false, error: 'Parking listing is outside this organization' };
  } else {
    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, permission);
  }

  const bookingId =
    str(args, 'bookingId') ??
    firstAttached(ctx, route.scope === 'parking' ? 'parking_booking' : 'booking') ??
    ctx.pageContext.bookingId ??
    null;
  const query =
    args.query && typeof args.query === 'object' && !Array.isArray(args.query)
      ? (args.query as Record<string, unknown>)
      : null;

  const href = buildAssistantRouteHref(routeKey, {
    orgSlug,
    propertySlug,
    parkingSlug,
    bookingId,
    query,
  });
  if (!href) return { ok: false, error: 'That page needs a booking to open' };

  const label = (str(args, 'label') ?? `Open ${route.label.toLowerCase()}`).slice(0, LABEL_MAX);
  return {
    ok: true,
    riskTier: 'tier0_read',
    auditPropertyId,
    data: { routeKey, label, href },
  };
}

/** Turns successful `open_page` results into chat blocks (deduped by href, max 3). */
export function openPageBlocksFromResults(
  results: Array<{ toolName: string; ok: boolean; data?: unknown }>
): OpenPageBlock[] {
  const seen = new Set<string>();
  const blocks: OpenPageBlock[] = [];
  for (const result of results) {
    if (result.toolName !== 'open_page' || !result.ok) continue;
    const data = result.data as { routeKey?: unknown; label?: unknown; href?: unknown } | undefined;
    if (
      typeof data?.href !== 'string' ||
      typeof data.label !== 'string' ||
      typeof data.routeKey !== 'string' ||
      !data.href.startsWith('/org/') ||
      seen.has(data.href)
    ) {
      continue;
    }
    seen.add(data.href);
    blocks.push({ type: 'open_page', routeKey: data.routeKey, label: data.label, href: data.href });
    if (blocks.length === 3) break;
  }
  return blocks;
}
