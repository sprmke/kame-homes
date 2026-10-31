import { useMemo } from 'react';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { useParkingSlotConflict } from '@/features/dashboard/org/hooks/useParkingSlotConflict';
import { DEFAULT_PARKING_RESIDENCE_NAME } from '@/features/dashboard/org/lib/parkingResidences';
import { isValidParkingSlotNumber } from '@/features/dashboard/org/lib/parkingSlotDisplay';
import type { ParkingFeaturesDraft } from '@/features/dashboard/parking/components/ParkingFeaturesSection';
import { useParkingSettings } from '@/features/dashboard/parking/hooks/useParkingSettings';
import { parkingFeaturesDraftFromSettings } from '@/features/dashboard/parking/lib/parkingFeaturesConstants';
import { computeParkingSettingsCompletion } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';
import {
  parkingCoverImageFromSettings,
  parkingDetailsDraftFromSettings,
  parkingLocationDraftFromSettings,
  parkingOperationalDraftFromSettings,
  parkingProfileDraftFromParking,
  type ParkingDetailsDraft,
  type ParkingLocationDraft,
  type ParkingOperationalDraft,
  type ParkingProfileDraft,
} from '@/features/dashboard/parking/lib/parkingSettingsForm';

type CompletionInput = {
  profile: ParkingProfileDraft;
  operational: ParkingOperationalDraft | null;
  details: ParkingDetailsDraft;
  features: ParkingFeaturesDraft;
  location: ParkingLocationDraft;
  coverImage: string;
  excludeParkingId?: string;
};

export function useParkingSettingsCompletionForDraft({
  profile,
  operational,
  details,
  features,
  location,
  coverImage,
  excludeParkingId,
}: CompletionInput) {
  const { data: appSettings } = useAppSettings();

  const residenceNameForConflict = profile.residenceName.trim() || DEFAULT_PARKING_RESIDENCE_NAME;
  const { hasDuplicate: slotDuplicate } = useParkingSlotConflict(
    profile.tower,
    profile.level,
    profile.slotNumber,
    residenceNameForConflict,
    excludeParkingId
  );
  const slotConflict = isValidParkingSlotNumber(profile.slotNumber) && slotDuplicate;

  const completion = useMemo(
    () =>
      computeParkingSettingsCompletion({
        profile,
        operational,
        details,
        features,
        location,
        coverImage,
        appSettings: appSettings ?? null,
        slotConflict,
      }),
    [profile, operational, details, features, location, coverImage, appSettings, slotConflict]
  );

  return { completion };
}

/** Saved parking snapshot — for sidebar indicators outside the settings editor. */
export function useSavedParkingSettingsCompletion() {
  const { parking } = useParkingContext();
  const { data: settings } = useParkingSettings();
  const inheritedBrandColor = useOrgBrandColor();

  const profile = useMemo(
    () => parkingProfileDraftFromParking(parking, inheritedBrandColor),
    [parking, inheritedBrandColor]
  );
  const operational = useMemo(
    () => (settings ? parkingOperationalDraftFromSettings(settings) : null),
    [settings]
  );
  const details = useMemo(
    () => parkingDetailsDraftFromSettings(parking.settings, parking.acceptedVehicleTypes),
    [parking.settings, parking.acceptedVehicleTypes]
  );
  const features = useMemo(
    () => parkingFeaturesDraftFromSettings(parking.settings),
    [parking.settings]
  );
  const location = useMemo(
    () => parkingLocationDraftFromSettings(parking.settings, parking.residenceName),
    [parking.settings, parking.residenceName]
  );
  const coverImage = useMemo(
    () => parkingCoverImageFromSettings(parking.settings),
    [parking.settings]
  );

  return useParkingSettingsCompletionForDraft({
    profile,
    operational,
    details,
    features,
    location,
    coverImage,
    excludeParkingId: parking.id,
  }).completion;
}
