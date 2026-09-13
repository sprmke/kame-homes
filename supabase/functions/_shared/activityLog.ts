/**
 * activityLog — fire-and-forget writer for `public.activity_log`, the org-wide
 * activity / audit timeline covering every mutating surface (dashboard, public
 * pages, AI assistant, crons, webhooks) scoped by org / property / parking.
 *
 * Plan:  docs/workflow/planned/org-activity-audit-log.md
 * Rule:  .cursor/rules/audit-logging.mdc  ·  Skill: .agent/skills/audit-logging
 * Read:  list-activity-log / activity-log-export
 *
 * Contract — identical to superAdminAudit.ts / notificationService.ts:
 *   1. Never throws into the caller. A logging failure logs and returns; it must
 *      never fail the mutation / email / webhook ack / transition that triggered it.
 *   2. Single INSERT, no sub-selects on the write path.
 *   3. Call AFTER the write succeeds and BEFORE the HTTP response — never from a
 *      `catch` block (the sole exception: `security.denied_destructive_action`).
 *   4. Bulk operations emit ONE summary row via `logActivityBatch` — never one
 *      row per entity.
 *   5. `diffRecord` here is independent of `_shared/utils.ts#compareFormData`
 *      (which silently omits `petType`).
 */

import { createServiceClient } from './orgAuth.ts';
import type { AdminUser } from './auth.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import type {
  OrgAccessContext,
  ParkingTeamAccessContext,
  PropertyAccessContext,
} from './orgAuth.ts';

// ─── Enumerations (mirror the CHECK constraints in the activity_log migration) ──

export type ActivitySeverity = 'info' | 'notice' | 'warning' | 'destructive';
export type ActivityScope = 'org' | 'property' | 'parking';

export type ActivityActorType =
  | 'org_owner'
  | 'team_member'
  | 'super_admin'
  | 'ai_assistant'
  | 'guest'
  | 'public'
  | 'system'
  | 'cron'
  | 'webhook'
  | 'integration'
  | 'email_inbound';

export type ActivitySource =
  | 'dashboard'
  | 'public_form'
  | 'ai_assistant'
  | 'cron'
  | 'webhook'
  | 'telegram'
  | 'email_inbound'
  | 'db_trigger';

export type ActivityCategory =
  | 'booking'
  | 'team'
  | 'settings'
  | 'pricing'
  | 'finance'
  | 'maintenance'
  | 'marketing'
  | 'inbox'
  | 'property'
  | 'parking'
  | 'org'
  | 'plans_billing'
  | 'verification'
  | 'integrations'
  | 'public_pages'
  | 'guest'
  | 'security'
  | 'system';

// ─── Field-level diff ─────────────────────────────────────────────────────────

export type ActivityChange = { field: string; from: unknown; to: unknown };

// ─── Actor ────────────────────────────────────────────────────────────────────

export type ActorContext = {
  actorType: ActivityActorType;
  source: ActivitySource;
  userId?: string | null;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
  memberId?: string | null;
  ipPrefix?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  /** Merged into `metadata` (e.g. assistant_conversation_id). */
  extraMetadata?: Record<string, unknown>;
};

// ─── Write input ──────────────────────────────────────────────────────────────

export type LogActivityInput = {
  action: ActivityAction;
  organizationId: string;
  /** Inferred from parkingId / propertyId when omitted. */
  scope?: ActivityScope;
  propertyId?: string | null;
  parkingId?: string | null;
  actor: ActorContext;
  /** Defaults to the catalog `targetType`. */
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  /** Defaults to the catalog `severity`. */
  severity?: ActivitySeverity;
  /** Rare override — normally the catalog template renders this. */
  summary?: string;
  changes?: ActivityChange[] | null;
  metadata?: Record<string, unknown>;
};

export type LogActivityOptions = {
  /**
   * Defer the insert to `EdgeRuntime.waitUntil` instead of awaiting inline.
   * ONLY for explicitly non-critical, high-frequency `notice` events where
   * losing one on function teardown is acceptable. Never for `destructive` /
   * `warning`.
   */
  background?: boolean;
};

// ─── Action catalog — the single source of truth for category / severity /
//     target type / summary shape. Add an entry for every new action; mirror the
//     category → icon map in ui/.../activity/lib/activityCatalog.ts. ────────────

type ActivitySummaryContext = {
  actorName: string;
  targetLabel: string | null;
  metadata: Record<string, unknown>;
  changeCount: number;
};

type ActivityActionDef = {
  category: ActivityCategory;
  severity: ActivitySeverity;
  targetType: string;
  summary: (ctx: ActivitySummaryContext) => string;
};

const label = (ctx: ActivitySummaryContext, fallback: string): string =>
  ctx.targetLabel?.trim() || fallback;

