import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  paymentMethodsEqual,
  syncLegacyPaymentFieldsFromMethods,
  type PropertyPaymentMethod,
} from '@/features/dashboard/org/lib/paymentMethods';
import { cancellationPolicySettingsEqual } from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import {
  automationTogglesEqual,
  type PropertyAutomationToggles,
} from '@/features/dashboard/org/lib/propertyEmailAutomation';
import {
  externalReviewsEqual,
  type PropertyExternalReview,
} from '@/features/dashboard/org/lib/propertyExternalReviews';
import type {
  PropertySettingsCompletionResult,
  PropertySettingsSectionId,
} from '@/features/dashboard/org/lib/propertySettingsCompletion';
import {
  propertyProfileDbFieldsDirty,
  propertyProfileDraftToUpdatePayload,
  propertyProfileSettingsPatch,
  type PropertyProfileDraft,
  type PropertyProfileUpdatePayload,
} from '@/features/dashboard/org/lib/propertySettingsForm';
import type { PropertyVoucherPrize } from '@/features/dashboard/org/lib/propertyVoucherSettings';
import { voucherPrizesEqual } from '@/features/dashboard/org/lib/propertyVoucherSettings';
import type { VoucherRevealStyle } from '@/features/dashboard/org/lib/voucherRevealStyle';

import { propertyBrandColorsEquivalent } from '@/lib/theme/brandColor';

const FIELD_SECTIONS: Record<string, PropertySettingsSectionId> = {
  'property-name': 'basic',
  'property-type': 'basic',
  'property-residence': 'basic',
  'property-tower': 'basic',
  'property-unit': 'basic',
  'property-contact-name': 'basic',
  'property-contact-role': 'basic',
  'property-contact-phone': 'basic',
  'property-contact-email': 'basic',
  'property-brand-color': 'basic',
  'property-facebook-page-url': 'branding',
  'property-airbnb-url': 'branding',
  'property-instagram-url': 'branding',
  'property-tiktok-url': 'branding',
  'property-external-reviews': 'guest-rewards',
  'property-vouchers': 'guest-rewards',
  'property-bedrooms': 'details',
  'property-bathrooms': 'details',
  'property-floors': 'details',
  'property-max-adults': 'details',
  'property-max-children': 'details',
  'property-unit-type': 'details',
  'property-check-in': 'details',
  'property-check-out': 'details',
  'property-address': 'location',
  'property-city': 'location',
  'property-province': 'location',
  'property-country': 'location',
  'property-location-map': 'location',
  'payment-provider': 'payment',
  'payment-account-name': 'payment',
  'payment-account-number': 'payment',
  'payment-qr-image': 'payment',
  'payment-methods': 'payment',
  'gaf-unit-owner': 'building-forms',
  'gaf-tower-unit': 'building-forms',
  'gaf-onsite-contact': 'building-forms',
  'gaf-owner-phone': 'building-forms',
  'gaf-owner-signature': 'building-forms',
  'email-reply-to': 'email-automations',
  'parking-owner-emails': 'email-automations',
  'sd-lead-hours': 'email-automations',
  'sd-max-age': 'email-automations',
  'guest-form-allow-pets': 'guest-form',
  'guest-form-allow-parking': 'guest-form',
  'guest-form-allow-surprise-decor': 'guest-form',
  'guest-form-preferred-owner-parking': 'guest-form',
  'guest-form-complimentary-owner-parking': 'guest-form',
  'cancellation-custom-title': 'cancellation',
  'cancellation-custom-description': 'cancellation',
};

const PROFILE_SECTIONS: PropertySettingsSectionId[] = [
  'basic',
  'details',
  'media',
  'amenities',
  'house-rules',
  'guest-form',
  'cancellation',
  'location',
];

function fieldSectionId(fieldId: string): PropertySettingsSectionId | undefined {
  const direct = FIELD_SECTIONS[fieldId];
  if (direct) return direct;
  if (fieldId.startsWith('payment-method-')) return 'payment';
  return undefined;
}

const OPERATIONAL_SECTIONS: PropertySettingsSectionId[] = [
  'basic',
  'branding',
  'guest-rewards',
  'payment',
  'building-forms',
  'email-automations',
];

export type PropertySettingsSavePlan = {
  savableSections: PropertySettingsSectionId[];
  blockedSections: PropertySettingsSectionId[];
  profileSections: PropertySettingsSectionId[];
  operationalSections: PropertySettingsSectionId[];
  firstBlockedSectionId: PropertySettingsSectionId | null;
  firstBlockedMessage: string | null;
  hasSavableWork: boolean;
};

