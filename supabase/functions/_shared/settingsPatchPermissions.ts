/**
 * Map update-property / app-settings PATCH bodies → required Phase 5 leaf permissions.
 */

import type { TeamPermissionId } from './propertyTeamPermissions.ts';

const PROFILE_SETTINGS_KEYS: Record<string, TeamPermissionId> = {
  description: 'settings.basicInfo:edit',
  contactName: 'settings.basicInfo:edit',
  contactRole: 'settings.basicInfo:edit',
  contactPhone: 'settings.basicInfo:edit',
  contactEmail: 'settings.basicInfo:edit',
  media: 'settings.media:edit',
  bedrooms: 'settings.propertyDetails:edit',
  bathrooms: 'settings.propertyDetails:edit',
  maxAdults: 'settings.propertyDetails:edit',
  maxChildren: 'settings.propertyDetails:edit',
  maxGuests: 'settings.propertyDetails:edit',
  unitTypeId: 'settings.propertyDetails:edit',
  floors: 'settings.propertyDetails:edit',
  checkInTime: 'settings.propertyDetails:edit',
  checkOutTime: 'settings.propertyDetails:edit',
  selfCheckIn: 'settings.propertyDetails:edit',
  enabledAmenities: 'settings.amenities:edit',
  customAmenities: 'settings.amenities:edit',
  enabledHouseRules: 'settings.houseRules:edit',
  customHouseRules: 'settings.houseRules:edit',
  allowPets: 'settings.guestForm:edit',
  allowParking: 'settings.guestForm:edit',
  allowSurpriseDecor: 'settings.guestForm:edit',
  cleaningBufferMinutes: 'settings.guestForm:edit',
  preferredOwnerParkingId: 'settings.guestForm:edit',
  complimentaryOwnerParking: 'settings.guestForm:edit',
  cancellationPolicy: 'settings.cancellationPolicy:edit',
  city: 'settings.location:edit',
  province: 'settings.location:edit',
  country: 'settings.location:edit',
  zipCode: 'settings.location:edit',
  latitude: 'settings.location:edit',
  longitude: 'settings.location:edit',
  mapsUrl: 'settings.location:edit',
  placeId: 'settings.location:edit',
  inboxPinnedSnippets: 'inbox.quickReplies:edit',
};

const APP_SETTINGS_BODY_KEYS: Record<string, TeamPermissionId> = {
  brandColor: 'settings.basicInfo:edit',
  facebookPageUrl: 'settings.socials:edit',
  airbnbUrl: 'settings.socials:edit',
  instagramUrl: 'settings.socials:edit',
  tiktokUrl: 'settings.socials:edit',
  externalReviews: 'settings.socials:edit',
  vouchersEnabled: 'settings.socials:edit',
  voucherPrizes: 'settings.socials:edit',
  voucherRevealStyle: 'settings.socials:edit',
  paymentMethods: 'settings.payment:edit',
  paymentProvider: 'settings.payment:edit',
  gcashName: 'settings.payment:edit',
  gcashNumber: 'settings.payment:edit',
  gafUnitOwner: 'settings.buildingForms:edit',
  gafTowerAndUnitNumber: 'settings.buildingForms:edit',
  gafGuestsOnsiteContactPerson: 'settings.buildingForms:edit',
  gafOwnerContactNumber: 'settings.buildingForms:edit',
  emailReplyTo: 'settings.emailAutomations:edit',
  parkingOwnerEmails: 'settings.emailAutomations:edit',
  sdRefundCronEmailLeadHours: 'settings.emailAutomations:edit',
  sdRefundCronEmailLeadMinutes: 'settings.emailAutomations:edit',
  sdRefundCronMaxCheckoutAgeDays: 'settings.emailAutomations:edit',
  automationToggles: 'settings.emailAutomations:edit',
};

function pushUnique(out: TeamPermissionId[], id: TeamPermissionId): void {
  if (!out.includes(id)) out.push(id);
}

/** Required leaf permissions for an `update-property` PATCH body. */
export function updatePropertyPatchPermissions(body: Record<string, unknown>): TeamPermissionId[] {
  const needed: TeamPermissionId[] = [];

  if (typeof body.name === 'string') pushUnique(needed, 'settings.basicInfo:edit');
  if (typeof body.tower === 'string' || typeof body.unitNumber === 'string') {
    pushUnique(needed, 'settings.basicInfo:edit');
  } else if (typeof body.towerAndUnit === 'string') {
    pushUnique(needed, 'settings.basicInfo:edit');
  }
  if (typeof body.residenceName === 'string') pushUnique(needed, 'settings.basicInfo:edit');
  if (typeof body.maxGuests === 'number') pushUnique(needed, 'settings.basicInfo:edit');
  if (typeof body.address === 'string') pushUnique(needed, 'settings.location:edit');
  if (typeof body.status === 'string') pushUnique(needed, 'settings.dangerZone:edit');

  if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
    const settings = body.settings as Record<string, unknown>;
    for (const key of Object.keys(settings)) {
      const perm = PROFILE_SETTINGS_KEYS[key];
      if (perm) pushUnique(needed, perm);
    }
  }

  return needed;
}

/** Required leaf permissions for an `app-settings` PATCH body. */
export function appSettingsPatchPermissions(body: Record<string, unknown>): TeamPermissionId[] {
  const needed: TeamPermissionId[] = [];
  for (const key of Object.keys(body)) {
    if (key === 'settingsVerificationToken' || key === 'publicPagesAutosaveGate') continue;
    const perm = APP_SETTINGS_BODY_KEYS[key];
    if (perm) pushUnique(needed, perm);
  }
  return needed;
}
