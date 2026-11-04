import { describe, expect, it } from 'vitest';

import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { DEFAULT_CANCELLATION_POLICY } from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import { DEFAULT_PROPERTY_AUTOMATION_TOGGLES } from '@/features/dashboard/org/lib/propertyEmailAutomation';
import type { PropertySettingsCompletionResult } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import type { PropertyProfileDraft } from '@/features/dashboard/org/lib/propertySettingsForm';
import {
  propertySettingsSectionDirty,
  planPropertySettingsSave,
  buildProfilePatchForSections,
  buildAppSettingsPatchForSections,
  applySavedProfileSections,
  applySavedOperationalSections,
} from '@/features/dashboard/org/lib/propertySettingsSave';

function baseProfile(overrides: Partial<PropertyProfileDraft> = {}): PropertyProfileDraft {
  return {
    name: 'Sunset Unit',
    type: 'Condominium',
    status: 'ACTIVE',
    description: '',
    contactName: 'Ada Lovelace',
    contactRole: 'unit_owner',
    contactPhone: '+639171234567',
    contactEmail: 'ada@example.com',
    tower: 'Monaco',
    unitNumber: '2604',
    residenceName: 'Azure North Residences',
    address: '123 Example St',
    city: 'Muntinlupa',
    province: 'Metro Manila',
    country: 'Philippines',
    zipCode: '1781',
    latitude: 14.4,
    longitude: 121.0,
    mapsUrl: '',
    placeId: '',
    bedrooms: 1,
    bathrooms: 1,
    maxAdults: 2,
    maxChildren: 0,
    maxGuests: 2,
    unitTypeId: 'studio',
    floors: 26,
    checkInTime: '15:00',
    checkOutTime: '11:00',
    cleaningBufferMinutes: 60,
    selfCheckIn: false,
    media: [],
    enabledAmenities: [],
    customAmenities: [],
    enabledHouseRules: [],
    customHouseRules: [],
    cancellationPolicy: { ...DEFAULT_CANCELLATION_POLICY },
    allowPets: false,
    allowParking: true,
    allowSurpriseDecor: false,
    preferredOwnerParkingId: '',
    complimentaryOwnerParking: false,
    ...overrides,
  };
}

function emptyCompletion(): PropertySettingsCompletionResult {
  return {
    fieldErrors: {},
    sectionMessages: {},
    issueSectionIds: [],
    firstIssueSectionId: null,
    firstErrorMessage: null,
    isComplete: true,
  };
}

function baseOperational(): AppSettingsFormValues {
  return {
    emailTo: '',
    emailReplyTo: '',
    parkingOwnerEmails: '',
    sdRefundCronEmailLeadHours: 2,
    sdRefundCronMaxCheckoutAgeDays: 30,
    defaultParkingRateGuest: 0,
    automationToggles: { ...DEFAULT_PROPERTY_AUTOMATION_TOGGLES },
    paymentMethods: [],
    paymentProvider: '',
    gcashName: '',
    gcashNumber: '',
    gafUnitOwner: '',
    gafTowerAndUnitNumber: '',
    gafGuestsOnsiteContactPerson: '',
    gafOwnerContactNumber: '',
    brandColor: '',
    facebookPageUrl: '',
    airbnbUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    externalReviews: [],
    vouchersEnabled: false,
    voucherPrizes: [],
    voucherRevealStyle: 'reel',
    documentRequirementsOverride: null,
  };
}

describe('propertySettingsSectionDirty', () => {
  it('marks basic dirty when only description changes', () => {
    const baseline = baseProfile();
    const draft = baseProfile({ description: 'Updated listing copy' });
    expect(propertySettingsSectionDirty('basic', draft, baseline, null, null, '')).toBe(true);
  });
});

describe('planPropertySettingsSave', () => {
  it('enables save when only description is dirty', () => {
    const baseline = baseProfile();
    const draft = baseProfile({ description: 'Updated listing copy' });
    const operational = baseOperational();

    const plan = planPropertySettingsSave({
      profileDraft: draft,
      profileBaseline: baseline,
      operationalDraft: operational,
      operationalBaseline: operational,
      completion: emptyCompletion(),
      inheritedBrandColor: '',
    });

    expect(plan.hasSavableWork).toBe(true);
    expect(plan.profileSections).toContain('basic');
    expect(plan.blockedSections).toEqual([]);
  });

  it('enables save when only self-check-in is dirty', () => {
    const baseline = baseProfile();
    const draft = baseProfile({ selfCheckIn: true });
    const operational = baseOperational();

    const plan = planPropertySettingsSave({
      profileDraft: draft,
      profileBaseline: baseline,
      operationalDraft: operational,
      operationalBaseline: operational,
      completion: emptyCompletion(),
      inheritedBrandColor: '',
    });

    expect(plan.hasSavableWork).toBe(true);
    expect(plan.profileSections).toContain('details');
  });

  it('enables save when only zip code is dirty', () => {
    const baseline = baseProfile();
    const draft = baseProfile({ zipCode: '1780' });
    const operational = baseOperational();

    const plan = planPropertySettingsSave({
      profileDraft: draft,
      profileBaseline: baseline,
      operationalDraft: operational,
      operationalBaseline: operational,
      completion: emptyCompletion(),
      inheritedBrandColor: '',
    });

    expect(plan.hasSavableWork).toBe(true);
    expect(plan.profileSections).toContain('location');
  });

  it('enables save when only guest-form allowPets is dirty', () => {
    const baseline = baseProfile();
    const draft = baseProfile({ allowPets: true });
    const operational = baseOperational();

    const plan = planPropertySettingsSave({
      profileDraft: draft,
      profileBaseline: baseline,
      operationalDraft: operational,
      operationalBaseline: operational,
      completion: emptyCompletion(),
      inheritedBrandColor: '',
    });

    expect(plan.hasSavableWork).toBe(true);
    expect(plan.profileSections).toContain('guest-form');
  });
});

describe('buildProfilePatchForSections', () => {
  it('buildProfilePatchForSections is exported', () => {
    expect(typeof buildProfilePatchForSections).toBe('function');
  });
});

describe('buildAppSettingsPatchForSections', () => {
  it('buildAppSettingsPatchForSections is exported', () => {
    expect(typeof buildAppSettingsPatchForSections).toBe('function');
  });
});

describe('applySavedProfileSections', () => {
  it('applySavedProfileSections is exported', () => {
    expect(typeof applySavedProfileSections).toBe('function');
  });
});

describe('applySavedOperationalSections', () => {
  it('applySavedOperationalSections is exported', () => {
    expect(typeof applySavedOperationalSections).toBe('function');
  });
});