const num = (metadata: Record<string, unknown>, key: string, fallback = 0): number => {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const str = (metadata: Record<string, unknown>, key: string): string | null => {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const ACTIVITY_ACTION_CATALOG = {
  // ── Bookings & workflow ──────────────────────────────────────────────────
  'booking.created': {
    category: 'booking',
    severity: 'info',
    targetType: 'booking',
    summary: (c) => `${c.actorName} created ${label(c, 'a booking')}`,
  },
  'booking.details_edited': {
    category: 'booking',
    severity: 'info',
    targetType: 'booking',
    summary: (c) =>
      `${c.actorName} edited ${label(c, 'a booking')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'booking.deleted': {
    category: 'booking',
    severity: 'destructive',
    targetType: 'booking',
    summary: (c) => `${c.actorName} deleted ${label(c, 'a booking')}`,
  },
  'booking.status_changed': {
    category: 'booking',
    severity: 'info',
    targetType: 'booking',
    summary: (c) => {
      const from = str(c.metadata, 'from_status');
      const to = str(c.metadata, 'to_status');
      const path = from && to ? ` from ${from} to ${to}` : '';
      return `${c.actorName} advanced ${label(c, 'a booking')}${path}`;
    },
  },
  'booking.cancelled': {
    category: 'booking',
    severity: 'destructive',
    targetType: 'booking',
    summary: (c) => `${c.actorName} cancelled ${label(c, 'a booking')}`,
  },
  'booking.document_substep_completed': {
    category: 'booking',
    severity: 'info',
    targetType: 'booking',
    summary: (c) =>
      `${c.actorName} completed ${str(c.metadata, 'requirement') ?? 'a document step'} on ${label(
        c,
        'a booking'
      )}`,
  },
  'booking.bulk_imported': {
    category: 'booking',
    severity: 'notice',
    targetType: 'property',
    summary: (c) =>
      `${c.actorName} imported ${num(c.metadata, 'count')} booking${
        num(c.metadata, 'count') === 1 ? '' : 's'
      } into ${label(c, 'a property')}`,
  },
  'booking.import_reverted': {
    category: 'booking',
    severity: 'destructive',
    targetType: 'property',
    summary: (c) =>
      `${c.actorName} reverted an import of ${num(c.metadata, 'count')} booking${
        num(c.metadata, 'count') === 1 ? '' : 's'
      } from ${label(c, 'a property')}`,
  },

  // ── Parking operations ───────────────────────────────────────────────────
  'parking.status_changed': {
    category: 'parking',
    severity: 'info',
    targetType: 'parking_booking',
    summary: (c) => {
      const from = str(c.metadata, 'from_status');
      const to = str(c.metadata, 'to_status');
      const path = from && to ? ` from ${from} to ${to}` : '';
      return `${c.actorName} advanced ${label(c, 'a parking booking')}${path}`;
    },
  },
  'parking.cancelled': {
    category: 'parking',
    severity: 'destructive',
    targetType: 'parking_booking',
    summary: (c) => `${c.actorName} cancelled ${label(c, 'a parking booking')}`,
  },
  'parking.claimed': {
    category: 'parking',
    severity: 'info',
    targetType: 'parking_booking',
    summary: (c) => `${c.actorName} claimed ${label(c, 'a parking request')}`,
  },
  'parking.declined': {
    category: 'parking',
    severity: 'info',
    targetType: 'parking_booking',
    summary: (c) => `${c.actorName} declined ${label(c, 'a parking request')}`,
  },
  'parking.request_submitted': {
    category: 'parking',
    severity: 'info',
    targetType: 'parking_booking',
    summary: (c) => `${c.actorName} submitted ${label(c, 'a parking request')}`,
  },

  // ── Team & RBAC ──────────────────────────────────────────────────────────
  'team.invite_sent': {
    category: 'team',
    severity: 'notice',
    targetType: 'invitation',
    summary: (c) => `${c.actorName} invited ${label(c, 'a team member')}`,
  },
  'team.invite_resent': {
    category: 'team',
    severity: 'info',
    targetType: 'invitation',
    summary: (c) => `${c.actorName} resent an invite to ${label(c, 'a team member')}`,
  },
  'team.invite_revoked': {
    category: 'team',
    severity: 'destructive',
    targetType: 'invitation',
    summary: (c) => `${c.actorName} revoked an invite to ${label(c, 'a team member')}`,
  },
  'team.invite_accepted': {
    category: 'team',
    severity: 'info',
    targetType: 'member',
    summary: (c) => `${c.actorName} accepted an invitation to join`,
  },
  'team.member_role_changed': {
    category: 'team',
    severity: 'notice',
    targetType: 'member',
    summary: (c) =>
      `${c.actorName} changed the role of ${label(c, 'a team member')}` +
      (str(c.metadata, 'to_role') ? ` to ${str(c.metadata, 'to_role')}` : ''),
  },
  'team.member_permissions_changed': {
    category: 'team',
    severity: 'notice',
    targetType: 'member',
    summary: (c) =>
      `${c.actorName} updated permissions for ${label(c, 'a team member')}` +
      (c.changeCount ? ` (${c.changeCount} change${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'team.member_listing_assignment_changed': {
    category: 'team',
    severity: 'notice',
    targetType: 'member',
    summary: (c) => `${c.actorName} changed listing access for ${label(c, 'a team member')}`,
  },
  'team.member_suspended': {
    category: 'team',
    severity: 'warning',
    targetType: 'member',
    summary: (c) => `${c.actorName} suspended ${label(c, 'a team member')}`,
  },
  'team.member_removed': {
    category: 'team',
    severity: 'destructive',
    targetType: 'member',
    summary: (c) => `${c.actorName} removed ${label(c, 'a team member')}`,
  },
  'team.custom_role_created': {
    category: 'team',
    severity: 'notice',
    targetType: 'custom_role',
    summary: (c) => `${c.actorName} created the role ${label(c, 'a custom role')}`,
  },
  'team.custom_role_updated': {
    category: 'team',
    severity: 'notice',
    targetType: 'custom_role',
    summary: (c) => `${c.actorName} updated the role ${label(c, 'a custom role')}`,
  },
  'team.custom_role_deleted': {
    category: 'team',
    severity: 'destructive',
    targetType: 'custom_role',
    summary: (c) => `${c.actorName} deleted the role ${label(c, 'a custom role')}`,
  },

  // ── Org / Property / Parking lifecycle ───────────────────────────────────
  'org.created': {
    category: 'org',
    severity: 'notice',
    targetType: 'organization',
    summary: (c) => `${c.actorName} created ${label(c, 'the organization')}`,
  },
  'org.updated': {
    category: 'org',
    severity: 'info',
    targetType: 'organization',
    summary: (c) =>
      `${c.actorName} updated ${label(c, 'the organization')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'org.deleted': {
    category: 'org',
    severity: 'destructive',
    targetType: 'organization',
    summary: (c) => `${c.actorName} deleted ${label(c, 'the organization')}`,
  },
  'property.created': {
    category: 'property',
    severity: 'notice',
    targetType: 'property',
    summary: (c) => `${c.actorName} created the property ${label(c, 'a property')}`,
  },
  'property.updated': {
    category: 'property',
    severity: 'info',
    targetType: 'property',
    summary: (c) =>
      `${c.actorName} updated the property ${label(c, 'a property')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'property.deleted': {
    category: 'property',
    severity: 'destructive',
    targetType: 'property',
    summary: (c) => `${c.actorName} deleted the property ${label(c, 'a property')}`,
  },
  'parking.created': {
    category: 'parking',
    severity: 'notice',
    targetType: 'parking',
    summary: (c) => `${c.actorName} created the parking listing ${label(c, 'a parking listing')}`,
  },
  'parking.updated': {
    category: 'parking',
    severity: 'info',
    targetType: 'parking',
    summary: (c) =>
      `${c.actorName} updated the parking listing ${label(c, 'a parking listing')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'parking.deleted': {
    category: 'parking',
    severity: 'destructive',
    targetType: 'parking',
    summary: (c) => `${c.actorName} deleted the parking listing ${label(c, 'a parking listing')}`,
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  'settings.updated': {
    category: 'settings',
    severity: 'info',
    targetType: 'settings',
    summary: (c) => {
      const area = str(c.metadata, 'area');
      const where = label(c, 'settings');
      return (
        `${c.actorName} updated ${area ? `${area} settings` : 'settings'} for ${where}` +
        (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : '')
      );
    },
  },
  'settings.asset_uploaded': {
    category: 'settings',
    severity: 'notice',
    targetType: 'settings',
    summary: (c) =>
      `${c.actorName} uploaded ${str(c.metadata, 'asset_kind') ?? 'an asset'} for ${label(
        c,
        'settings'
      )}`,
  },
  'settings.template_saved': {
    category: 'settings',
    severity: 'info',
    targetType: 'template',
    summary: (c) => `${c.actorName} saved the template ${label(c, 'a template')}`,
  },
  'settings.template_deleted': {
    category: 'settings',
    severity: 'destructive',
    targetType: 'template',
    summary: (c) => `${c.actorName} deleted the template ${label(c, 'a template')}`,
  },
  'public_pages.config_saved': {
    category: 'public_pages',
    severity: 'info',
    targetType: 'page_config',
    summary: (c) =>
      `${c.actorName} saved the ${str(c.metadata, 'page') ?? 'public'} page for ${label(
        c,
        'a listing'
      )}`,
  },
  'public_pages.published': {
    category: 'public_pages',
    severity: 'notice',
    targetType: 'page_config',
    summary: (c) =>
      `${c.actorName} published the ${str(c.metadata, 'page') ?? 'public'} page for ${label(
        c,
        'a listing'
      )}`,
  },

  // ── Pricing ──────────────────────────────────────────────────────────────
  'pricing.rates_updated': {
    category: 'pricing',
    severity: 'info',
    targetType: 'pricing_range',
    summary: (c) => {
      const count = num(c.metadata, 'count');
      const scope = str(c.metadata, 'scope') ?? 'nightly rates';
      return (
        `${c.actorName} updated ${scope} for ${label(c, 'a listing')}` +
        (count ? ` (${count} date${count === 1 ? '' : 's'})` : '')
      );
    },
  },
  'pricing.dates_blocked': {
    category: 'pricing',
    severity: 'notice',
    targetType: 'pricing_range',
    summary: (c) =>
      `${c.actorName} blocked ${num(c.metadata, 'count')} date${
        num(c.metadata, 'count') === 1 ? '' : 's'
      } for ${label(c, 'a listing')}`,
  },
  'pricing.dates_unblocked': {
    category: 'pricing',
    severity: 'info',
    targetType: 'pricing_range',
    summary: (c) =>
      `${c.actorName} unblocked ${num(c.metadata, 'count')} date${
        num(c.metadata, 'count') === 1 ? '' : 's'
      } for ${label(c, 'a listing')}`,
  },
  'pricing.smart_config_changed': {
    category: 'pricing',
    severity: 'notice',
    targetType: 'pricing_range',
    summary: (c) =>
      `${c.actorName} changed smart pricing settings for ${label(c, 'a property')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'pricing.smart_applied': {
    category: 'pricing',
    severity: 'notice',
    targetType: 'pricing_range',
    summary: (c) =>
      `${c.actorName} applied smart pricing to ${num(c.metadata, 'count')} date${
        num(c.metadata, 'count') === 1 ? '' : 's'
      } for ${label(c, 'a property')}`,
  },

  // ── Finance ──────────────────────────────────────────────────────────────
  'finance.entry_created': {
    category: 'finance',
    severity: 'info',
    targetType: 'finance_entry',
    summary: (c) =>
      `${c.actorName} added ${str(c.metadata, 'kind') ?? 'an entry'} "${label(
        c,
        'a finance entry'
      )}"`,
  },
  'finance.entry_updated': {
    category: 'finance',
    severity: 'info',
    targetType: 'finance_entry',
    summary: (c) =>
      `${c.actorName} edited the finance entry ${label(c, 'a finance entry')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'finance.entry_deleted': {
    category: 'finance',
    severity: 'destructive',
    targetType: 'finance_entry',
    summary: (c) => `${c.actorName} deleted the finance entry ${label(c, 'a finance entry')}`,
  },
  'finance.report_exported': {
    category: 'finance',
    severity: 'notice',
    targetType: 'finance_entry',
    summary: (c) => `${c.actorName} exported a finance report for ${label(c, 'a listing')}`,
  },

  // ── Maintenance ──────────────────────────────────────────────────────────
  'maintenance.task_created': {
    category: 'maintenance',
    severity: 'info',
    targetType: 'maintenance_item',
    summary: (c) => `${c.actorName} added the maintenance task ${label(c, 'a task')}`,
  },
  'maintenance.task_updated': {
    category: 'maintenance',
    severity: 'info',
    targetType: 'maintenance_item',
    summary: (c) =>
      `${c.actorName} edited the maintenance task ${label(c, 'a task')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },
  'maintenance.task_deleted': {
    category: 'maintenance',
    severity: 'destructive',
    targetType: 'maintenance_item',
    summary: (c) => `${c.actorName} deleted the maintenance task ${label(c, 'a task')}`,
  },

  // ── Plans & billing ─────────────────────────────────────────────────────
  'billing.checkout_started': {
    category: 'plans_billing',
    severity: 'info',
    targetType: 'subscription',
    summary: (c) =>
      `${c.actorName} started checkout for the ${str(c.metadata, 'plan') ?? 'a'} plan`,
  },
  'billing.plan_downgraded': {
    category: 'plans_billing',
    severity: 'destructive',
    targetType: 'subscription',
    summary: (c) =>
      `${c.actorName} downgraded the plan to ${str(c.metadata, 'to_plan') ?? 'a lower tier'}`,
  },
  'billing.plan_overridden_by_platform': {
    category: 'plans_billing',
    severity: 'warning',
    targetType: 'subscription',
    summary: (c) =>
      `${c.actorName} changed the plan to ${str(c.metadata, 'to_plan') ?? 'another tier'} (platform)`,
  },
  'billing.subscription_activated': {
    category: 'plans_billing',
    severity: 'notice',
    targetType: 'subscription',
    summary: (c) => `Subscription activated on the ${str(c.metadata, 'plan') ?? 'paid'} plan`,
  },
  'billing.payment_succeeded': {
    category: 'plans_billing',
    severity: 'info',
    targetType: 'subscription',
    summary: (c) =>
      `A subscription payment succeeded${
        num(c.metadata, 'amount') ? ` (${num(c.metadata, 'amount')})` : ''
      }`,
  },
  'billing.payment_failed': {
    category: 'plans_billing',
    severity: 'warning',
    targetType: 'subscription',
    summary: (c) => str(c.metadata, 'message') ?? `A subscription payment failed`,
  },

  // ── Verification & trust ────────────────────────────────────────────────
  'verification.submitted': {
    category: 'verification',
    severity: 'info',
    targetType: 'verification',
    summary: (c) =>
      `${c.actorName} submitted ${str(c.metadata, 'kind') ?? 'a verification request'}`,
  },
  'verification.approved': {
    category: 'verification',
    severity: 'notice',
    targetType: 'verification',
    summary: (c) =>
      `${c.actorName} approved ${str(c.metadata, 'kind') ?? 'a verification request'}`,
  },
  'verification.rejected': {
    category: 'verification',
    severity: 'destructive',
    targetType: 'verification',
    summary: (c) =>
      `${c.actorName} rejected ${str(c.metadata, 'kind') ?? 'a verification request'}`,
  },
  'verification.superhost_reassessed': {
    category: 'verification',
    severity: 'info',
    targetType: 'verification',
    summary: (c) =>
      `${c.actorName} reassessed Superhost status for ${label(c, 'the organization')}`,
  },

  // ── Integrations ────────────────────────────────────────────────────────
  'integrations.connected': {
    category: 'integrations',
    severity: 'notice',
    targetType: 'integration',
    summary: (c) =>
      `${c.actorName} connected ${str(c.metadata, 'provider') ?? 'an integration'} for ${label(
        c,
        'a listing'
      )}`,
  },
  'integrations.disconnected': {
    category: 'integrations',
    severity: 'destructive',
    targetType: 'integration',
    summary: (c) =>
      `${c.actorName} disconnected ${str(c.metadata, 'provider') ?? 'an integration'} for ${label(
        c,
        'a listing'
      )}`,
  },
  'integrations.config_changed': {
    category: 'integrations',
    severity: 'info',
    targetType: 'integration',
    summary: (c) =>
      `${c.actorName} changed ${str(c.metadata, 'provider') ?? 'integration'} settings for ${label(
        c,
        'a listing'
      )}` + (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },

  // ── Marketing & inbox ──────────────────────────────────────────────────
  'marketing.template_saved': {
    category: 'marketing',
    severity: 'info',
    targetType: 'template',
    summary: (c) => `${c.actorName} saved the marketing template ${label(c, 'a template')}`,
  },
  'marketing.template_deleted': {
    category: 'marketing',
    severity: 'destructive',
    targetType: 'template',
    summary: (c) => `${c.actorName} deleted the marketing template ${label(c, 'a template')}`,
  },
  'marketing.published_to_meta': {
    category: 'marketing',
    severity: 'warning',
    targetType: 'marketing_post',
    summary: (c) =>
      `${c.actorName} published ${str(c.metadata, 'target') ?? 'a post'} to Meta for ${label(
        c,
        'a listing'
      )}`,
  },
  'marketing.image_generated': {
    category: 'marketing',
    severity: 'info',
    targetType: 'marketing_generation',
    summary: (c) =>
      `${c.actorName} generated an AI image for ${label(c, 'a listing')}` +
      (num(c.metadata, 'credits') ? ` (${num(c.metadata, 'credits')} credits)` : ''),
  },
  'marketing.generated_asset_deleted': {
    category: 'marketing',
    severity: 'destructive',
    targetType: 'marketing_generation',
    summary: (c) => `${c.actorName} deleted a generated AI asset for ${label(c, 'a listing')}`,
  },
  'marketing.video_generation_started': {
    category: 'marketing',
    severity: 'info',
    targetType: 'marketing_generation',
    summary: (c) => `${c.actorName} started an AI video generation for ${label(c, 'a listing')}`,
  },
  'marketing.video_generated': {
    category: 'marketing',
    severity: 'info',
    targetType: 'marketing_generation',
    summary: (c) =>
      `${c.actorName} generated an AI video for ${label(c, 'a listing')}` +
      (num(c.metadata, 'credits') ? ` (${num(c.metadata, 'credits')} credits)` : ''),
  },
  'marketing.external_review_moderated': {
    category: 'marketing',
    severity: 'notice',
    targetType: 'external_review',
    summary: (c) =>
      `${c.actorName} ${str(c.metadata, 'decision') ?? 'moderated'} a guest-submitted review`,
  },
  'inbox.settings_changed': {
    category: 'inbox',
    severity: 'info',
    targetType: 'settings',
    summary: (c) =>
      `${c.actorName} changed inbox settings for ${label(c, 'a listing')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },

  // ── AI controls ────────────────────────────────────────────────────────
  'ai.assistant_toggled': {
    category: 'settings',
    severity: 'notice',
    targetType: 'settings',
    summary: (c) =>
      `${c.actorName} ${str(c.metadata, 'state') ?? 'changed'} the AI assistant for ${label(
        c,
        'a listing'
      )}`,
  },
  'ai.config_changed': {
    category: 'settings',
    severity: 'info',
    targetType: 'settings',
    summary: (c) =>
      `${c.actorName} changed AI assistant settings for ${label(c, 'a listing')}` +
      (c.changeCount ? ` (${c.changeCount} field${c.changeCount === 1 ? '' : 's'})` : ''),
  },

  // ── Guest / public ─────────────────────────────────────────────────────
  'guest.sd_form_submitted': {
    category: 'guest',
    severity: 'info',
    targetType: 'booking',
    summary: (c) =>
      `${c.actorName} submitted the security deposit refund form for ${label(c, 'a booking')}`,
  },
  'guest.review_submitted': {
    category: 'guest',
    severity: 'info',
    targetType: 'booking',
    summary: (c) => `${c.actorName} submitted a stay review for ${label(c, 'a booking')}`,
  },
  'guest.voucher_claimed': {
    category: 'guest',
    severity: 'info',
    targetType: 'voucher',
    summary: (c) => `${c.actorName} claimed a voucher`,
  },
  'guest.pay_parking_submitted': {
    category: 'guest',
    severity: 'info',
    targetType: 'parking_booking',
    summary: (c) =>
      `${c.actorName} submitted a parking payment for ${label(c, 'a parking booking')}`,
  },
  'guest.support_ticket_filed': {
    category: 'guest',
    severity: 'notice',
    targetType: 'support_ticket',
    summary: (c) => `${c.actorName} filed a support ticket`,
  },
  'guest.profile_updated': {
    category: 'guest',
    severity: 'info',
    targetType: 'guest_profile',
    summary: (c) => `${c.actorName} updated their guest profile`,
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  'analytics.review_regenerated': {
    category: 'property',
    severity: 'info',
    targetType: 'property_analytics_review',
    summary: (c) =>
      `${c.actorName} regenerated the AI Performance Review for ${label(c, 'a listing')}`,
  },

  // ── Security ─────────────────────────────────────────────────────────────
  'security.denied_destructive_action': {
    category: 'security',
    severity: 'warning',
    targetType: 'security',
    summary: (c) =>
      `${c.actorName} was denied a destructive action (${
        str(c.metadata, 'attempted_action') ?? 'unknown'
      })`,
  },

  // ── System / cron ────────────────────────────────────────────────────────
  'system.cron_run': {
    category: 'system',
    severity: 'info',
    targetType: 'cron',
    summary: (c) => str(c.metadata, 'message') ?? `${c.actorName} completed a scheduled job`,
  },
} as const satisfies Record<string, ActivityActionDef>;

export type ActivityAction = keyof typeof ACTIVITY_ACTION_CATALOG;

const FALLBACK_DEF: ActivityActionDef = {
  category: 'system',
  severity: 'info',
  targetType: 'unknown',
  summary: (c) => `${c.actorName} performed an action`,
};

// ─── Redaction ────────────────────────────────────────────────────────────────

/** Key fragments (case-insensitive substring match) whose values are never stored. */
export const REDACTED_KEYS: readonly string[] = [
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'auth_header',
  'access_token',
  'refresh_token',
  'session',
  'otp',
  'otp_code',
  'verification_code',
  'signature',
  'webhook_secret',
  'card_number',
  'cardnumber',
  'cvv',
  'cvc',
  'pan',
  'bank_account_number',
  'account_number',
  'routing_number',
  'iban',
  'ssn',
  'private_key',
];

const REDACTED_PLACEHOLDER = '[redacted]';
const MAX_STRING_LEN = 500;
const CHANGES_BYTE_CAP = 8 * 1024;
const METADATA_BYTE_CAP = 16 * 1024;

function keyIsRedacted(key: string): boolean {
  const k = key.toLowerCase();
  return REDACTED_KEYS.some((frag) => k.includes(frag));
}

function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at < 1) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const maskedLocal = `${local[0]}***`;
  const maskedDomain = dot > 0 ? `${domain[0]}***${domain.slice(dot)}` : `${domain[0]}***`;
  return `${maskedLocal}@${maskedDomain}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_LIKE_RE = /^\+?[\d\s().-]{7,}$/;
/** Key fragments that mark a value as a phone number → mask to last 4. */
const PHONE_KEY_HINTS = [
  'phone',
  'mobile',
  'contact_number',
  'contact_no',
  'tel',
  'whatsapp',
  'viber',
  'msisdn',
];

/** Mask obvious PII inside a scalar value. Email is always masked; digit runs
 * are masked only when the key looks like a phone number (so dates / ids /
 * amounts are left intact). */
function maskScalar(key: string, value: string): string {
  const trimmed = value.trim();
  if (EMAIL_RE.test(trimmed)) return maskEmail(trimmed);
  const k = key.toLowerCase();
  if (PHONE_KEY_HINTS.some((hint) => k.includes(hint)) && PHONE_LIKE_RE.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 5) return `••••${digits.slice(-4)}`;
  }
  return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…` : value;
}

/** Redact a value for storage. Key-based drop first, then value-based PII masking. */
export function redactValue(key: string, value: unknown, depth = 0): unknown {
  if (keyIsRedacted(key)) return REDACTED_PLACEHOLDER;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return maskScalar(key, value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 4) return '[nested]';
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(key, item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v, depth + 1);
    }
    return out;
  }
  return REDACTED_PLACEHOLDER;
}

// ─── diffRecord — independent of compareFormData ─────────────────────────────

function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
    } catch {
      return false;
    }
  }
  return false;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Field-level diff between two records. Pass `include` to restrict to an
 * allow-list (recommended — log intent, not every column). `redactKeys` adds
 * one-off keys to the central `REDACTED_KEYS` for this call.
 */
export function diffRecord(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  opts: { include?: string[]; exclude?: string[]; redactKeys?: string[] } = {}
): ActivityChange[] {
  const b = before ?? {};
  const a = after ?? {};
  const exclude = new Set(opts.exclude ?? []);
  const extraRedact = (opts.redactKeys ?? []).map((k) => k.toLowerCase());
  const fields = opts.include ?? [...new Set([...Object.keys(b), ...Object.keys(a)])];

  const changes: ActivityChange[] = [];
  for (const field of fields) {
    if (exclude.has(field)) continue;
    const fromRaw = b[field];
    const toRaw = a[field];
    if (stableEqual(fromRaw, toRaw)) continue;
    const forceRedact =
      keyIsRedacted(field) || extraRedact.some((frag) => field.toLowerCase().includes(frag));
    changes.push({
      field,
      from: forceRedact ? REDACTED_PLACEHOLDER : redactValue(field, fromRaw),
      to: forceRedact ? REDACTED_PLACEHOLDER : redactValue(field, toRaw),
    });
  }
  return changes;
}

// ─── Payload capping ─────────────────────────────────────────────────────────

function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Cap `changes` at ~8 KB serialized; returns the (possibly trimmed) list + flag. */
function capChanges(changes: ActivityChange[] | null | undefined): {
  changes: ActivityChange[] | null;
  truncated: boolean;
} {
  if (!changes || changes.length === 0) return { changes: null, truncated: false };
  if (byteLength(changes) <= CHANGES_BYTE_CAP) return { changes, truncated: false };
  const kept: ActivityChange[] = [];
  for (const change of changes) {
    kept.push({ field: change.field, from: '[omitted]', to: '[omitted]' });
    if (byteLength(kept) > CHANGES_BYTE_CAP) {
      kept.pop();
      break;
    }
  }
  return { changes: kept, truncated: true };
}

function capMetadata(metadata: Record<string, unknown>): {
  metadata: Record<string, unknown>;
  truncated: boolean;
} {
  if (byteLength(metadata) <= METADATA_BYTE_CAP) return { metadata, truncated: false };
  return {
    metadata: {
      note: 'metadata omitted (over size cap)',
      keys: Object.keys(metadata).slice(0, 40),
    },
    truncated: true,
  };
}

// ─── Request context ─────────────────────────────────────────────────────────

/** Truncate a client IP to /24 (v4) or /48 (v6). Never stores the full address. */
export function truncateIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0].trim();
  if (!first) return null;
  if (first.includes(':')) {
    const hextets = first.split(':').filter(Boolean);
    if (hextets.length < 2) return null;
    return `${hextets.slice(0, 3).join(':')}::/48`;
  }
  const octets = first.split('.');
  if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o))) return null;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

export function extractRequestContext(req?: Request | null): {
  ipPrefix: string | null;
  userAgent: string | null;
  requestId: string | null;
} {
  if (!req) return { ipPrefix: null, userAgent: null, requestId: null };
  const h = req.headers;
  const rawIp =
    h.get('cf-connecting-ip') ??
    h.get('x-real-ip') ??
    h.get('x-forwarded-for') ??
    h.get('fly-client-ip') ??
    null;
  const ua = h.get('user-agent');
  const requestId =
    h.get('x-request-id') ??
    h.get('x-correlation-id') ??
    h.get('sb-request-id') ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null);
  return {
    ipPrefix: truncateIp(rawIp),
    userAgent: ua ? ua.slice(0, 400) : null,
    requestId,
  };
}

// ─── buildActorContext ───────────────────────────────────────────────────────

type ActorSourceInput =
  | { orgAccess: OrgAccessContext }
  | { propertyAccess: PropertyAccessContext }
  | { parkingAccess: ParkingTeamAccessContext }
  | { admin: AdminUser }
  | { superAdmin: Pick<AuthenticatedUser, 'id' | 'email'> }
  | { cron: string }
  | { webhook: string }
  | { emailInbound: string }
  | { integration: string }
  | {
      assistant: {
        conversationId: string;
        userId?: string | null;
        email?: string | null;
        displayName?: string | null;
      };
    }
  | { guest: { email?: string | null; name?: string | null } }
  | {
      /** A verified signed-in user without a full access context (owner-only handlers). */
      authUser: Pick<AuthenticatedUser, 'id' | 'email'>;
      actorType?: ActivityActorType;
      role?: string;
      memberId?: string | null;
    }
  | { system: true };

function accessKindToActorType(
  kind: 'owner' | 'platform_admin' | 'org_admin' | 'property_member' | 'member'
): ActivityActorType {
  if (kind === 'owner') return 'org_owner';
  if (kind === 'platform_admin') return 'super_admin';
  return 'team_member';
}

/**
 * Normalize an actor from any auth context + extract IP / UA / request id from
 * the `Request`. `source` records the channel the action came through.
 */
export function buildActorContext(
  source: ActivitySource,
  input: ActorSourceInput,
  req?: Request | null
): ActorContext {
  const reqCtx = extractRequestContext(req);
  const base = {
    source,
    ipPrefix: reqCtx.ipPrefix,
    userAgent: reqCtx.userAgent,
    requestId: reqCtx.requestId,
  };

  if ('orgAccess' in input) {
    const ctx = input.orgAccess;
    return {
      ...base,
      actorType: accessKindToActorType(ctx.accessKind),
      userId: ctx.user.id,
      email: ctx.user.email,
      role: ctx.accessKind,
      memberId: ctx.memberId ?? null,
    };
  }
  if ('propertyAccess' in input) {
    const ctx = input.propertyAccess;
    return {
      ...base,
      actorType: accessKindToActorType(ctx.accessKind),
      userId: ctx.user.id,
      email: ctx.user.email,
      role: ctx.accessKind,
      memberId: ctx.memberId ?? null,
    };
  }
  if ('parkingAccess' in input) {
    const ctx = input.parkingAccess;
    return {
      ...base,
      actorType: accessKindToActorType(ctx.accessKind),
      userId: ctx.user.id,
      email: ctx.user.email,
      role: ctx.accessKind,
      memberId: ctx.memberId ?? null,
    };
  }
  if ('admin' in input) {
    return {
      ...base,
      actorType: 'team_member',
      userId: input.admin.id ?? null,
      email: input.admin.email ?? null,
      role: 'legacy_admin',
    };
  }
  if ('superAdmin' in input) {
    return {
      ...base,
      actorType: 'super_admin',
      userId: input.superAdmin.id ?? null,
      email: input.superAdmin.email ?? null,
      role: 'super_admin',
    };
  }
  if ('assistant' in input) {
    return {
      ...base,
      source: 'ai_assistant',
      actorType: 'ai_assistant',
      userId: input.assistant.userId ?? null,
      email: input.assistant.email ?? null,
      displayName: input.assistant.displayName ?? null,
      role: 'ai_assistant',
      extraMetadata: { assistant_conversation_id: input.assistant.conversationId },
    };
  }
  if ('cron' in input) {
    return { ...base, source: 'cron', actorType: 'cron', displayName: input.cron, role: 'cron' };
  }
  if ('webhook' in input) {
    return {
      ...base,
      source: 'webhook',
      actorType: 'webhook',
      displayName: input.webhook,
      role: 'webhook',
    };
  }
  if ('emailInbound' in input) {
    return {
      ...base,
      source: 'email_inbound',
      actorType: 'email_inbound',
      displayName: input.emailInbound,
      role: 'email_inbound',
    };
  }
  if ('integration' in input) {
    return {
      ...base,
      actorType: 'integration',
      displayName: input.integration,
      role: 'integration',
    };
  }
  if ('guest' in input) {
    return {
      ...base,
      actorType: 'guest',
      email: input.guest.email ? maskEmail(input.guest.email.trim()) : null,
      displayName: input.guest.name ? firstNameOnly(input.guest.name) : null,
      role: 'guest',
    };
  }
  if ('authUser' in input) {
    return {
      ...base,
      actorType: input.actorType ?? 'team_member',
      userId: input.authUser.id ?? null,
      email: input.authUser.email ?? null,
      role: input.role ?? null,
      memberId: input.memberId ?? null,
    };
  }
  return { ...base, actorType: 'system', role: 'system' };
}

function firstNameOnly(name: string): string {
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.length > 40 ? first.slice(0, 40) : first;
}

// ─── Row builder ─────────────────────────────────────────────────────────────

function actorDisplayName(actor: ActorContext): string {
  return (
    actor.displayName?.trim() ||
    actor.email?.trim() ||
    (actor.actorType === 'system'
      ? 'The system'
      : actor.actorType === 'cron'
        ? 'A scheduled job'
        : actor.actorType === 'webhook'
          ? 'An external service'
          : actor.actorType === 'ai_assistant'
            ? 'The AI assistant'
            : actor.actorType === 'guest' || actor.actorType === 'public'
              ? 'A guest'
              : 'A team member')
  );
}

function inferScope(input: LogActivityInput): ActivityScope {
  if (input.scope) return input.scope;
  if (input.parkingId) return 'parking';
  if (input.propertyId) return 'property';
  return 'org';
}

/**
 * Map a `LogActivityInput` to the `activity_log` row shape — resolves catalog
 * defaults, renders the summary, redacts + caps the payload. Exported for tests
 * and for callers that need the row without writing it.
 */
export function buildActivityRow(input: LogActivityInput): Record<string, unknown> {
  const def: ActivityActionDef = ACTIVITY_ACTION_CATALOG[input.action] ?? FALLBACK_DEF;
  const actorName = actorDisplayName(input.actor);
  const { changes, truncated: changesTruncated } = capChanges(input.changes ?? null);

  const mergedMeta: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    ...(input.actor.extraMetadata ?? {}),
  };
  if (changesTruncated) mergedMeta.changes_truncated = true;
  const { metadata, truncated: metaTruncated } = capMetadata(mergedMeta);
  if (metaTruncated) metadata.metadata_truncated = true;

  const summary =
    input.summary?.trim() ||
    def.summary({
      actorName,
      targetLabel: input.targetLabel ?? null,
      metadata: mergedMeta,
      changeCount: changes?.length ?? 0,
    });

  return {
    organization_id: input.organizationId,
    property_id: input.propertyId ?? null,
    parking_id: input.parkingId ?? null,
    scope: inferScope(input),
    actor_type: input.actor.actorType,
    actor_user_id: input.actor.userId ?? null,
    actor_email: input.actor.email ?? null,
    actor_display_name: input.actor.displayName ?? null,
    actor_role: input.actor.role ?? null,
    actor_member_id: input.actor.memberId ?? null,
    action: input.action,
    category: def.category,
    severity: input.severity ?? def.severity,
    target_type: input.targetType ?? def.targetType,
    target_id: input.targetId ?? null,
    target_label: input.targetLabel ?? null,
    summary,
    changes,
    metadata,
    request_id: input.actor.requestId ?? null,
    ip_prefix: input.actor.ipPrefix ?? null,
    user_agent: input.actor.userAgent ?? null,
    source: input.actor.source,
  };
}

// ─── Public writers ──────────────────────────────────────────────────────────

/** `EdgeRuntime.waitUntil` is a Supabase-provided global; not in Deno's lib types. */
function getWaitUntil(): ((p: Promise<unknown>) => void) | null {
  try {
    const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: unknown } }).EdgeRuntime;
    return typeof rt?.waitUntil === 'function'
      ? (rt.waitUntil as (p: Promise<unknown>) => void)
      : null;
  } catch {
    return null;
  }
}

async function insertRows(rows: Record<string, unknown>[]): Promise<void> {
  try {
    if (rows.length === 0) return;
    const supabase = createServiceClient();
    const { error } = await supabase.from('activity_log').insert(rows);
    if (error && error.code !== '23505') {
      console.error('[activityLog] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[activityLog] unexpected:', err instanceof Error ? err.message : err);
  }
}

/**
 * Write one activity row. Never throws. `await` inline by default; pass
 * `{ background: true }` only for non-critical `notice` events.
 */
export async function logActivity(
  input: LogActivityInput,
  options: LogActivityOptions = {}
): Promise<void> {
  let row: Record<string, unknown>;
  try {
    if (!input.organizationId) {
      // No org root → nothing to scope the row to. Skip silently (e.g. a legacy
      // admin surface with no resolvable org).
      return;
    }
    row = buildActivityRow(input);
  } catch (err) {
    console.error('[activityLog] row build failed:', err instanceof Error ? err.message : err);
    return;
  }

  const severity = row.severity as ActivitySeverity;
  const waitUntil = getWaitUntil();
  if (options.background && severity !== 'destructive' && severity !== 'warning' && waitUntil) {
    waitUntil(insertRows([row]));
    return;
  }
  await insertRows([row]);
}

/**
 * Write several rows in one INSERT. For bulk operations, prefer a SINGLE summary
 * row (`logActivity` with `metadata.count`) over one row per entity — use this
 * only when per-entity rows are genuinely needed.
 */
export async function logActivityBatch(inputs: LogActivityInput[]): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  for (const input of inputs) {
    try {
      if (!input.organizationId) continue;
      rows.push(buildActivityRow(input));
    } catch (err) {
      console.error(
        '[activityLog] batch row build failed:',
        err instanceof Error ? err.message : err
      );
    }
  }
  await insertRows(rows);
}
