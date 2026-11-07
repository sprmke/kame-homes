/**
 * Property lifecycle — the only server-side authority for what a listing's status means.
 *
 * `properties.status` stays the single public-live flag (`ACTIVE` | `INACTIVE`).
 * `properties.inactive_reason` records *why* it is inactive, which is what the host UI,
 * the guest gates and the automation crons read instead of guessing.
 *
 * Host-facing states (see docs/workflow/in-progress/property-archive-and-delete-lifecycle.md):
 *   pending_verification  system created it, waiting for Tier 1 approval
 *   live                  publicly bookable
 *   paused                host paused new bookings, page stays up, everything else keeps working
 *   suspended             contract lapsed / extension denied / unit handed over
 *   archived              host retired it, off the bill from the next cycle
 *
 * Every status write goes through this module (host actions) or the exported
 * `system*` setters (contract cron, consideration decisions, unit handoff). Never write
 * `status` / `inactive_reason` from a caller.
 */

import { createServiceClient } from './orgAuth.ts';
import {
  readListingAuthorizationFromSettings,
  resolveListingActivationBlock,
  type ListingAuthorizationState,
} from './listingAuthorization.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import {
  asPropertyInactiveReason,
  automationAllowed,
  PROPERTY_INACTIVE_REASONS,
  PROPERTY_LIFECYCLE_ACTIONS,
  PROPERTY_LIFECYCLE_STATES,
  resolvePropertyLifecycleState,
  stateAcceptsNewBookings,
  inactiveReasonLabel,
  type PropertyAutomationJob,
  type PropertyInactiveReason,
  type PropertyLifecycleAction,
  type PropertyLifecycleState,
} from './propertyLifecycleState.ts';
import {
  DUPLICATE_TOWER_UNIT_MESSAGE,
  findPropertyTowerUnitConflict,
} from './propertyTowerUnit.ts';

export {
  automationAllowed,
  inactiveReasonLabel,
  PROPERTY_INACTIVE_REASONS,
  PROPERTY_LIFECYCLE_ACTIONS,
  PROPERTY_LIFECYCLE_STATES,
  resolvePropertyLifecycleState,
  stateAcceptsNewBookings,
  type PropertyAutomationJob,
  type PropertyInactiveReason,
  type PropertyLifecycleAction,
  type PropertyLifecycleState,
};

// ─── Model ───────────────────────────────────────────────────────────────────

/** Booking statuses that block archiving. Terminal history (CANCELLED/COMPLETED/IMPORTED) does not. */
export const ARCHIVE_BLOCKING_BOOKING_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
] as const;

export type LifecyclePropertyRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string | null;
  inactive_reason: string | null;
  archived_at: string | null;
  archived_by: string | null;
  paused_at: string | null;
  tower: string | null;
  unit_number: string | null;
  settings: Record<string, unknown> | null;
};

export type PropertyActivationBlockCode =
  | 'listing_not_approved'
  | 'contract_locked'
  | 'pending_verification'
  | 'consideration_denied'
  | 'succession'
  | 'unit_taken';

export type PropertyActivationBlock = {
  code: PropertyActivationBlockCode;
  message: string;
};

export class PropertyLifecycleError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, status = 409, code = 'LIFECYCLE_BLOCKED', details: unknown = null) {
    super(message);
    this.name = 'PropertyLifecycleError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asReason(value: unknown): PropertyInactiveReason | null {
  return asPropertyInactiveReason(value);
}

// ─── Activation ──────────────────────────────────────────────────────────────

export type HostActivationInput = {
  state: PropertyLifecycleState;
  inactiveReason: PropertyInactiveReason | null;
  /** Read straight from `properties.settings.listingAuthorization` (no org-leg fallback). */
  authorization: ListingAuthorizationState;
  /** Another ACTIVE listing holds the same tower + unit. */
  hasActiveUnitPeer: boolean;
};

/**
 * Whether a host may put this listing live. Mirrors the P0 hotfix in `update-property`:
 * the listing's own authorization block must be approved and its contract must not be locked.
 */
