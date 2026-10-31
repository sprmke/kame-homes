/**
 * superAdminApprovalsQueue — shared loader for the unified super-admin approvals queue
 * (org verifications + listing verifications + external reviews). Used by
 * `list-super-admin-approvals` (paginated list) and `super-admin-overview` (pending count).
 */

import { createServiceClient } from './orgAuth.ts';
import {
  externalReviewImageStoragePath,
  normalizeExternalReviewsDraft,
  type ExternalReviewModerationStatus,
  type ExternalReviewSource,
} from './propertyExternalReviews.ts';
import { listListingVerificationApprovalRows } from './superAdminListingVerifications.ts';
import { listOrgVerificationApprovalRows } from './superAdminOrgVerifications.ts';

export type ExternalReviewApprovalRow = {
  type: 'external_review';
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  reviewId: string;
  source: ExternalReviewSource;
  reviewText: string;
  reviewerName: string;
  starRating: number | null;
  moderationStatus: ExternalReviewModerationStatus;
  submittedAt: string | null;
  imageUrl: string | null;
  stayPhotoUrls: string[];
  imagePath: string | null;
};

export type ApprovalRow =
  | Awaited<ReturnType<typeof listOrgVerificationApprovalRows>>[number]
  | Awaited<ReturnType<typeof listListingVerificationApprovalRows>>[number]
  | ExternalReviewApprovalRow;

export type ApprovalStatusFilter = 'all' | 'pending' | 'approved' | 'changes' | 'rejected';
export type ApprovalTypeFilter =
  'all' | 'property' | 'parking' | 'listing_verification' | 'reviews';

export function matchesApprovalTypeFilter(row: ApprovalRow, type: ApprovalTypeFilter): boolean {
  if (type === 'all') return true;
  if (type === 'reviews') return row.type === 'external_review';
  if (type === 'listing_verification') return row.type === 'listing_verification';
  if (row.type !== 'org_verification') return false;
  if (type === 'property') return row.hostModes.includes('property');
  if (type === 'parking') return row.hostModes.includes('parking');
  return true;
}

export function matchesApprovalStatusFilter(
  row: ApprovalRow,
  status: ApprovalStatusFilter
): boolean {
  if (status === 'all') return true;

  if (row.type === 'external_review') {
    if (status === 'changes') return false;
    return row.moderationStatus === status;
  }

  if (row.type === 'listing_verification') {
    const queuePending = row.baseStatus === 'pending' || row.recommendedStatus === 'pending';
    if (status === 'changes') {
      const baseChanges = row.baseStatus === 'rejected' && row.baseRejectionKind === 'changes';
      const recommendedChanges =
        row.recommendedStatus === 'rejected' && row.recommendedRejectionKind === 'changes';
      return baseChanges || recommendedChanges;
    }
    if (status === 'rejected') {
      const baseHard = row.baseStatus === 'rejected' && row.baseRejectionKind !== 'changes';
      const recommendedHard =
        row.recommendedStatus === 'rejected' && row.recommendedRejectionKind !== 'changes';
      return baseHard || recommendedHard;
    }
    if (status === 'pending') return queuePending;
    return row.baseStatus === status || row.recommendedStatus === status;
  }

  const queuePending = row.baseStatus === 'pending' || row.enhancedStatus === 'pending';
  if (status === 'changes') {
    return row.baseStatus === 'rejected' && row.baseRejectionKind === 'changes';
  }
  if (status === 'rejected') {
    const baseHard = row.baseStatus === 'rejected' && row.baseRejectionKind !== 'changes';
    const enhancedHard = row.enhancedStatus === 'rejected';
    return baseHard || enhancedHard;
  }
  if (status === 'pending') return queuePending;
  return row.baseStatus === status || row.enhancedStatus === status;
}

export function matchesApprovalSearch(row: ApprovalRow, search: string): boolean {
  if (!search) return true;

  if (row.type === 'external_review') {
    return [row.propertyName, row.organizationName, row.reviewText, row.reviewerName, row.source]
      .join(' ')
      .toLowerCase()
      .includes(search);
  }

  if (row.type === 'listing_verification') {
    return [row.listingName, row.organizationName, row.ownerName, row.ownerEmail, row.listingKind]
      .join(' ')
      .toLowerCase()
      .includes(search);
  }

  return [row.organizationName, row.ownerName, row.ownerEmail]
    .join(' ')
    .toLowerCase()
    .includes(search);
}

