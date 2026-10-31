import { useMemo } from 'react';

import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useSavedOrgSettingsCompletion } from '@/features/dashboard/org/hooks/useOrgSettingsCompletion';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import {
  listingAuthorizationHasPrimaryProof,
  readListingAuthorizationSummary,
} from '@/features/dashboard/org/lib/listingAuthorization';
import { readOrgVerificationSummary } from '@/features/dashboard/org/lib/orgVerification';
import type { Organization, Parking, Property } from '@/features/dashboard/org/types';
import { useSetupGuideListingCompletions } from '@/features/dashboard/setup-guide/hooks/useSetupGuideListingCompletions';
import {
  deriveSetupGuideProgress,
  type SetupGuideCompletionSnapshot,
} from '@/features/dashboard/setup-guide/lib/setupGuideProgress';
import { readSetupGuidePersistedState } from '@/features/dashboard/setup-guide/lib/setupGuideState';
import { assembleSetupGuideSteps } from '@/features/dashboard/setup-guide/lib/setupGuideSteps';
import type {
  SetupGuideHostMode,
  SetupGuideProgressResult,
  SetupGuideStep,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

function hostModesFromOrg(org: Organization | null | undefined): SetupGuideHostMode[] {
  const raw = org?.hostModes ?? [];
  const modes: SetupGuideHostMode[] = [];
  for (const mode of raw) {
    if ((mode === 'property' || mode === 'parking') && !modes.includes(mode)) {
      modes.push(mode);
    }
  }
  // Infer from listings when hostModes is missing on older orgs.
  return modes.length > 0 ? modes : ['property', 'parking'];
}

function listingMissingTier1Proof(listing: { settings: Record<string, unknown> }): boolean {
  return !listingAuthorizationHasPrimaryProof(readListingAuthorizationSummary(listing.settings));
}

export type UseSetupGuideProgressArgs = {
  org: Organization | null | undefined;
  properties: Property[];
  parkings: Parking[];
  /** Overrides live org completion issues (tests / draft preview). */
  orgIssueSectionIds?: SetupGuideCompletionSnapshot['orgIssueSectionIds'];
  propertyIssueSectionIdsById?: SetupGuideCompletionSnapshot['propertyIssueSectionIdsById'];
  parkingIssueSectionIdsById?: SetupGuideCompletionSnapshot['parkingIssueSectionIdsById'];
};

/**
 * Assembles Setup Guide steps for the org's listings and derives progress.
 *
 * Property/parking section issues default to "all mapped sections open" until
 * Phase 2b controllers expose saved completion maps per listing id. Pass explicit
 * issue maps (e.g. from the active settings page) to refine a block.
 */
export function useSetupGuideProgress({
  org,
  properties,
  parkings,
  orgIssueSectionIds: orgIssueOverride,
  propertyIssueSectionIdsById: propertyIssuesOverride,
  parkingIssueSectionIdsById: parkingIssuesOverride,
}: UseSetupGuideProgressArgs): {
  steps: SetupGuideStep[];
  progress: SetupGuideProgressResult;
  persisted: ReturnType<typeof readSetupGuidePersistedState>;
} {
  const savedOrgCompletion = useSavedOrgSettingsCompletion();

  const steps = useMemo(
    () =>
      assembleSetupGuideSteps({
        hostModes: hostModesFromOrg(org),
        properties: properties.map((p) => ({ id: p.id, name: p.name })),
        parkings: parkings.map((p) => ({ id: p.id, name: p.name })),
      }),
    [org, properties, parkings]
  );

  const persisted = useMemo(
    () => readSetupGuidePersistedState(org?.settings ?? null),
    [org?.settings]
  );

  const progress = useMemo(() => {
    const verification = readOrgVerificationSummary(org?.settings ?? null);
    const hostTier1Submitted =
      verification.baseStatus === 'pending' || verification.baseStatus === 'approved';
    const recommendedSubmitted =
      verification.enhancedStatus === 'pending' || verification.enhancedStatus === 'approved';

    const listingIdsMissingTier1Proof = [
      ...properties.filter(listingMissingTier1Proof).map((p) => p.id),
      ...parkings.filter(listingMissingTier1Proof).map((p) => p.id),
    ];

    const propertyIssueSectionIdsById: SetupGuideCompletionSnapshot['propertyIssueSectionIdsById'] =
      propertyIssuesOverride ??
      Object.fromEntries(
        properties.map((p) => [
          p.id,
          [
            'basic',
            'details',
            'location',
            'media',
            'amenities',
            'house-rules',
            'cancellation',
            'payment',
            'guest-form',
            'building-forms',
            'email-automations',
          ] as const,
        ])
      );

    const parkingIssueSectionIdsById: SetupGuideCompletionSnapshot['parkingIssueSectionIdsById'] =
      parkingIssuesOverride ??
      Object.fromEntries(
        parkings.map((p) => [
          p.id,
          ['basic', 'details', 'location', 'media', 'features', 'payment'] as const,
        ])
      );

    return deriveSetupGuideProgress({
      steps,
      completion: {
        orgIssueSectionIds: orgIssueOverride ?? savedOrgCompletion.issueSectionIds,
        propertyIssueSectionIdsById,
        parkingIssueSectionIdsById,
        hostTier1Submitted,
        listingIdsMissingTier1Proof,
        recommendedSubmitted,
      },
      persisted: {
        skippedSteps: persisted.skippedSteps,
        reviewedSteps: persisted.reviewedSteps,
        lastStepId: persisted.lastStepId,
      },
    });
  }, [
    org,
    properties,
    parkings,
    steps,
    persisted.skippedSteps,
    persisted.reviewedSteps,
    savedOrgCompletion.issueSectionIds,
    orgIssueOverride,
    propertyIssuesOverride,
    parkingIssuesOverride,
  ]);

  return { steps, progress, persisted };
}

/** Convenience: resolve org + listings from slug and run progress. */
export function useSetupGuideProgressForOrgSlug(
  orgSlug: string | undefined,
  opts?: {
    /** Guide overlay open — listing settings fetch only while open. */
    guideOpen?: boolean;
    /** Active step id — only that listing's settings are fetched. */
    focusStepId?: string | null;
  }
) {
  const { data: orgsData } = useOrganizations();
  const { data: propertiesData } = useProperties(orgSlug);
  const { data: parkingsData } = useParkings(orgSlug);

  const org = useMemo(
    () => orgsData?.organizations.find((entry) => entry.slug === orgSlug) ?? null,
    [orgsData, orgSlug]
  );

  const properties = propertiesData?.properties ?? [];
  const parkings = parkingsData?.parkings ?? [];

  const focusPropertyIds = useMemo(() => {
    const stepId = opts?.focusStepId;
    if (!stepId?.startsWith('property.')) return [] as string[];
    const propertyId = stepId.split('.')[1];
    return propertyId ? [propertyId] : [];
  }, [opts?.focusStepId]);

  const focusParkingIds = useMemo(() => {
    const stepId = opts?.focusStepId;
    if (!stepId?.startsWith('parking.')) return [] as string[];
    const parkingId = stepId.split('.')[1];
    return parkingId ? [parkingId] : [];
  }, [opts?.focusStepId]);

  const { propertyIssueSectionIdsById, parkingIssueSectionIdsById } =
    useSetupGuideListingCompletions({
      org,
      properties,
      parkings,
      enabled: Boolean(opts?.guideOpen),
      focusPropertyIds,
      focusParkingIds,
    });

  const guide = useSetupGuideProgress({
    org,
    properties,
    parkings,
    propertyIssueSectionIdsById,
    parkingIssueSectionIdsById,
  });

  return { org, ...guide };
}