function contactFieldsDirty(draft: PropertyProfileDraft, baseline: PropertyProfileDraft): boolean {
  return (
    draft.contactName.trim() !== baseline.contactName.trim() ||
    draft.contactRole !== baseline.contactRole ||
    draft.contactPhone.trim() !== baseline.contactPhone.trim() ||
    draft.contactEmail.trim() !== baseline.contactEmail.trim()
  );
}

function descriptionDirty(draft: PropertyProfileDraft, baseline: PropertyProfileDraft): boolean {
  return draft.description.trim() !== baseline.description.trim();
}

function detailsFieldsDirty(draft: PropertyProfileDraft, baseline: PropertyProfileDraft): boolean {
  return (
    draft.bedrooms !== baseline.bedrooms ||
    draft.bathrooms !== baseline.bathrooms ||
    draft.maxAdults !== baseline.maxAdults ||
    draft.maxChildren !== baseline.maxChildren ||
    draft.unitTypeId !== baseline.unitTypeId ||
    draft.floors !== baseline.floors ||
    draft.checkInTime !== baseline.checkInTime ||
    draft.checkOutTime !== baseline.checkOutTime ||
    draft.selfCheckIn !== baseline.selfCheckIn
  );
}

function locationFieldsDirty(draft: PropertyProfileDraft, baseline: PropertyProfileDraft): boolean {
  return (
    draft.city.trim() !== baseline.city.trim() ||
    draft.province.trim() !== baseline.province.trim() ||
    draft.country.trim() !== baseline.country.trim() ||
    draft.zipCode.trim() !== baseline.zipCode.trim() ||
    draft.latitude !== baseline.latitude ||
    draft.longitude !== baseline.longitude ||
    draft.mapsUrl.trim() !== baseline.mapsUrl.trim() ||
    draft.placeId.trim() !== baseline.placeId.trim()
  );
}

export function propertySettingsSectionDirty(
  sectionId: PropertySettingsSectionId,
  profileDraft: PropertyProfileDraft,
  profileBaseline: PropertyProfileDraft,
  operationalDraft: AppSettingsFormValues | null,
  operationalBaseline: AppSettingsFormValues | null,
  inheritedBrandColor: string
): boolean {
  switch (sectionId) {
    case 'basic':
      return (
        propertyProfileDbFieldsDirty(profileDraft, profileBaseline) ||
        contactFieldsDirty(profileDraft, profileBaseline) ||
        descriptionDirty(profileDraft, profileBaseline) ||
        Boolean(
          operationalDraft &&
          operationalBaseline &&
          !propertyBrandColorsEquivalent(
            operationalDraft.brandColor,
            operationalBaseline.brandColor,
            inheritedBrandColor
          )
        )
      );
    case 'media':
      return JSON.stringify(profileDraft.media) !== JSON.stringify(profileBaseline.media);
    case 'details':
      return detailsFieldsDirty(profileDraft, profileBaseline);
    case 'amenities':
      return (
        JSON.stringify(profileDraft.enabledAmenities) !==
          JSON.stringify(profileBaseline.enabledAmenities) ||
        JSON.stringify(profileDraft.customAmenities) !==
          JSON.stringify(profileBaseline.customAmenities)
      );
    case 'house-rules':
      return (
        JSON.stringify(profileDraft.enabledHouseRules) !==
          JSON.stringify(profileBaseline.enabledHouseRules) ||
        JSON.stringify(profileDraft.customHouseRules) !==
          JSON.stringify(profileBaseline.customHouseRules)
      );
    case 'guest-form':
      return (
        profileDraft.allowPets !== profileBaseline.allowPets ||
        profileDraft.allowParking !== profileBaseline.allowParking ||
        profileDraft.allowSurpriseDecor !== profileBaseline.allowSurpriseDecor ||
        profileDraft.preferredOwnerParkingId !== profileBaseline.preferredOwnerParkingId ||
        profileDraft.complimentaryOwnerParking !== profileBaseline.complimentaryOwnerParking ||
        profileDraft.cleaningBufferMinutes !== profileBaseline.cleaningBufferMinutes
      );
    case 'cancellation':
      return !cancellationPolicySettingsEqual(
        profileDraft.cancellationPolicy,
        profileBaseline.cancellationPolicy
      );
    case 'location':
      return (
        profileDraft.address.trim() !== profileBaseline.address.trim() ||
        locationFieldsDirty(profileDraft, profileBaseline)
      );
    case 'branding':
      return Boolean(
        operationalDraft &&
        operationalBaseline &&
        (operationalDraft.facebookPageUrl.trim() !== operationalBaseline.facebookPageUrl.trim() ||
          operationalDraft.airbnbUrl.trim() !== operationalBaseline.airbnbUrl.trim() ||
          operationalDraft.instagramUrl.trim() !== operationalBaseline.instagramUrl.trim() ||
          operationalDraft.tiktokUrl.trim() !== operationalBaseline.tiktokUrl.trim())
      );
    case 'guest-rewards':
      return Boolean(
        operationalDraft &&
        operationalBaseline &&
        (!externalReviewsEqual(
          operationalDraft.externalReviews,
          operationalBaseline.externalReviews
        ) ||
          operationalDraft.vouchersEnabled !== operationalBaseline.vouchersEnabled ||
          !voucherPrizesEqual(operationalDraft.voucherPrizes, operationalBaseline.voucherPrizes) ||
          operationalDraft.voucherRevealStyle !== operationalBaseline.voucherRevealStyle)
      );
    case 'payment':
      return Boolean(
        operationalDraft &&
        operationalBaseline &&
        !paymentMethodsEqual(operationalDraft.paymentMethods, operationalBaseline.paymentMethods)
      );
    case 'building-forms':
      return Boolean(
        operationalDraft &&
        operationalBaseline &&
        (operationalDraft.gafUnitOwner.trim() !== operationalBaseline.gafUnitOwner.trim() ||
          operationalDraft.gafTowerAndUnitNumber.trim() !==
            operationalBaseline.gafTowerAndUnitNumber.trim() ||
          operationalDraft.gafGuestsOnsiteContactPerson.trim() !==
            operationalBaseline.gafGuestsOnsiteContactPerson.trim() ||
          operationalDraft.gafOwnerContactNumber.trim() !==
            operationalBaseline.gafOwnerContactNumber.trim())
      );
    case 'email-automations':
      return Boolean(
        operationalDraft &&
        operationalBaseline &&
        (operationalDraft.emailReplyTo.trim() !== operationalBaseline.emailReplyTo.trim() ||
          operationalDraft.parkingOwnerEmails.trim() !==
            operationalBaseline.parkingOwnerEmails.trim() ||
          operationalDraft.sdRefundCronEmailLeadHours !==
            operationalBaseline.sdRefundCronEmailLeadHours ||
          operationalDraft.sdRefundCronMaxCheckoutAgeDays !==
            operationalBaseline.sdRefundCronMaxCheckoutAgeDays ||
          !automationTogglesEqual(
            operationalDraft.automationToggles,
            operationalBaseline.automationToggles
          ))
      );
    default:
      return false;
  }
}

