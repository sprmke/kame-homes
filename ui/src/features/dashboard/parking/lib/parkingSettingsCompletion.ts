import type { AppSettingsDto } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { isValidParkingSlotNumber } from '@/features/dashboard/org/lib/parkingSlotDisplay';
import { MAX_PROPERTY_PAYMENT_METHODS } from '@/features/dashboard/org/lib/paymentMethods';
import {
  validatePaymentAccountName,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from '@/features/dashboard/org/lib/paymentProviders';
import type { ParkingFeaturesDraft } from '@/features/dashboard/parking/components/ParkingFeaturesSection';
import type {
  ParkingDetailsDraft,
  ParkingLocationDraft,
  ParkingOperationalDraft,
  ParkingProfileDraft,
} from '@/features/dashboard/parking/lib/parkingSettingsForm';

export const MIN_PARKING_AMENITIES = 1;

export type ParkingSettingsSectionId =
  'basic' | 'media' | 'details' | 'features' | 'location' | 'payment';

export type ParkingSettingsCompletionInput = {
  profile: ParkingProfileDraft;
  operational: ParkingOperationalDraft | null;
  details: ParkingDetailsDraft;
  features: ParkingFeaturesDraft;
  location: ParkingLocationDraft;
  coverImage: string;
  appSettings: AppSettingsDto | null;
  slotConflict?: boolean;
};

export type ParkingSettingsCompletionResult = {
  fieldErrors: Record<string, string>;
  sectionMessages: Partial<Record<ParkingSettingsSectionId, string>>;
  issueSectionIds: ParkingSettingsSectionId[];
  firstIssueSectionId: ParkingSettingsSectionId | null;
  firstErrorMessage: string | null;
  isComplete: boolean;
};

export function computeParkingSettingsCompletion(
  input: ParkingSettingsCompletionInput
): ParkingSettingsCompletionResult {
  const { profile, operational, details, features, location, coverImage } = input;
  const fieldErrors: Record<string, string> = {};
  const sectionMessages: Partial<Record<ParkingSettingsSectionId, string>> = {};
  const issueSectionIds: ParkingSettingsSectionId[] = [];

  const addSectionIssue = (sectionId: ParkingSettingsSectionId, message: string) => {
    if (!sectionMessages[sectionId]) sectionMessages[sectionId] = message;
    if (!issueSectionIds.includes(sectionId)) issueSectionIds.push(sectionId);
  };

  const addFieldError = (fieldId: string, message: string, sectionId: ParkingSettingsSectionId) => {
    fieldErrors[fieldId] = message;
    if (!issueSectionIds.includes(sectionId)) issueSectionIds.push(sectionId);
  };

  // ── Basic ──
  if (!profile.parkingType.trim()) {
    addFieldError('settings-parking-type', 'Select a parking type', 'basic');
  }
  if (!profile.residenceName.trim()) {
    addFieldError('settings-residence', 'Select a residence', 'basic');
  }
  if (!profile.tower.trim()) {
    addFieldError('settings-tower', 'Select a tower', 'basic');
  }
  if (!profile.level.trim()) {
    addFieldError('settings-level', 'Select a level', 'basic');
  }
  if (!isValidParkingSlotNumber(profile.slotNumber)) {
    addFieldError('settings-slot', 'Enter a valid slot number', 'basic');
  } else if (input.slotConflict) {
    addFieldError('settings-slot', 'This slot is already in use', 'basic');
  }

  // ── Media ──
  if (!coverImage.trim()) {
    addSectionIssue('media', 'Add a cover photo. Guests rely on photos when choosing a slot.');
  }

  // ── Details ──
  if (!details.checkInTime.trim()) {
    addFieldError('parking-check-in', 'Set a check-in time', 'details');
  }
  if (!details.checkOutTime.trim()) {
    addFieldError('parking-check-out', 'Set a check-out time', 'details');
  }

  // ── Features ──
  if (features.enabledParkingAmenities.length < MIN_PARKING_AMENITIES) {
    addSectionIssue(
      'features',
      `Select at least ${MIN_PARKING_AMENITIES} amenity. This helps guests know what this slot offers.`
    );
  }

  // ── Location ──
  if (!location.address.trim()) {
    addFieldError('property-address', 'Enter the street address', 'location');
  }
  if (!location.city.trim()) {
    addFieldError('parking-city', 'Enter the city', 'location');
  }
  if (!location.province.trim()) {
    addFieldError('parking-province', 'Enter the province or state', 'location');
  }
  if (!location.country.trim()) {
    addFieldError('parking-country', 'Enter the country', 'location');
  }
  if (location.latitude == null || location.longitude == null) {
    addFieldError('property-location-map', 'Pin this parking slot on the map', 'location');
  }

  // ── Payment ──
  if (operational) {
    if (operational.paymentMethods.length === 0) {
      addFieldError('payment-methods', 'Add at least one payment method', 'payment');
    } else if (operational.paymentMethods.length > MAX_PROPERTY_PAYMENT_METHODS) {
      addFieldError(
        'payment-methods',
        `You can add up to ${MAX_PROPERTY_PAYMENT_METHODS} payment methods`,
        'payment'
      );
    } else if (operational.paymentMethods.filter((m) => m.isPrimary).length !== 1) {
      addFieldError('payment-methods', 'Mark exactly one payment method as primary', 'payment');
    }

    for (const method of operational.paymentMethods) {
      const prefix = `payment-method-${method.id}`;
      const providerErr = validatePaymentProvider(method.provider);
      if (providerErr) {
        addFieldError(`${prefix}-provider`, providerErr, 'payment');
      }

      const accountNameErr = validatePaymentAccountName(method.accountName);
      if (accountNameErr) {
        addFieldError(`${prefix}-name`, accountNameErr, 'payment');
      } else if (!method.accountName.trim()) {
        addFieldError(`${prefix}-name`, 'Enter the account name', 'payment');
      }

      const accountNumberErr = validatePaymentAccountNumber(method.provider, method.accountNumber);
      if (accountNumberErr) {
        addFieldError(`${prefix}-number`, accountNumberErr, 'payment');
      } else if (!method.accountNumber.trim()) {
        addFieldError(`${prefix}-number`, 'Enter the account number', 'payment');
      }
    }
  }

  const firstIssueSectionId = issueSectionIds[0] ?? null;
  const firstFieldError = Object.values(fieldErrors)[0] ?? null;
  const firstErrorMessage =
    firstFieldError || (firstIssueSectionId ? sectionMessages[firstIssueSectionId] : null) || null;

  return {
    fieldErrors,
    sectionMessages,
    issueSectionIds,
    firstIssueSectionId,
    firstErrorMessage,
    isComplete: issueSectionIds.length === 0,
  };
}