export function evaluateHostActivation(input: HostActivationInput): PropertyActivationBlock | null {
  if (input.state === 'live') return null;

  const activationBlock = resolveListingActivationBlock(input.authorization);
  if (activationBlock) {
    return {
      code:
        activationBlock.reason === 'contract_locked' ? 'contract_locked' : 'listing_not_approved',
      message: activationBlock.message,
    };
  }

  if (input.inactiveReason === 'pending_verification') {
    return {
      code: 'pending_verification',
      message: 'This listing is waiting for approval. It goes live once it is approved.',
    };
  }

  if (input.inactiveReason === 'consideration_denied') {
    return {
      code: 'consideration_denied',
      message:
        'The contract extension was declined. Submit a new contract before this listing can go live.',
    };
  }

  if (input.inactiveReason === 'succession' && input.hasActiveUnitPeer) {
    return {
      code: 'succession',
      message:
        'Another listing now uses this tower and unit. Change the unit to restore this property.',
    };
  }

  return null;
}

export function canHostActivate(input: HostActivationInput): boolean {
  return evaluateHostActivation(input) === null;
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

const DTO_COLUMNS =
  'id, organization_id, name, slug, status, inactive_reason, archived_at, archived_by, paused_at, tower, unit_number, settings';

export async function loadLifecycleProperty(propertyId: string): Promise<LifecyclePropertyRow> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select(DTO_COLUMNS)
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[propertyLifecycle] load property:', error.message);
    throw new PropertyLifecycleError('Could not load this property', 500, 'LOAD_FAILED');
  }
  if (!data) throw new PropertyLifecycleError('Property not found', 404, 'NOT_FOUND');
  return data as LifecyclePropertyRow;
}

/**
 * Bulk state lookup for crons: one query for a batch of properties, keyed by id.
 * Missing ids are simply absent from the map.
 */
export async function loadPropertyLifecycleStates(
  propertyIds: string[]
): Promise<Map<string, PropertyLifecycleState>> {
  const unique = Array.from(new Set(propertyIds.filter(Boolean)));
  const states = new Map<string, PropertyLifecycleState>();
  if (unique.length === 0) return states;

  const supabase = createServiceClient();
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('properties')
      .select('id, status, inactive_reason')
      .in('id', chunk)
      .limit(chunk.length);

    if (error) {
      console.error('[propertyLifecycle] bulk state lookup:', error.message);
      // Fail safe: treat unknown as not live so an automation does not run blind.
      for (const id of chunk) states.set(id, 'archived');
      continue;
    }

    for (const row of data ?? []) {
      states.set(
        String(row.id),
        resolvePropertyLifecycleState({
          status: (row.status as string | null) ?? null,
          inactive_reason: (row.inactive_reason as string | null) ?? null,
        })
      );
    }
  }

  return states;
}

/** Keep only the properties whose lifecycle state allows this automation. */
export async function filterLifecycleAllowedProperties(
  propertyIds: string[],
  job: PropertyAutomationJob
): Promise<string[]> {
  if (propertyIds.length === 0) return [];
  const states = await loadPropertyLifecycleStates(propertyIds);
  return propertyIds.filter((propertyId) =>
    automationAllowed(states.get(propertyId) ?? 'archived', job)
  );
}

export type PropertyLifecycleDto = {
  propertyId: string;
  name: string;
  slug: string;
  state: PropertyLifecycleState;
  inactiveReason: PropertyInactiveReason | null;
  inactiveReasonLabel: string | null;
  archivedAt: string | null;
  pausedAt: string | null;
  canHostActivate: boolean;
  activationBlock: PropertyActivationBlock | null;
  allowedActions: PropertyLifecycleAction[];
  /** Owner-only; the delete endpoint enforces it. */
  canDelete: boolean;
  acceptsNewBookings: boolean;
};

async function hasActiveUnitPeer(row: LifecyclePropertyRow): Promise<boolean> {
  const tower = row.tower?.trim();
  const unitNumber = row.unit_number?.trim();
  if (!tower || !unitNumber) return false;

  const { data, error } = await createServiceClient()
    .from('properties')
    .select('id, tower')
    .neq('id', row.id)
    .eq('status', 'ACTIVE')
    .eq('unit_number', unitNumber)
    .limit(20);

  if (error) {
    console.error('[propertyLifecycle] unit peer lookup:', error.message);
    return false;
  }

  const lowerTower = tower.toLowerCase();
  return (data ?? []).some(
    (peer) => typeof peer.tower === 'string' && peer.tower.trim().toLowerCase() === lowerTower
  );
}