function dirtyFieldIdsInSection(
  sectionId: PropertySettingsSectionId,
  profileDraft: PropertyProfileDraft,
  profileBaseline: PropertyProfileDraft,
  operationalDraft: AppSettingsFormValues | null,
  operationalBaseline: AppSettingsFormValues | null,
  inheritedBrandColor: string
): string[] {
  const ids: string[] = [];

  switch (sectionId) {
    case 'basic':
      if (profileDraft.name.trim() !== profileBaseline.name.trim()) ids.push('property-name');
      if (profileDraft.type !== profileBaseline.type) ids.push('property-type');
      if (profileDraft.residenceName.trim() !== profileBaseline.residenceName.trim()) {
        ids.push('property-residence');
      }
      if (profileDraft.tower !== profileBaseline.tower) ids.push('property-tower');
      if (profileDraft.unitNumber !== profileBaseline.unitNumber) ids.push('property-unit');
      if (profileDraft.contactName.trim() !== profileBaseline.contactName.trim()) {
        ids.push('property-contact-name');
      }
      if (profileDraft.contactRole !== profileBaseline.contactRole) {
        ids.push('property-contact-role');
      }
      if (profileDraft.contactPhone.trim() !== profileBaseline.contactPhone.trim()) {
        ids.push('property-contact-phone');
      }
      if (profileDraft.contactEmail.trim() !== profileBaseline.contactEmail.trim()) {
        ids.push('property-contact-email');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        !propertyBrandColorsEquivalent(
          operationalDraft.brandColor,
          operationalBaseline.brandColor,
          inheritedBrandColor
        )
      ) {
        ids.push('property-brand-color');
      }
      break;
    case 'branding':
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.facebookPageUrl.trim() !== operationalBaseline.facebookPageUrl.trim()
      ) {
        ids.push('property-facebook-page-url');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.airbnbUrl.trim() !== operationalBaseline.airbnbUrl.trim()
      ) {
        ids.push('property-airbnb-url');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.instagramUrl.trim() !== operationalBaseline.instagramUrl.trim()
      ) {
        ids.push('property-instagram-url');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.tiktokUrl.trim() !== operationalBaseline.tiktokUrl.trim()
      ) {
        ids.push('property-tiktok-url');
      }
      break;
    case 'guest-rewards':
      if (
        operationalDraft &&
        operationalBaseline &&
        !externalReviewsEqual(operationalDraft.externalReviews, operationalBaseline.externalReviews)
      ) {
        ids.push('property-external-reviews');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        (operationalDraft.vouchersEnabled !== operationalBaseline.vouchersEnabled ||
          !voucherPrizesEqual(operationalDraft.voucherPrizes, operationalBaseline.voucherPrizes) ||
          operationalDraft.voucherRevealStyle !== operationalBaseline.voucherRevealStyle)
      ) {
        ids.push('property-vouchers');
      }
      break;
    case 'details':
      if (profileDraft.bedrooms !== profileBaseline.bedrooms) ids.push('property-bedrooms');
      if (profileDraft.bathrooms !== profileBaseline.bathrooms) ids.push('property-bathrooms');
      if (profileDraft.floors !== profileBaseline.floors) ids.push('property-floors');
      if (profileDraft.maxAdults !== profileBaseline.maxAdults) ids.push('property-max-adults');
      if (profileDraft.maxChildren !== profileBaseline.maxChildren) {
        ids.push('property-max-children');
      }
      if (profileDraft.unitTypeId !== profileBaseline.unitTypeId) {
        ids.push('property-unit-type');
      }
      if (profileDraft.checkInTime !== profileBaseline.checkInTime) ids.push('property-check-in');
      if (profileDraft.checkOutTime !== profileBaseline.checkOutTime) {
        ids.push('property-check-out');
      }
      break;
    case 'cancellation': {
      const draftPolicy = profileDraft.cancellationPolicy;
      const baselinePolicy = profileBaseline.cancellationPolicy;
      if (draftPolicy.type === 'custom') {
        if ((draftPolicy.customTitle ?? '') !== (baselinePolicy.customTitle ?? '')) {
          ids.push('cancellation-custom-title');
        }
        if ((draftPolicy.customDescription ?? '') !== (baselinePolicy.customDescription ?? '')) {
          ids.push('cancellation-custom-description');
        }
      }
      break;
    }
    case 'location':
      if (profileDraft.address.trim() !== profileBaseline.address.trim()) {
        ids.push('property-address');
      }
      if (profileDraft.city.trim() !== profileBaseline.city.trim()) ids.push('property-city');
      if (profileDraft.province.trim() !== profileBaseline.province.trim()) {
        ids.push('property-province');
      }
      if (profileDraft.country.trim() !== profileBaseline.country.trim()) {
        ids.push('property-country');
      }
      if (
        profileDraft.latitude !== profileBaseline.latitude ||
        profileDraft.longitude !== profileBaseline.longitude ||
        profileDraft.mapsUrl.trim() !== profileBaseline.mapsUrl.trim() ||
        profileDraft.placeId.trim() !== profileBaseline.placeId.trim()
      ) {
        ids.push('property-location-map');
      }
      break;
    case 'payment':
      if (
        operationalDraft &&
        operationalBaseline &&
        !paymentMethodsEqual(operationalDraft.paymentMethods, operationalBaseline.paymentMethods)
      ) {
        ids.push('payment-methods');
      }
      break;
    case 'building-forms':
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.gafUnitOwner.trim() !== operationalBaseline.gafUnitOwner.trim()
      ) {
        ids.push('gaf-unit-owner');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.gafTowerAndUnitNumber.trim() !==
          operationalBaseline.gafTowerAndUnitNumber.trim()
      ) {
        ids.push('gaf-tower-unit');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.gafGuestsOnsiteContactPerson.trim() !==
          operationalBaseline.gafGuestsOnsiteContactPerson.trim()
      ) {
        ids.push('gaf-onsite-contact');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.gafOwnerContactNumber.trim() !==
          operationalBaseline.gafOwnerContactNumber.trim()
      ) {
        ids.push('gaf-owner-phone');
      }
      break;
    case 'email-automations':
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.emailReplyTo.trim() !== operationalBaseline.emailReplyTo.trim()
      ) {
        ids.push('email-reply-to');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.parkingOwnerEmails.trim() !== operationalBaseline.parkingOwnerEmails.trim()
      ) {
        ids.push('parking-owner-emails');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.sdRefundCronEmailLeadHours !==
          operationalBaseline.sdRefundCronEmailLeadHours
      ) {
        ids.push('sd-lead-hours');
      }
      if (
        operationalDraft &&
        operationalBaseline &&
        operationalDraft.sdRefundCronMaxCheckoutAgeDays !==
          operationalBaseline.sdRefundCronMaxCheckoutAgeDays
      ) {
        ids.push('sd-max-age');
      }
      break;
    default:
      break;
  }

  return ids;
}

