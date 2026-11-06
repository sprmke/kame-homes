import { describe, expect, it } from 'vitest';

import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { buildCancellationPreset } from '@/features/dashboard/org/lib/cancellationPolicy';
import { DEFAULT_PROPERTY_AUTOMATION_TOGGLES } from '@/features/dashboard/org/lib/propertyEmailAutomation';
import {
  computePropertySettingsCompletion,
  MIN_PROPERTY_AMENITIES,
  MIN_PROPERTY_PHOTOS,
} from '@/features/dashboard/org/lib/propertySettingsCompletion';
import type { PropertyProfileDraft } from '@/features/dashboard/org/lib/propertySettingsForm';

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
    cancellationPolicy: buildCancellationPreset('moderate'),
    allowPets: false,
    allowParking: true,
    allowSurpriseDecor: false,
    preferredOwnerParkingId: '',
    complimentaryOwnerParking: false,
    ...overrides,
  };
}

function baseOperational(overrides: Partial<AppSettingsFormValues> = {}): AppSettingsFormValues {
  return {
    emailTo: '',
    emailReplyTo: 'team@example.com',
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
    ...overrides,
  };
}

function completionFor(operational: AppSettingsFormValues) {
  return computePropertySettingsCompletion({
    profile: baseProfile(),
    operational,
    appSettings: null,
    orgSocialLinks: null,
  });
}

describe('computePropertySettingsCompletion', () => {
  it('is a function', () => {
    expect(typeof computePropertySettingsCompletion).toBe('function');
  });
});

describe('email automations validation', () => {
  it('requires a Team email', () => {
    const result = completionFor(baseOperational({ emailReplyTo: '' }));
    expect(result.fieldErrors['email-reply-to']).toBe('Enter team email');
  });

  it('does not validate a Building admin email', () => {
    const result = completionFor(baseOperational({ emailTo: '' }));
    expect(result.fieldErrors).not.toHaveProperty('building-admin-email');
    expect(result.fieldErrors).not.toHaveProperty('parking-owner-emails');
    expect(result.fieldErrors).not.toHaveProperty('email-reply-to');
  });

  it('never reports the retired Parking owners field', () => {
    const result = completionFor(baseOperational({ emailReplyTo: '' }));
    expect(result.fieldErrors).not.toHaveProperty('parking-owner-emails');
  });
});

describe('MIN_PROPERTY_PHOTOS', () => {
  it('is defined', () => {
    expect(MIN_PROPERTY_PHOTOS).toBeDefined();
  });
});

describe('MIN_PROPERTY_AMENITIES', () => {
  it('is defined', () => {
    expect(MIN_PROPERTY_AMENITIES).toBeDefined();
  });
});