export async function listExternalReviewApprovalRows(): Promise<ExternalReviewApprovalRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select(
      'property_id, external_reviews, properties!inner(id, name, slug, organization_id, organizations!inner(id, name, slug))'
    );

  if (error) {
    console.error('[superAdminApprovalsQueue] app_settings:', error.message);
    throw new Error('Failed to load external reviews');
  }

  const rows: ExternalReviewApprovalRow[] = [];

  for (const row of data ?? []) {
    const property = row.properties as {
      id: string;
      name: string;
      slug: string;
      organization_id: string;
      organizations: { id: string; name: string; slug: string };
    } | null;
    if (!property?.organizations) continue;

    const propertyId = row.property_id as string;
    const reviews = normalizeExternalReviewsDraft(row.external_reviews);
    for (const review of reviews) {
      rows.push({
        type: 'external_review',
        propertyId,
        propertyName: property.name,
        propertySlug: property.slug,
        organizationId: property.organizations.id,
        organizationName: property.organizations.name,
        organizationSlug: property.organizations.slug,
        reviewId: review.id,
        source: review.source,
        reviewText: review.reviewText,
        reviewerName: review.reviewerName,
        starRating: review.starRating,
        moderationStatus: review.moderationStatus,
        submittedAt: review.createdAt,
        imageUrl: review.imageUrl,
        stayPhotoUrls: review.stayPhotoUrls,
        imagePath: externalReviewImageStoragePath(review.imageUrl, propertyId, review.id),
      });
    }
  }

  rows.sort((a, b) => {
    const aPending = a.moderationStatus === 'pending' ? 1 : 0;
    const bPending = b.moderationStatus === 'pending' ? 1 : 0;
    if (bPending !== aPending) return bPending - aPending;
    return (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '');
  });

  return rows;
}

type LoadApprovalQueueOptions = {
  type?: ApprovalTypeFilter;
  status?: ApprovalStatusFilter;
  search?: string;
  /** Restrict to one organization (Org hub). */
  organizationId?: string;
};

/** Merge + filter the three heterogeneous approval sources (no pagination). */
export async function loadApprovalQueue(
  options: LoadApprovalQueueOptions = {}
): Promise<ApprovalRow[]> {
  const type = options.type ?? 'all';
  const status = options.status ?? 'all';
  const search = (options.search ?? '').trim().toLowerCase();

  const needsOrg = type === 'all' || type === 'property' || type === 'parking';
  const needsListing = type === 'all' || type === 'listing_verification';
  const needsReviews = type === 'all' || type === 'reviews';
  const orgHostMode = type === 'property' || type === 'parking' ? type : undefined;

  const [orgVerifications, listingVerifications, externalReviews] = await Promise.all([
    needsOrg ? listOrgVerificationApprovalRows({ hostMode: orgHostMode }) : Promise.resolve([]),
    needsListing ? listListingVerificationApprovalRows() : Promise.resolve([]),
    needsReviews ? listExternalReviewApprovalRows() : Promise.resolve([]),
  ]);

  const merged: ApprovalRow[] = [...orgVerifications, ...listingVerifications, ...externalReviews];

  return merged.filter(
    (row) =>
      matchesApprovalTypeFilter(row, type) &&
      matchesApprovalStatusFilter(row, status) &&
      matchesApprovalSearch(row, search) &&
      (!options.organizationId || row.organizationId === options.organizationId)
  );
}

/** Cheap pending-approvals rollup for the Overview attention panel. */
export async function countPendingApprovals(organizationId?: string): Promise<{
  total: number;
  orgVerification: number;
  listingVerification: number;
  externalReview: number;
}> {
  const rows = await loadApprovalQueue({ status: 'pending', organizationId });
  let orgVerification = 0;
  let listingVerification = 0;
  let externalReview = 0;
  for (const row of rows) {
    if (row.type === 'org_verification') orgVerification += 1;
    else if (row.type === 'listing_verification') listingVerification += 1;
    else externalReview += 1;
  }
  return {
    total: rows.length,
    orgVerification,
    listingVerification,
    externalReview,
  };
}

/** Full queue rollup for the `/admin/approvals` summary cards (all statuses + pending count). */
export async function summarizeApprovalQueue(organizationId?: string): Promise<{
  total: number;
  pending: number;
  orgVerifications: number;
  listingVerifications: number;
  reviews: number;
}> {
  const rows = await loadApprovalQueue({ organizationId });
  let pending = 0;
  let orgVerifications = 0;
  let listingVerifications = 0;
  let reviews = 0;
  for (const row of rows) {
    if (matchesApprovalStatusFilter(row, 'pending')) pending += 1;
    if (row.type === 'org_verification') orgVerifications += 1;
    else if (row.type === 'listing_verification') listingVerifications += 1;
    else reviews += 1;
  }
  return { total: rows.length, pending, orgVerifications, listingVerifications, reviews };
}
