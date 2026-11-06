/**
 * Client mirror of `supabase/functions/_shared/propertyLifecycleState.ts` plus the small
 * amount of presentation the listing-status UI needs.
 *
 * The server decides allowed actions and activation blocks. This file never re-derives them.
 */

import type { SemanticBadgeVariant } from '@/lib/statusToneColors';

export type PropertyLifecycleState =
  'pending_verification' | 'live' | 'paused' | 'suspended' | 'archived';

export type PropertyLifecycleAction = 'pause' | 'resume' | 'archive' | 'restore';

export type PropertyInactiveReason =
  | 'pending_verification'
  | 'paused'
  | 'contract_lapsed'
  | 'consideration_denied'
  | 'succession'
  | 'archived';

export type PropertyActivationBlock = {
  code:
    | 'listing_not_approved'
    | 'contract_locked'
    | 'pending_verification'
    | 'consideration_denied'
    | 'succession'
    | 'unit_taken';
  message: string;
};

export type PropertyLifecycle = {
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
  canDelete: boolean;
  acceptsNewBookings: boolean;
};

export type LifecycleBookingSummary = {
  id: string;
  status: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  guestName: string | null;
};

export type PropertyLifecycleImpact = {
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

export type PropertyLifecycleMutationResponse = {
  lifecycle: PropertyLifecycle;
  property: {
    id: string;
    status: string;
    inactiveReason: string | null;
    archivedAt: string | null;
    pausedAt: string | null;
  };
  impact: PropertyLifecycleImpact | null;
};

export const PROPERTY_LIFECYCLE_PRESENTATION: Record<
  PropertyLifecycleState,
  { label: string; variant: SemanticBadgeVariant; description: string }
> = {
  live: {
    label: 'Live',
    variant: 'success',
    description: 'Taking new bookings.',
  },
  paused: {
    label: 'Paused',
    variant: 'warning',
    description: 'Not taking new bookings. Guests with bookings keep their stay.',
  },
  pending_verification: {
    label: 'Pending verification',
    variant: 'pending',
    description: 'Waiting for approval before it can go live.',
  },
  suspended: {
    label: 'Suspended',
    variant: 'danger',
    description: 'Offline until the contract issue is resolved.',
  },
  archived: {
    label: 'Archived',
    variant: 'neutral',
    description: 'Retired. Records stay and automations are off.',
  },
};

/** Best effort client-side state read — the server DTO is authoritative when present. */
export function resolvePropertyLifecycleState(property: {
  status?: string | null;
  inactiveReason?: string | null;
}): PropertyLifecycleState {
  if (String(property.status ?? '').toUpperCase() === 'ACTIVE') return 'live';
  switch (property.inactiveReason) {
    case 'paused':
      return 'paused';
    case 'pending_verification':
      return 'pending_verification';
    case 'contract_lapsed':
    case 'consideration_denied':
    case 'succession':
      return 'suspended';
    default:
      return 'archived';
  }
}

export function lifecyclePresentation(state: PropertyLifecycleState) {
  return PROPERTY_LIFECYCLE_PRESENTATION[state];
}

/** States that keep a public page (see the server `stateHasPublicPage`). */
export function stateHasPublicPage(state: PropertyLifecycleState): boolean {
  return state === 'live' || state === 'paused';
}

/**
 * Paused vs archived vs delete, in plain words. Used by the "Compare options" dialog.
 */
export const PROPERTY_LIFECYCLE_OPTIONS: Array<{
  key: 'pause' | 'archive' | 'delete';
  title: string;
  summary: string;
  keeps: string;
  stops: string;
}> = [
  {
    key: 'pause',
    title: 'Pause',
    summary: 'Stop new bookings for a while.',
    keeps: 'Public page, guests with bookings, automations, billing.',
    stops: 'New bookings only.',
  },
  {
    key: 'archive',
    title: 'Archive',
    summary: 'Retire this property.',
    keeps: 'Records, past guests, and the listing name.',
    stops: 'New bookings, automations, and billing from the next cycle.',
  },
  {
    key: 'delete',
    title: 'Delete',
    summary: "Remove a property that has no records. This can't be undone.",
    keeps: 'Nothing.',
    stops: 'Everything.',
  },
];
