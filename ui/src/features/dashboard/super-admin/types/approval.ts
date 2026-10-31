import type { ConsiderationStatus } from '@/features/dashboard/org/lib/contractLifecycle';
import type {
  ListingAuthorizationRejectionKind,
  ListingAuthorizationStatus,
  ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import type {
  OrgVerificationRights,
  OrgVerificationStatus,
  OrgSocialProofPlatform,
} from '@/features/dashboard/org/lib/orgVerification';
import type { OrgVerificationRejectionKind } from '@/features/dashboard/org/lib/orgVerificationTiers';
import type {
  ExternalReviewModerationStatus,
  ExternalReviewSource,
} from '@/features/dashboard/org/lib/propertyExternalReviews';

/** ACTIVE peer listing at the same tower+unit (other org) — from list-org-verifications. */
export type OrgApprovalUnitConflict = {
  propertyId: string;
  organizationId: string;
  orgName: string;
  status: string;
  tower: string;
  unitNumber: string;
};

export type OrgApprovalSummary = {
  type: 'org_verification';
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  hostModes: string[];
  ownerName: string;
  ownerEmail: string;
  baseStatus: OrgVerificationStatus;
  baseSubmittedAt: string | null;
  baseRejectionReason: string | null;
  baseRejectionKind: OrgVerificationRejectionKind | null;
  enhancedStatus: OrgVerificationStatus;
  enhancedSubmittedAt: string | null;
  createdAt: string;
  unitConflicts: OrgApprovalUnitConflict[];
  hasActiveUnitConflict: boolean;
  propertyConsiderationStatus: ConsiderationStatus;
  parkingConsiderationStatus: ConsiderationStatus;
  hasPendingConsideration: boolean;
  propertyAccessLocked: boolean;
  parkingAccessLocked: boolean;
};

export type ListingVerificationApprovalSummary = {
  type: 'listing_verification';
  listingKind: ListingKind;
  listingId: string;
  listingName: string;
  listingSlug: string;
  listingStatus: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  ownerName: string;
  ownerEmail: string;
  relationship: OrgVerificationRights | null;
  contractEndDate: string | null;
  baseStatus: ListingAuthorizationStatus;
  baseSubmittedAt: string | null;
  baseRejectionReason: string | null;
  baseRejectionKind: ListingAuthorizationRejectionKind | null;
  recommendedStatus: ListingAuthorizationStatus;
  recommendedSubmittedAt: string | null;
  recommendedRejectionReason: string | null;
  recommendedRejectionKind: ListingAuthorizationRejectionKind | null;
  tower: string | null;
  unitNumber: string | null;
  unitConflicts: OrgApprovalUnitConflict[];
  hasActiveUnitConflict: boolean;
};

export type ExternalReviewApprovalSummary = {
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

export type ReportedReviewApprovalSummary = {
  type: 'reported_review';
  reportId: string;
  reviewKind: 'guest_review' | 'host_guest_review';
  reviewId: string;
  reason: string;
  details: string;
  reporterSide: 'host' | 'guest';
  moderationStatus: ExternalReviewModerationStatus;
  reviewText: string;
  starRating: number | null;
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  submittedAt: string | null;
  bookingId: string | null;
};

export type ApprovalQueueItem =
  | OrgApprovalSummary
  | ListingVerificationApprovalSummary
  | ExternalReviewApprovalSummary
  | ReportedReviewApprovalSummary;

export type SuperAdminApprovalTypeFilter =
  'all' | 'property' | 'parking' | 'listing_verification' | 'reviews';

export type OrgVerificationAssetUrls = {
  validIdUrl: string | null;
  socialProofUrl: string | null;
  platformAdminProofUrl: string | null;
  legitimacyCheckProofUrl: string | null;
  businessPermitOrBirUrl: string | null;
  propertyOwnershipProofUrl: string | null;
  parkingSocialProofUrl: string | null;
  selfieWithIdUrl: string | null;
  ownershipProofUrl: string | null;
  azurePmoConfirmationUrl: string | null;
  /** @deprecated use azurePmoConfirmationUrl */
  opsProofUrl?: string | null;
  pmoEmailUrls: (string | null)[];
};

export type OrgApprovalVerification = {
  baseStatus: OrgVerificationStatus;
  enhancedStatus: OrgVerificationStatus;
  socialPlatform: OrgSocialProofPlatform | null;
  platformAdminPlatform: OrgSocialProofPlatform | null;
  parkingSocialPlatform: OrgSocialProofPlatform | null;
  propertyRelationship: OrgVerificationRights | null;
  propertyContractEndDate: string | null;
  parkingRelationship: OrgVerificationRights | null;
  parkingContractEndDate: string | null;
  baseSubmittedAt: string | null;
  enhancedSubmittedAt: string | null;
  baseRejectionReason: string | null;
  enhancedRejectionReason: string | null;
  baseRejectionKind: OrgVerificationRejectionKind | null;
  enhancedRejectionKind: OrgVerificationRejectionKind | null;
};

export type OrgApprovalDetail = {
  organization: { id: string; name: string; slug: string; hostModes?: string[] };
  verification: OrgApprovalVerification;
  assetUrls: OrgVerificationAssetUrls;
};
