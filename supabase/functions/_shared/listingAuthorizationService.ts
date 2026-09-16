/**
 * Listing authorization data access — resolve a property/parking row, authorize the caller,
 * and persist the listingAuthorization block. Shared by the submit / approve / reject functions.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import {
  createServiceClient,
  isPlatformAdmin,
  verifyAuthenticatedUser,
  type OrgRow,
} from './orgAuth.ts';
import { verifySuperAdminJwt } from './superAdminAuth.ts';
import {
  isListingKind,
  listingTableForKind,
  mergeListingAuthorizationIntoSettings,
  resolveListingAuthorization,
  type ListingAuthorizationState,
  type ListingKind,
} from './listingAuthorization.ts';

export type ListingRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
};

export type ListingContext = {
  listingKind: ListingKind;
  listing: ListingRow;
  org: OrgRow;
  authorization: ListingAuthorizationState;
};

function jsonResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Parse `listingKind` from a request body or search params. */
export function parseListingKind(value: unknown): ListingKind | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return isListingKind(trimmed) ? trimmed : null;
}

export async function loadListingContext(
  supabase: SupabaseClient,
  listingKind: ListingKind,
  listingId: string
): Promise<ListingContext> {
  const { data: listing, error } = await supabase
    .from(listingTableForKind(listingKind))
    .select('id, organization_id, name, slug, status, settings')
    .eq('id', listingId)
    .maybeSingle();

  if (error) {
    console.error('[listingAuthorizationService] listing lookup:', error.message);
    throw jsonResponse(500, 'Failed to load listing');
  }
  if (!listing) {
    throw jsonResponse(404, listingKind === 'parking' ? 'Parking not found' : 'Property not found');
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', listing.organization_id)
    .maybeSingle();

  if (orgError) {
    console.error('[listingAuthorizationService] org lookup:', orgError.message);
    throw jsonResponse(500, 'Failed to load organization');
  }
  if (!org) throw jsonResponse(404, 'Organization not found');

  const row = listing as ListingRow;
  return {
    listingKind,
    listing: row,
    org: org as OrgRow,
    authorization: resolveListingAuthorization(row.settings, (org as OrgRow).settings, listingKind),
  };
}

/** Owner of the listing's org (or platform admin). */
export async function verifyListingOwner(
  req: Request,
  listingKind: ListingKind,
  listingId: string
): Promise<ListingContext> {
  const user = await verifyAuthenticatedUser(req);
  const supabase = createServiceClient();
  const context = await loadListingContext(supabase, listingKind, listingId);

  if (context.org.owner_id !== user.id && !isPlatformAdmin(user.email)) {
    throw jsonResponse(403, 'Access restricted');
  }

  return context;
}

/** Super admin first, then fall back to the listing owner (used by the asset preview endpoint). */
export async function verifyListingReviewerOrOwner(
  req: Request,
  listingKind: ListingKind,
  listingId: string
): Promise<ListingContext> {
  try {
    await verifySuperAdminJwt(req);
    return await loadListingContext(createServiceClient(), listingKind, listingId);
  } catch (error) {
    if (error instanceof Response && error.status === 403) {
      return await verifyListingOwner(req, listingKind, listingId);
    }
    throw error;
  }
}

export async function saveListingAuthorization(
  supabase: SupabaseClient,
  context: ListingContext,
  next: ListingAuthorizationState
): Promise<ListingRow> {
  const { data, error } = await supabase
    .from(listingTableForKind(context.listingKind))
    .update({ settings: mergeListingAuthorizationIntoSettings(context.listing.settings, next) })
    .eq('id', context.listing.id)
    .select('id, organization_id, name, slug, status, settings')
    .single();

  if (error || !data) {
    console.error('[listingAuthorizationService] save:', error?.message);
    throw jsonResponse(500, 'Failed to save listing verification');
  }

  return data as ListingRow;
}

/** Payload shape returned by every listing authorization endpoint. */
export function serializeListingAuthorization(
  context: ListingContext,
  state: ListingAuthorizationState,
  listing: ListingRow = context.listing
) {
  return {
    listing: {
      id: listing.id,
      organizationId: listing.organization_id,
      listingKind: context.listingKind,
      name: listing.name,
      slug: listing.slug,
      status: listing.status,
    },
    authorization: {
      relationship: state.relationship,
      contractEndDate: state.contractEndDate,
      baseStatus: state.baseStatus,
      recommendedStatus: state.recommendedStatus,
      baseSubmittedAt: state.baseSubmittedAt,
      recommendedSubmittedAt: state.recommendedSubmittedAt,
      baseRejectionReason: state.baseRejectionReason,
      recommendedRejectionReason: state.recommendedRejectionReason,
      baseRejectionKind: state.baseRejectionKind,
      recommendedRejectionKind: state.recommendedRejectionKind,
      assets: { ...state.assets },
      lifecycle: state.lifecycle,
      recommendedBadge: state.recommendedStatus === 'approved',
    },
  };
}