function sectionHasValidationIssue(
  sectionId: PropertySettingsSectionId,
  completion: PropertySettingsCompletionResult,
  profileDraft: PropertyProfileDraft,
  profileBaseline: PropertyProfileDraft,
  operationalDraft: AppSettingsFormValues | null,
  operationalBaseline: AppSettingsFormValues | null,
  inheritedBrandColor: string
): boolean {
  if (completion.sectionMessages[sectionId]) return true;

  const dirtyFieldIds = dirtyFieldIdsInSection(
    sectionId,
    profileDraft,
    profileBaseline,
    operationalDraft,
    operationalBaseline,
    inheritedBrandColor
  );

  const sectionHasAnyFieldError = Object.entries(completion.fieldErrors).some(
    ([fieldId, message]) => Boolean(message) && fieldSectionId(fieldId) === sectionId
  );

  if (dirtyFieldIds.length > 0) {
    if (dirtyFieldIds.some((fieldId) => Boolean(completion.fieldErrors[fieldId]))) {
      return true;
    }
    // Coarse dirty markers (payment methods array) map to fine-grained field error keys.
    if (sectionId === 'payment' && dirtyFieldIds.includes('payment-methods')) {
      return sectionHasAnyFieldError;
    }
    return false;
  }

  return sectionHasAnyFieldError;
}

