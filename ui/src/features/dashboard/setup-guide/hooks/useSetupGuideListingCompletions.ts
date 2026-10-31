import { useMemo } from 'react';

import { useQueries, useQueryClient } from '@tanstack/react-query';

import {
  appSettingsToFormValues,
  type AppSettingsDto,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import {
  computePropertySettingsCompletion,
  type PropertySettingsSectionId,
} from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { propertyProfileDraftFromProperty } from '@/features/dashboard/org/lib/propertySettingsForm';
import type { Organization, Parking, Property } from '@/features/dashboard/org/types';
import {
  PARKING_SETTINGS_QUERY_KEY,
  type ParkingSettingsPayload,
} from '@/features/dashboard/parking/hooks/useParkingSettings';
import { parkingFeaturesDraftFromSettings } from '@/features/dashboard/parking/lib/parkingFeaturesConstants';
import {
  computeParkingSettingsCompletion,
  type ParkingSettingsSectionId,
} from '@/features/dashboard/parking/lib/parkingSettingsCompletion';
import {
  parkingCoverImageFromSettings,
  parkingDetailsDraftFromSettings,
  parkingLocationDraftFromSettings,
  parkingOperationalDraftFromSettings,
  parkingProfileDraftFromParking,
} from '@/features/dashboard/parking/lib/parkingSettingsForm';
import type { SetupGuideCompletionSnapshot } from '@/features/dashboard/setup-guide/lib/setupGuideProgress';

const PROPERTY_PENDING_SECTIONS = [
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
] as const;

const PARKING_PENDING_SECTIONS = [
  'basic',
  'details',
  'location',
  'media',
  'features',
  'payment',
] as const;

async function fetchAppSettings(propertyId: string): Promise<AppSettingsDto> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('/app-settings', propertyId), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: AppSettingsDto;
  };
  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load app settings');
  }
  return json.data;
}

async function fetchParkingSettings(parkingId: string): Promise<ParkingSettingsPayload> {
  const params = new URLSearchParams({ parking_id: parkingId });
  return callEdgeFunction<ParkingSettingsPayload>(`parking-settings?${params.toString()}`);
}

/**
 * Live per-listing issue maps for Setup Guide progress.
 *
 * Only network-fetches the focused listing(s) while the guide is open. Other listings
 * reuse React Query cache when present; otherwise they stay pending so we never fan out
 * N app-settings / parking-settings calls for every listing on org mount.
 */
export function useSetupGuideListingCompletions({
  org,
  properties,
  parkings,
  enabled,
  focusPropertyIds,
  focusParkingIds,
}: {
  org: Organization | null | undefined;
  properties: Property[];
  parkings: Parking[];
  /** When false, no listing settings are fetched (cache still read). */
  enabled: boolean;
  focusPropertyIds: readonly string[];
  focusParkingIds: readonly string[];
}): Pick<
  SetupGuideCompletionSnapshot,
  'propertyIssueSectionIdsById' | 'parkingIssueSectionIdsById'
> {
  const queryClient = useQueryClient();
  const { data: orgSettings } = useOrgSettings();
  const inheritedBrandColor = useOrgBrandColor();

  const orgSocialLinks = useMemo(
    () =>
      orgSettings
        ? {
            facebookPageUrl: orgSettings.facebookPageUrl,
            airbnbUrl: orgSettings.airbnbUrl,
            instagramUrl: orgSettings.instagramUrl,
            tiktokUrl: orgSettings.tiktokUrl,
          }
        : null,
    [orgSettings]
  );

  const focusPropertySet = useMemo(() => new Set(focusPropertyIds), [focusPropertyIds]);
  const focusParkingSet = useMemo(() => new Set(focusParkingIds), [focusParkingIds]);

  const propertiesToFetch = useMemo(
    () => (enabled ? properties.filter((property) => focusPropertySet.has(property.id)) : []),
    [enabled, focusPropertySet, properties]
  );
  const parkingsToFetch = useMemo(
    () => (enabled ? parkings.filter((parking) => focusParkingSet.has(parking.id)) : []),
    [enabled, focusParkingSet, parkings]
  );

  const propertyQueries = useQueries({
    queries: propertiesToFetch.map((property) => ({
      queryKey: ['app-settings', property.id],
      queryFn: () => fetchAppSettings(property.id),
      enabled: Boolean(org?.id && property.id),
      staleTime: 60_000,
    })),
  });

  const parkingQueries = useQueries({
    queries: parkingsToFetch.map((parking) => ({
      queryKey: [...PARKING_SETTINGS_QUERY_KEY, parking.id],
      queryFn: () => fetchParkingSettings(parking.id),
      enabled: Boolean(org?.id && parking.id),
      staleTime: 60_000,
    })),
  });

  const propertyDataById = useMemo(() => {
    const map = new Map<string, AppSettingsDto>();
    for (const [index, property] of propertiesToFetch.entries()) {
      const data = propertyQueries[index]?.data;
      if (data) map.set(property.id, data);
    }
    return map;
  }, [propertiesToFetch, propertyQueries]);

  const parkingDataById = useMemo(() => {
    const map = new Map<string, ParkingSettingsPayload>();
    for (const [index, parking] of parkingsToFetch.entries()) {
      const data = parkingQueries[index]?.data;
      if (data) map.set(parking.id, data);
    }
    return map;
  }, [parkingsToFetch, parkingQueries]);

  return useMemo(() => {
    const propertyIssueSectionIdsById: Record<string, readonly PropertySettingsSectionId[]> = {};
    for (const property of properties) {
      const appSettings =
        propertyDataById.get(property.id) ??
        queryClient.getQueryData<AppSettingsDto>(['app-settings', property.id]) ??
        null;
      if (!appSettings) {
        propertyIssueSectionIdsById[property.id] = PROPERTY_PENDING_SECTIONS;
        continue;
      }
      propertyIssueSectionIdsById[property.id] = computePropertySettingsCompletion({
        profile: propertyProfileDraftFromProperty(property),
        operational: appSettingsToFormValues(appSettings),
        appSettings,
        orgSocialLinks,
      }).issueSectionIds;
    }

    const parkingIssueSectionIdsById: Record<string, readonly ParkingSettingsSectionId[]> = {};
    for (const parking of parkings) {
      const settings =
        parkingDataById.get(parking.id) ??
        queryClient.getQueryData<ParkingSettingsPayload>([
          ...PARKING_SETTINGS_QUERY_KEY,
          parking.id,
        ]) ??
        null;
      if (!settings) {
        parkingIssueSectionIdsById[parking.id] = PARKING_PENDING_SECTIONS;
        continue;
      }
      parkingIssueSectionIdsById[parking.id] = computeParkingSettingsCompletion({
        profile: parkingProfileDraftFromParking(parking, inheritedBrandColor),
        operational: parkingOperationalDraftFromSettings(settings),
        details: parkingDetailsDraftFromSettings(parking.settings, parking.acceptedVehicleTypes),
        features: parkingFeaturesDraftFromSettings(parking.settings),
        location: parkingLocationDraftFromSettings(parking.settings, parking.residenceName),
        coverImage: parkingCoverImageFromSettings(parking.settings ?? {}),
        appSettings: null,
      }).issueSectionIds;
    }

    return {
      propertyIssueSectionIdsById,
      parkingIssueSectionIdsById,
    } satisfies Pick<
      SetupGuideCompletionSnapshot,
      'propertyIssueSectionIdsById' | 'parkingIssueSectionIdsById'
    >;
  }, [
    inheritedBrandColor,
    orgSocialLinks,
    parkingDataById,
    parkings,
    properties,
    propertyDataById,
    queryClient,
  ]);
}