export async function buildPropertyLifecycleDto(
  row: LifecyclePropertyRow,
  options: { canDelete?: boolean } = {}
): Promise<PropertyLifecycleDto> {
  const state = resolvePropertyLifecycleState(row);
  const inactiveReason = asReason(row.inactive_reason);
  const authorization = readListingAuthorizationFromSettings(row.settings);
  const activePeer = inactiveReason === 'succession' ? await hasActiveUnitPeer(row) : false;
  const activationBlock = evaluateHostActivation({
    state,
    inactiveReason,
    authorization,
    hasActiveUnitPeer: activePeer,
  });

  const allowedActions: PropertyLifecycleAction[] = [];
  if (state === 'live') allowedActions.push('pause', 'archive');
  if (state === 'paused') allowedActions.push('resume', 'archive');
  if (state === 'suspended') {
    // Archiving a suspended listing is always available; going live needs the cause fixed.
    allowedActions.push('archive');
    if (!activationBlock) allowedActions.push('restore');
  }
  if (state === 'archived' && !activationBlock) allowedActions.push('restore');

  return {
    propertyId: row.id,
    name: row.name,
    slug: row.slug,
    state,
    inactiveReason,
    inactiveReasonLabel: inactiveReasonLabel(inactiveReason),
    archivedAt: row.archived_at,
    pausedAt: row.paused_at,
    canHostActivate: activationBlock === null,
    activationBlock,
    allowedActions,
    canDelete: Boolean(options.canDelete),
    acceptsNewBookings: stateAcceptsNewBookings(state),
  };
}

// ─── Impact ──────────────────────────────────────────────────────────────────

export type LifecycleBookingSummary = {
  id: string;
  status: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  guestName: string | null;
};

export type PropertyLifecycleImpactDto = {
  propertyId: string;
  state: PropertyLifecycleState;
  bookings: {
    blocking: LifecycleBookingSummary[];
    blockingCount: number;
    upcoming: number;
    inHouse: number;
    pendingSdRefunds: number;
    history: number;
  };
  cancellationRequestsOpen: number;
  refundsOpen: number;
  calendar: { importFeeds: number; exportEnabled: boolean };
  marketing: { scheduledPosts: number };
  team: { members: number; pendingInvitations: number };
  subscription: { billed: boolean };
  deleteBlockers: {
    total: number;
    bookings: number;
    finance: number;
    maintenance: number;
    importBatches: number;
  };
  cascade: {
    inboxThreads: number;
    reviews: number;
    paymentTransactions: number;
    marketingRecords: number;
  };
};

type CountResponse = { count: number | null; error: { message: string } | null };