function firstSectionIssue(
  sectionId: PropertySettingsSectionId,
  completion: PropertySettingsCompletionResult
): string | null {
  const banner = completion.sectionMessages[sectionId];
  if (banner) return banner;
  for (const [fieldId, message] of Object.entries(completion.fieldErrors)) {
    if (message && fieldSectionId(fieldId) === sectionId) return message;
  }
  return null;
}

function basicBrandColorDirty(
  operationalDraft: AppSettingsFormValues | null,
  operationalBaseline: AppSettingsFormValues | null,
  inheritedBrandColor: string
): boolean {
  return Boolean(
    operationalDraft &&
    operationalBaseline &&
    !propertyBrandColorsEquivalent(
      operationalDraft.brandColor,
      operationalBaseline.brandColor,
      inheritedBrandColor
    )
  );
}

function fieldIdsHaveValidationErrors(
  fieldIds: string[],
  completion: PropertySettingsCompletionResult
): boolean {
  return fieldIds.some((fieldId) => Boolean(completion.fieldErrors[fieldId]));
}

function evaluateBasicSectionSave(input: {
  profileDraft: PropertyProfileDraft;
  profileBaseline: PropertyProfileDraft;
  operationalDraft: AppSettingsFormValues | null;
  operationalBaseline: AppSettingsFormValues | null;
  completion: PropertySettingsCompletionResult;
  inheritedBrandColor: string;
}): {
  profileSavable: boolean;
  brandColorSavable: boolean;
  profileBlocked: boolean;
  brandColorBlocked: boolean;
} {
  const profileDirtyIds = dirtyFieldIdsInSection(
    'basic',
    input.profileDraft,
    input.profileBaseline,
    input.operationalDraft,
    input.operationalBaseline,
    input.inheritedBrandColor
  ).filter((fieldId) => fieldId !== 'property-brand-color');

  const brandColorDirty = basicBrandColorDirty(
    input.operationalDraft,
    input.operationalBaseline,
    input.inheritedBrandColor
  );
  const basicSectionMessage = input.completion.sectionMessages.basic;

  const profileSavable =
    profileDirtyIds.length > 0 &&
    !basicSectionMessage &&
    !fieldIdsHaveValidationErrors(profileDirtyIds, input.completion);

  const brandColorSavable =
    brandColorDirty &&
    !basicSectionMessage &&
    !input.completion.fieldErrors['property-brand-color'];

  return {
    profileSavable,
    brandColorSavable,
    profileBlocked: profileDirtyIds.length > 0 && !profileSavable,
    brandColorBlocked: brandColorDirty && !brandColorSavable,
  };
}

