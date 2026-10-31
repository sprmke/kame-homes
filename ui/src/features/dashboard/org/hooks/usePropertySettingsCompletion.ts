import { useMemo } from 'react';

import {
  appSettingsToFormValues,
  useAppSettings,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import { isCondoPropertyType } from '@/features/dashboard/org/lib/propertyResidences';
import { computePropertySettingsCompletion } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import {
  propertyProfileDraftFromProperty,
  type PropertyProfileDraft,
} from '@/features/dashboard/org/lib/propertySettingsForm';
import {
  isPropertyTowerForResidence,
  isValidUnitNumber,
} from '@/features/dashboard/org/lib/propertyTowerUnit';

type CompletionInput = {
  profile: PropertyProfileDraft;
  operational: AppSettingsFormValues | null;
  propertyId: string;
  orgSlug: string;
  nameUnavailable?: boolean;
  towerUnitConflict?: boolean;
};

export function usePropertySettingsCompletionForDraft({
  profile,
  operational,
  propertyId: _propertyId,
  orgSlug: _orgSlug,
  nameUnavailable = false,
  towerUnitConflict = false,
}: CompletionInput) {
  const { data: appSettings } = useAppSettings();
  const { data: orgSettings } = useOrgSettings();

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

  const towerConflict = useMemo(() => {
    const effectiveResidence = profile.residenceName.trim() || DEFAULT_RESIDENCE_NAME;
    if (
      !isCondoPropertyType(profile.type) ||
      !isPropertyTowerForResidence(profile.tower, effectiveResidence) ||
      !isValidUnitNumber(profile.unitNumber)
    ) {
      return false;
    }
    return towerUnitConflict;
  }, [profile.type, profile.residenceName, profile.tower, profile.unitNumber, towerUnitConflict]);

  const completion = useMemo(
    () =>
      computePropertySettingsCompletion({
        profile,
        operational,
        appSettings: appSettings ?? null,
        orgSocialLinks,
        nameConflict: nameUnavailable,
        towerConflict,
      }),
    [profile, operational, appSettings, orgSocialLinks, nameUnavailable, towerConflict]
  );

  return { completion };
}

/** Saved property snapshot — for sidebar indicators outside the settings editor. */
export function useSavedPropertySettingsCompletion() {
  const { property, orgSlug } = useOrgContext();
  const { data: appSettings } = useAppSettings();

  const profile = useMemo(() => propertyProfileDraftFromProperty(property), [property]);
  const operational = useMemo(
    () => (appSettings ? appSettingsToFormValues(appSettings) : null),
    [appSettings]
  );

  return usePropertySettingsCompletionForDraft({
    profile,
    operational,
    propertyId: property.id,
    orgSlug,
  }).completion;
}