/** Count helper for a Supabase `head: true` query; logs and returns 0 on failure. */
async function settleCount(label: string, query: PromiseLike<CountResponse>): Promise<number> {
  const { count, error } = await query;
  if (error) {
    console.error(`[propertyLifecycle] count ${label}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Guest dates are stored `MM-DD-YYYY`; convert to `YYYY-MM-DD` for comparisons. */
export function guestDateToYmd(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const mdy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw);
  if (!mdy) return null;
  return `${mdy[3]}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`;
}

function guestDisplayName(row: Record<string, unknown>): string | null {
  const name =
    (typeof row.primary_guest_name === 'string' && row.primary_guest_name.trim()) ||
    (typeof row.guest_facebook_name === 'string' && row.guest_facebook_name.trim()) ||
    '';
  return name || null;
}

function toBookingSummary(row: Record<string, unknown>): LifecycleBookingSummary {
  return {
    id: String(row.id),
    status: String(row.status ?? ''),
    checkInDate: guestDateToYmd(row.check_in_date as string | null),
    checkOutDate: guestDateToYmd(row.check_out_date as string | null),
    guestName: guestDisplayName(row),
  };
}

/** Used by the archive pre-check and its post-write re-check. */
export async function listArchiveBlockers(propertyId: string): Promise<{
  blocking: LifecycleBookingSummary[];
  cancellationRequestsOpen: number;
  refundsOpen: number;
}> {
  const supabase = createServiceClient();
  const [bookings, cancellationRequests, refunds] = await Promise.all([
    supabase
      .from('guest_submissions')
      .select('id, status, check_in_date, check_out_date, primary_guest_name, guest_facebook_name')
      .eq('property_id', propertyId)
      .in('status', ARCHIVE_BLOCKING_BOOKING_STATUSES)
      .order('check_in_date', { ascending: true })
      .limit(1000),
    supabase
      .from('booking_cancellation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'open'),
    supabase
      .from('booking_refunds')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .in('status', ['awaiting_guest_details', 'pending']),
  ]);

  if (bookings.error) {
    console.error('[propertyLifecycle] archive blockers:', bookings.error.message);
    throw new PropertyLifecycleError(
      'Could not check this property for open stays',
      500,
      'IMPACT_FAILED'
    );
  }

  return {
    blocking: ((bookings.data ?? []) as Array<Record<string, unknown>>).map(toBookingSummary),
    cancellationRequestsOpen: cancellationRequests.count ?? 0,
    refundsOpen: refunds.count ?? 0,
  };
}

function archiveBlockedError(input: {
  blocking: LifecycleBookingSummary[];
  cancellationRequestsOpen: number;
  refundsOpen: number;
}): PropertyLifecycleError | null {
  const hasBookings = input.blocking.length > 0;
  const hasOpen = input.cancellationRequestsOpen > 0 || input.refundsOpen > 0;
  if (!hasBookings && !hasOpen) return null;

  return new PropertyLifecycleError(
    hasBookings
      ? 'Finish or cancel these bookings first.'
      : 'Finish open refunds and requests first.',
    409,
    'ARCHIVE_BLOCKED',
    input
  );
}

export async function getPropertyLifecycleImpact(
  propertyId: string
): Promise<PropertyLifecycleImpactDto> {
  const row = await loadLifecycleProperty(propertyId);
  const state = resolvePropertyLifecycleState(row);
  const supabase = createServiceClient();
  const todayYmd = manilaTodayYmd();

  const [
    blockers,
    history,
    cancellationRequestsOpen,
    refundsOpen,
    importFeeds,
    exportRow,
    scheduledPosts,
    teamMembers,
    pendingInvitations,
    subscriptionSlot,
    finance,
    maintenance,
    importBatches,
    importRows,
    inboxThreads,
    reviews,
    paymentTransactions,
    marketingRecords,
  ] = await Promise.all([
    supabase
      .from('guest_submissions')
      .select('id, status, check_in_date, check_out_date, primary_guest_name, guest_facebook_name')
      .eq('property_id', propertyId)
      .in('status', ARCHIVE_BLOCKING_BOOKING_STATUSES)
      .order('check_in_date', { ascending: true })
      .limit(1000),
    settleCount(
      'booking history',
      supabase
        .from('guest_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'open cancellation requests',
      supabase
        .from('booking_cancellation_requests')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('status', 'open')
    ),
    settleCount(
      'open refunds',
      supabase
        .from('booking_refunds')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .in('status', ['awaiting_guest_details', 'pending'])
    ),
    settleCount(
      'import feeds',
      supabase
        .from('property_calendar_feeds')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('is_active', true)
    ),
    supabase
      .from('property_calendar_export')
      .select('is_enabled')
      .eq('property_id', propertyId)
      .maybeSingle(),
    settleCount(
      'scheduled posts',
      supabase
        .from('marketing_publications')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('status', 'pending')
        .not('scheduled_at', 'is', null)
    ),
    settleCount(
      'team members',
      supabase
        .from('property_members')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('status', 'active')
    ),
    settleCount(
      'pending invitations',
      supabase
        .from('property_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('status', 'pending')
    ),
    supabase
      .from('org_subscription_properties')
      .select('id')
      .eq('property_id', propertyId)
      .maybeSingle(),
    settleCount(
      'finance entries',
      supabase
        .from('finance_line_items')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'maintenance items',
      supabase
        .from('maintenance_items')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'import batches',
      supabase
        .from('import_batches')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'import batch rows',
      supabase
        .from('import_batch_rows')
        .select('id', { count: 'exact', head: true })
        .eq('resolved_property_id', propertyId)
    ),
    settleCount(
      'inbox threads',
      supabase
        .from('social_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'reviews',
      supabase
        .from('guest_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'payment transactions',
      supabase
        .from('property_payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
    settleCount(
      'marketing records',
      supabase
        .from('marketing_publications')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
    ),
  ]);

  if (blockers.error) {
    console.error('[propertyLifecycle] blocking bookings:', blockers.error.message);
    throw new PropertyLifecycleError('Could not check this property', 500, 'IMPACT_FAILED');
  }

  const blockingRows = (blockers.data ?? []) as Array<Record<string, unknown>>;
  const blocking = blockingRows.map(toBookingSummary);

  let upcoming = 0;
  let inHouse = 0;
  for (const booking of blocking) {
    if (!booking.checkInDate) continue;
    if (booking.checkInDate > todayYmd) upcoming += 1;
    else if (!booking.checkOutDate || booking.checkOutDate >= todayYmd) inHouse += 1;
  }

  const pendingSdRefunds = blockingRows.filter(
    (booking) => String(booking.status) === 'PENDING_SD_REFUND'
  ).length;
  const importBatchTotal = importBatches + importRows;

  return {
    propertyId,
    state,
    bookings: {
      blocking,
      blockingCount: blocking.length,
      upcoming,
      inHouse,
      pendingSdRefunds,
      history,
    },
    cancellationRequestsOpen,
    refundsOpen,
    calendar: {
      importFeeds,
      exportEnabled: exportRow.data?.is_enabled === true,
    },
    marketing: { scheduledPosts },
    team: { members: teamMembers, pendingInvitations },
    subscription: { billed: Boolean(subscriptionSlot.data) },
    deleteBlockers: {
      total: history + finance + maintenance + importBatchTotal,
      bookings: history,
      finance,
      maintenance,
      importBatches: importBatchTotal,
    },
    cascade: {
      inboxThreads,
      reviews,
      paymentTransactions,
      marketingRecords,
    },
  };
}

// ─── Host actions ────────────────────────────────────────────────────────────

export type PropertyLifecycleActionResult = {
  property: LifecyclePropertyRow;
  previousState: PropertyLifecycleState;
  state: PropertyLifecycleState;
};

function assertState(
  state: PropertyLifecycleState,
  allowed: PropertyLifecycleState[],
  action: PropertyLifecycleAction
): void {
  if (allowed.includes(state)) return;
  const verb =
    action === 'pause'
      ? 'paused'
      : action === 'resume'
        ? 'resumed'
        : action === 'archive'
          ? 'archived'
          : 'restored';
  throw new PropertyLifecycleError(
    `This property can't be ${verb} right now.`,
    409,
    'WRONG_STATE',
    { state, action }
  );
}

async function assertUnitIsFree(row: LifecyclePropertyRow): Promise<void> {
  const tower = row.tower?.trim() ?? '';
  const unitNumber = row.unit_number?.trim() ?? '';
  if (!tower || !unitNumber) return;

  try {
    const conflict = await findPropertyTowerUnitConflict(
      createServiceClient(),
      tower,
      unitNumber,
      row.id
    );
    if (conflict) {
      throw new PropertyLifecycleError(DUPLICATE_TOWER_UNIT_MESSAGE, 409, 'unit_taken');
    }
  } catch (error) {
    if (error instanceof PropertyLifecycleError) throw error;
    throw new PropertyLifecycleError('Could not check this unit', 500, 'CHECK_FAILED');
  }
}

async function stopArchivedAutomations(propertyId: string): Promise<void> {
  const supabase = createServiceClient();
  const [feeds, exportRow, publications] = await Promise.all([
    supabase
      .from('property_calendar_feeds')
      .update({ is_active: false })
      .eq('property_id', propertyId)
      .eq('is_active', true),
    supabase
      .from('property_calendar_export')
      .update({ is_enabled: false })
      .eq('property_id', propertyId),
    supabase
      .from('marketing_publications')
      .update({ status: 'failed', error_message: 'Property archived' })
      .eq('property_id', propertyId)
      .eq('status', 'pending'),
  ]);

  for (const [label, result] of [
    ['import feeds', feeds],
    ['ical export', exportRow],
    ['scheduled posts', publications],
  ] as const) {
    if (result.error) {
      console.warn(`[propertyLifecycle] stop ${label}:`, result.error.message);
    }
  }
}

export async function pauseProperty(propertyId: string): Promise<PropertyLifecycleActionResult> {
  const row = await loadLifecycleProperty(propertyId);
  const previousState = resolvePropertyLifecycleState(row);
  if (previousState === 'paused') {
    return { property: row, previousState, state: 'paused' };
  }
  assertState(previousState, ['live'], 'pause');

  const { error } = await createServiceClient()
    .from('properties')
    .update({
      status: 'INACTIVE',
      inactive_reason: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
    .eq('status', 'ACTIVE');

  if (error) {
    console.error('[propertyLifecycle] pause:', error.message);
    throw new PropertyLifecycleError('Could not pause this property', 500, 'WRITE_FAILED');
  }

  const property = await loadLifecycleProperty(propertyId);
  return { property, previousState, state: resolvePropertyLifecycleState(property) };
}

export async function resumeProperty(propertyId: string): Promise<PropertyLifecycleActionResult> {
  const row = await loadLifecycleProperty(propertyId);
  const previousState = resolvePropertyLifecycleState(row);
  if (previousState === 'live') {
    return { property: row, previousState, state: 'live' };
  }
  assertState(previousState, ['paused'], 'resume');

  const activationBlock = evaluateHostActivation({
    state: previousState,
    inactiveReason: asReason(row.inactive_reason),
    authorization: readListingAuthorizationFromSettings(row.settings),
    hasActiveUnitPeer: false,
  });
  if (activationBlock) {
    throw new PropertyLifecycleError(activationBlock.message, 409, activationBlock.code);
  }

  await assertUnitIsFree(row);

  const { error } = await createServiceClient()
    .from('properties')
    .update({ status: 'ACTIVE', inactive_reason: null, paused_at: null })
    .eq('id', propertyId)
    .eq('inactive_reason', 'paused');

  if (error) {
    if (error.code === '23505') {
      throw new PropertyLifecycleError(DUPLICATE_TOWER_UNIT_MESSAGE, 409, 'unit_taken');
    }
    console.error('[propertyLifecycle] resume:', error.message);
    throw new PropertyLifecycleError('Could not resume this property', 500, 'WRITE_FAILED');
  }

  const property = await loadLifecycleProperty(propertyId);
  return { property, previousState, state: resolvePropertyLifecycleState(property) };
}

export async function archiveProperty(
  propertyId: string,
  actorId: string | null
): Promise<PropertyLifecycleActionResult> {
  const row = await loadLifecycleProperty(propertyId);
  const previousState = resolvePropertyLifecycleState(row);
  if (previousState === 'archived') {
    return { property: row, previousState, state: 'archived' };
  }
  assertState(previousState, ['live', 'paused', 'suspended'], 'archive');

  const before = await listArchiveBlockers(propertyId);
  const blocked = archiveBlockedError(before);
  if (blocked) throw blocked;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('properties')
    .update({
      status: 'INACTIVE',
      inactive_reason: 'archived',
      archived_at: new Date().toISOString(),
      archived_by: actorId,
      paused_at: null,
    })
    .eq('id', propertyId)
    // `NULL <> 'archived'` is NULL, so `neq` alone would skip a live row. Match both.
    .or('inactive_reason.is.null,inactive_reason.neq.archived');

  if (error) {
    console.error('[propertyLifecycle] archive:', error.message);
    throw new PropertyLifecycleError('Could not archive this property', 500, 'WRITE_FAILED');
  }

  // Re-check after the write: a guest submit or an in-flight OTA import can land between the
  // pre-check and this update. Rolling back keeps "no stays on an archived listing" true.
  const after = await listArchiveBlockers(propertyId);
  const raced = archiveBlockedError(after);
  if (raced) {
    const { error: revertError } = await supabase
      .from('properties')
      .update({
        status: row.status,
        inactive_reason: row.inactive_reason,
        archived_at: row.archived_at,
        archived_by: row.archived_by,
        paused_at: row.paused_at,
      })
      .eq('id', propertyId)
      .eq('inactive_reason', 'archived');

    if (revertError) {
      console.error('[propertyLifecycle] archive rollback failed:', revertError.message);
    }
    throw raced;
  }

  await stopArchivedAutomations(propertyId);

  try {
    // Imported lazily: billing helpers pull a heavy dependency graph that crons do not need
    // just to read a lifecycle state.
    const { removePropertyFromOrgSubscription } = await import('./planEntitlements.ts');
    await removePropertyFromOrgSubscription(propertyId, actorId);
  } catch (error) {
    // Billing cleanup must never undo a committed archive.
    console.warn(
      '[propertyLifecycle] subscription unslot failed:',
      error instanceof Error ? error.message : error
    );
  }

  const property = await loadLifecycleProperty(propertyId);
  return { property, previousState, state: resolvePropertyLifecycleState(property) };
}

export async function restoreProperty(propertyId: string): Promise<PropertyLifecycleActionResult> {
  const row = await loadLifecycleProperty(propertyId);
  const previousState = resolvePropertyLifecycleState(row);
  if (previousState === 'live') {
    return { property: row, previousState, state: 'live' };
  }
  assertState(previousState, ['archived', 'suspended'], 'restore');

  const activationBlock = evaluateHostActivation({
    state: previousState,
    inactiveReason: asReason(row.inactive_reason),
    authorization: readListingAuthorizationFromSettings(row.settings),
    hasActiveUnitPeer: await hasActiveUnitPeer(row),
  });
  if (activationBlock) {
    throw new PropertyLifecycleError(activationBlock.message, 409, activationBlock.code);
  }

  await assertUnitIsFree(row);

  const { error } = await createServiceClient()
    .from('properties')
    .update({
      status: 'ACTIVE',
      inactive_reason: null,
      archived_at: null,
      archived_by: null,
      paused_at: null,
    })
    .eq('id', propertyId);

  if (error) {
    if (error.code === '23505') {
      throw new PropertyLifecycleError(DUPLICATE_TOWER_UNIT_MESSAGE, 409, 'unit_taken');
    }
    console.error('[propertyLifecycle] restore:', error.message);
    throw new PropertyLifecycleError('Could not restore this property', 500, 'WRITE_FAILED');
  }

  try {
    const { autoEnrollPropertyInOrgSubscription } = await import('./planEntitlements.ts');
    await autoEnrollPropertyInOrgSubscription(row.organization_id, propertyId, null);
  } catch (error) {
    console.warn(
      '[propertyLifecycle] subscription reslot failed:',
      error instanceof Error ? error.message : error
    );
  }

  const property = await loadLifecycleProperty(propertyId);
  return { property, previousState, state: resolvePropertyLifecycleState(property) };
}

// ─── System setters (contract cron, unit handoff, approvals) ─────────────────

/** Contract lapsed / locked. Never overrides an archived listing. */
export async function systemSuspendProperty(
  propertyId: string,
  reason: Extract<
    PropertyInactiveReason,
    'contract_lapsed' | 'consideration_denied'
  > = 'contract_lapsed'
): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .update({ status: 'INACTIVE', inactive_reason: reason, paused_at: null })
    .eq('id', propertyId)
    // Live rows have a NULL reason, so `neq` alone would miss them.
    .or('inactive_reason.is.null,inactive_reason.neq.archived')
    .select('id')
    .limit(1);

  if (error) {
    console.error('[propertyLifecycle] system suspend:', error.message);
    throw new Error('Failed to suspend listing');
  }
  return (data?.length ?? 0) > 0;
}

/** Unit handed to another listing. */
export async function systemArchivePropertyForSuccession(propertyId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .update({ status: 'INACTIVE', inactive_reason: 'succession', paused_at: null })
    .eq('id', propertyId)
    .eq('status', 'ACTIVE')
    .select('id')
    .limit(1);

  if (error) {
    console.error('[propertyLifecycle] succession archive:', error.message);
    throw new Error('Failed to archive peer property for unit handoff');
  }
  return (data?.length ?? 0) > 0;
}

/** Listing approved — clear the inactive reason when the listing becomes live. */
export async function systemActivateProperty(propertyId: string): Promise<void> {
  const { error } = await createServiceClient()
    .from('properties')
    .update({
      status: 'ACTIVE',
      inactive_reason: null,
      archived_at: null,
      archived_by: null,
      paused_at: null,
    })
    .eq('id', propertyId);

  if (error) {
    console.error('[propertyLifecycle] system activate:', error.message);
    throw new Error('Failed to activate listing');
  }
}

/** Public new-booking gate used by `submit-form` and friends. */
export async function assertPropertyAcceptsNewBookings(propertyId: string): Promise<void> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('status, inactive_reason')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[propertyLifecycle] new-booking gate:', error.message);
    throw new Error('Could not check this property. Try again in a moment.');
  }

  const state = resolvePropertyLifecycleState({
    status: (data?.status as string | null) ?? null,
    inactive_reason: (data?.inactive_reason as string | null) ?? null,
  });
  if (!stateAcceptsNewBookings(state)) {
    throw new PropertyLifecycleError(
      "This place isn't taking new bookings right now.",
      409,
      'PROPERTY_NOT_ACCEPTING_BOOKINGS',
      { state }
    );
  }
}