export function planPropertySettingsSave(input: {
  profileDraft: PropertyProfileDraft;
  profileBaseline: PropertyProfileDraft;
  operationalDraft: AppSettingsFormValues | null;
  operationalBaseline: AppSettingsFormValues | null;
  completion: PropertySettingsCompletionResult;
  inheritedBrandColor: string;
}): PropertySettingsSavePlan {
  const dirtySections = (
    [
      'basic',
      'details',
      'media',
      'amenities',
      'house-rules',
      'guest-form',
      'cancellation',
      'location',
      'branding',
      'guest-rewards',
      'payment',
      'building-forms',
      'email-automations',
    ] as PropertySettingsSectionId[]
  ).filter((sectionId) =>
    propertySettingsSectionDirty(
      sectionId,
      input.profileDraft,
      input.profileBaseline,
      input.operationalDraft,
      input.operationalBaseline,
      input.inheritedBrandColor
    )
  );

  const savableSections: PropertySettingsSectionId[] = [];
  const blockedSections: PropertySettingsSectionId[] = [];
  const basicSave = evaluateBasicSectionSave(input);
  const basicDirty = dirtySections.includes('basic');

  for (const sectionId of dirtySections) {
    if (sectionId === 'basic') continue;
    if (
      sectionHasValidationIssue(
        sectionId,
        input.completion,
        input.profileDraft,
        input.profileBaseline,
        input.operationalDraft,
        input.operationalBaseline,
        input.inheritedBrandColor
      )
    ) {
      blockedSections.push(sectionId);
    } else {
      savableSections.push(sectionId);
    }
  }

  if (basicDirty || basicSave.profileSavable || basicSave.brandColorSavable) {
    if (basicSave.profileSavable || basicSave.brandColorSavable) {
      savableSections.push('basic');
    }
    if (basicSave.profileBlocked || basicSave.brandColorBlocked) {
      blockedSections.push('basic');
    }
  }

  let profileSections = savableSections.filter((sectionId) => PROFILE_SECTIONS.includes(sectionId));
  let operationalSections = savableSections.filter((sectionId) =>
    OPERATIONAL_SECTIONS.includes(sectionId)
  );

  if (profileSections.includes('basic') && !basicSave.profileSavable) {
    profileSections = profileSections.filter((sectionId) => sectionId !== 'basic');
  }
  if (operationalSections.includes('basic') && !basicSave.brandColorSavable) {
    operationalSections = operationalSections.filter((sectionId) => sectionId !== 'basic');
  }

  const firstBlockedSectionId = blockedSections[0] ?? null;
  const firstBlockedMessage = firstBlockedSectionId
    ? firstSectionIssue(firstBlockedSectionId, input.completion)
    : null;

  return {
    savableSections,
    blockedSections,
    profileSections,
    operationalSections,
    firstBlockedSectionId,
    firstBlockedMessage,
    hasSavableWork: profileSections.length > 0 || operationalSections.length > 0,
  };
}

export function buildProfilePatchForSections(
  draft: PropertyProfileDraft,
  propertyId: string,
  sections: PropertySettingsSectionId[]
): PropertyProfileUpdatePayload | null {
  if (sections.length === 0) return null;

  const sectionSet = new Set(sections);
  const payload: PropertyProfileUpdatePayload = {
    propertyId,
  };
  const settings: Record<string, unknown> = {};
  let hasSettings = false;

  if (sectionSet.has('basic') || sectionSet.has('location')) {
    const dbPatch = propertyProfileDraftToUpdatePayload(draft, propertyId);
    if (sectionSet.has('basic')) {
      if (dbPatch.name) payload.name = dbPatch.name;
      if (dbPatch.tower) payload.tower = dbPatch.tower;
      if (dbPatch.unitNumber) payload.unitNumber = dbPatch.unitNumber;
      if (dbPatch.residenceName) payload.residenceName = dbPatch.residenceName;
      if (dbPatch.maxGuests) payload.maxGuests = dbPatch.maxGuests;
    }
    if (sectionSet.has('location') && dbPatch.address) {
      payload.address = dbPatch.address;
    }
  }

  const fullSettings = propertyProfileSettingsPatch(draft);

  if (sectionSet.has('basic')) {
    settings.description = fullSettings.description;
    settings.contactName = fullSettings.contactName;
    settings.contactRole = fullSettings.contactRole;
    settings.contactPhone = fullSettings.contactPhone;
    settings.contactEmail = fullSettings.contactEmail;
    hasSettings = true;
  }
  if (sectionSet.has('media')) {
    settings.media = fullSettings.media;
    hasSettings = true;
  }
  if (sectionSet.has('details')) {
    settings.bedrooms = fullSettings.bedrooms;
    settings.bathrooms = fullSettings.bathrooms;
    settings.maxAdults = fullSettings.maxAdults;
    settings.maxChildren = fullSettings.maxChildren;
    settings.maxGuests = fullSettings.maxGuests;
    settings.unitTypeId = fullSettings.unitTypeId;
    settings.floors = fullSettings.floors;
    settings.checkInTime = fullSettings.checkInTime;
    settings.checkOutTime = fullSettings.checkOutTime;
    settings.selfCheckIn = fullSettings.selfCheckIn;
    hasSettings = true;
  }
  if (sectionSet.has('amenities')) {
    settings.enabledAmenities = fullSettings.enabledAmenities;
    settings.customAmenities = fullSettings.customAmenities;
    hasSettings = true;
  }
  if (sectionSet.has('house-rules')) {
    settings.enabledHouseRules = fullSettings.enabledHouseRules;
    settings.customHouseRules = fullSettings.customHouseRules;
    hasSettings = true;
  }
  if (sectionSet.has('guest-form')) {
    settings.allowPets = fullSettings.allowPets;
    settings.allowParking = fullSettings.allowParking;
    settings.allowSurpriseDecor = fullSettings.allowSurpriseDecor;
    settings.preferredOwnerParkingId =
      typeof fullSettings.preferredOwnerParkingId === 'string'
        ? fullSettings.preferredOwnerParkingId.trim() || null
        : null;
    settings.complimentaryOwnerParking = fullSettings.complimentaryOwnerParking === true;
    hasSettings = true;
  }
  if (sectionSet.has('cancellation')) {
    settings.cancellationPolicy = fullSettings.cancellationPolicy;
    hasSettings = true;
  }
  if (sectionSet.has('location')) {
    settings.city = fullSettings.city;
    settings.province = fullSettings.province;
    settings.country = fullSettings.country;
    settings.zipCode = fullSettings.zipCode;
    settings.latitude = fullSettings.latitude;
    settings.longitude = fullSettings.longitude;
    settings.mapsUrl = fullSettings.mapsUrl;
    settings.placeId = fullSettings.placeId;
    hasSettings = true;
  }

  if (hasSettings) {
    payload.settings = settings;
  }

  const hasDb =
    payload.name !== undefined ||
    payload.tower !== undefined ||
    payload.unitNumber !== undefined ||
    payload.residenceName !== undefined ||
    payload.address !== undefined ||
    payload.maxGuests !== undefined;

  if (!hasDb && !hasSettings) return null;
  return payload;
}

export type AppSettingsPatchBody = {
  emailReplyTo?: string;
  parkingOwnerEmails?: string;
  sdRefundCronEmailLeadHours?: number;
  sdRefundCronMaxCheckoutAgeDays?: number;
  automationToggles?: PropertyAutomationToggles;
  paymentMethods?: PropertyPaymentMethod[];
  gafUnitOwner?: string;
  gafTowerAndUnitNumber?: string;
  gafGuestsOnsiteContactPerson?: string;
  gafOwnerContactNumber?: string;
  brandColor?: string;
  facebookPageUrl?: string;
  airbnbUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  externalReviews?: PropertyExternalReview[];
  vouchersEnabled?: boolean;
  voucherPrizes?: PropertyVoucherPrize[];
  voucherRevealStyle?: VoucherRevealStyle;
  settingsVerificationToken?: string;
  /** Page Editor autosave — server requires `publicPagesAutosave` plan feature. */
  publicPagesAutosaveGate?: boolean;
};

export function buildAppSettingsPatchForSections(
  draft: AppSettingsFormValues,
  sections: PropertySettingsSectionId[]
): AppSettingsPatchBody | null {
  if (sections.length === 0) return null;

  const sectionSet = new Set(sections);
  const patch: AppSettingsPatchBody = {};

  if (sectionSet.has('basic')) {
    patch.brandColor = draft.brandColor;
  }
  if (sectionSet.has('branding')) {
    patch.facebookPageUrl = draft.facebookPageUrl;
    patch.airbnbUrl = draft.airbnbUrl;
    patch.instagramUrl = draft.instagramUrl;
    patch.tiktokUrl = draft.tiktokUrl;
  }
  if (sectionSet.has('guest-rewards')) {
    patch.externalReviews = draft.externalReviews;
    patch.vouchersEnabled = draft.vouchersEnabled;
    patch.voucherPrizes = draft.voucherPrizes;
    patch.voucherRevealStyle = draft.voucherRevealStyle;
  }
  if (sectionSet.has('payment')) {
    patch.paymentMethods = draft.paymentMethods;
  }
  if (sectionSet.has('building-forms')) {
    patch.gafUnitOwner = draft.gafUnitOwner;
    patch.gafTowerAndUnitNumber = draft.gafTowerAndUnitNumber;
    patch.gafGuestsOnsiteContactPerson = draft.gafGuestsOnsiteContactPerson;
    patch.gafOwnerContactNumber = draft.gafOwnerContactNumber;
  }
  if (sectionSet.has('email-automations')) {
    patch.emailReplyTo = draft.emailReplyTo;
    patch.parkingOwnerEmails = draft.parkingOwnerEmails;
    patch.sdRefundCronEmailLeadHours = draft.sdRefundCronEmailLeadHours;
    patch.sdRefundCronMaxCheckoutAgeDays = draft.sdRefundCronMaxCheckoutAgeDays;
    patch.automationToggles = draft.automationToggles;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function applySavedProfileSections(
  current: PropertyProfileDraft,
  saved: PropertyProfileDraft,
  sections: PropertySettingsSectionId[]
): PropertyProfileDraft {
  const sectionSet = new Set(sections);
  let next = { ...current };

  if (sectionSet.has('basic')) {
    next = {
      ...next,
      name: saved.name,
      type: saved.type,
      tower: saved.tower,
      unitNumber: saved.unitNumber,
      residenceName: saved.residenceName,
      address: saved.address,
      maxGuests: saved.maxGuests,
      description: saved.description,
      contactName: saved.contactName,
      contactRole: saved.contactRole,
      contactPhone: saved.contactPhone,
      contactEmail: saved.contactEmail,
    };
  }
  if (sectionSet.has('media')) {
    next = { ...next, media: saved.media };
  }
  if (sectionSet.has('details')) {
    next = {
      ...next,
      bedrooms: saved.bedrooms,
      bathrooms: saved.bathrooms,
      maxAdults: saved.maxAdults,
      maxChildren: saved.maxChildren,
      floors: saved.floors,
      checkInTime: saved.checkInTime,
      checkOutTime: saved.checkOutTime,
      selfCheckIn: saved.selfCheckIn,
    };
  }
  if (sectionSet.has('amenities')) {
    next = {
      ...next,
      enabledAmenities: saved.enabledAmenities,
      customAmenities: saved.customAmenities,
    };
  }
  if (sectionSet.has('house-rules')) {
    next = {
      ...next,
      enabledHouseRules: saved.enabledHouseRules,
      customHouseRules: saved.customHouseRules,
    };
  }
  if (sectionSet.has('guest-form')) {
    next = {
      ...next,
      allowPets: saved.allowPets,
      allowParking: saved.allowParking,
      allowSurpriseDecor: saved.allowSurpriseDecor,
      preferredOwnerParkingId: saved.preferredOwnerParkingId,
      complimentaryOwnerParking: saved.complimentaryOwnerParking,
    };
  }
  if (sectionSet.has('cancellation')) {
    next = { ...next, cancellationPolicy: saved.cancellationPolicy };
  }
  if (sectionSet.has('location')) {
    next = {
      ...next,
      address: saved.address,
      city: saved.city,
      province: saved.province,
      country: saved.country,
      zipCode: saved.zipCode,
      latitude: saved.latitude,
      longitude: saved.longitude,
      mapsUrl: saved.mapsUrl,
      placeId: saved.placeId,
    };
  }

  return next;
}

export function applySavedOperationalSections(
  current: AppSettingsFormValues,
  saved: AppSettingsFormValues,
  sections: PropertySettingsSectionId[]
): AppSettingsFormValues {
  const sectionSet = new Set(sections);
  let next = { ...current };

  if (sectionSet.has('basic')) {
    next = { ...next, brandColor: saved.brandColor };
  }
  if (sectionSet.has('branding')) {
    next = {
      ...next,
      facebookPageUrl: saved.facebookPageUrl,
      airbnbUrl: saved.airbnbUrl,
      instagramUrl: saved.instagramUrl,
      tiktokUrl: saved.tiktokUrl,
    };
  }
  if (sectionSet.has('guest-rewards')) {
    next = {
      ...next,
      externalReviews: saved.externalReviews,
      vouchersEnabled: saved.vouchersEnabled,
      voucherPrizes: saved.voucherPrizes,
      voucherRevealStyle: saved.voucherRevealStyle,
    };
  }
  if (sectionSet.has('payment')) {
    next = {
      ...next,
      paymentMethods: saved.paymentMethods,
      ...syncLegacyPaymentFieldsFromMethods(saved.paymentMethods),
    };
  }
  if (sectionSet.has('building-forms')) {
    next = {
      ...next,
      gafUnitOwner: saved.gafUnitOwner,
      gafTowerAndUnitNumber: saved.gafTowerAndUnitNumber,
      gafGuestsOnsiteContactPerson: saved.gafGuestsOnsiteContactPerson,
      gafOwnerContactNumber: saved.gafOwnerContactNumber,
    };
  }
  if (sectionSet.has('email-automations')) {
    next = {
      ...next,
      emailTo: saved.emailTo,
      emailReplyTo: saved.emailReplyTo,
      parkingOwnerEmails: saved.parkingOwnerEmails,
      sdRefundCronEmailLeadHours: saved.sdRefundCronEmailLeadHours,
      sdRefundCronMaxCheckoutAgeDays: saved.sdRefundCronMaxCheckoutAgeDays,
      defaultParkingRateGuest: saved.defaultParkingRateGuest,
      automationToggles: saved.automationToggles,
    };
  }

  return next;
}
