import type {
  AppSettingsDto,
  AppSettingsFormValues,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { validateOrgBrandColor } from '@/features/dashboard/org/lib/orgSettingsValidation';
import { MAX_PROPERTY_PAYMENT_METHODS } from '@/features/dashboard/org/lib/paymentMethods';
import {
  validatePaymentAccountName,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from '@/features/dashboard/org/lib/paymentProviders';
import { validateCancellationPolicySettings } from '@/features/dashboard/org/lib/propertyCancellationPolicy';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import { SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS } from '@/features/dashboard/org/lib/propertyEmailAutomation';
import { countPropertyMedia } from '@/features/dashboard/org/lib/propertyMedia';
import {
  getResidencePropertyDefaults,
  validateNumericField,
} from '@/features/dashboard/org/lib/propertyResidenceDefaults';
import { isCondoPropertyType } from '@/features/dashboard/org/lib/propertyResidences';
import type { PropertyProfileDraft } from '@/features/dashboard/org/lib/propertySettingsForm';
import {
  countFilledSocialUrls,
  effectiveSocialUrlMap,
  propertySocialLinkInherits,
} from '@/features/dashboard/org/lib/propertySocialLinks';
import type { OrgSocialLinks } from '@/features/dashboard/org/lib/propertySocialLinks';
import {
  isPropertyTowerForResidence,
  isValidUnitNumber,
} from '@/features/dashboard/org/lib/propertyTowerUnit';

import {
  validateAdminEmailList,
  validateOptionalAdminEmail,
  validateOptionalAdminUrl,
} from '@/lib/validation/adminSettings';
import {
  validateEmailAddress,
  validateFullPersonName,
  validatePhilippineMobilePhone,
} from '@/lib/validation/fieldValidation';
import { getReservedDisplayNameViolation } from '@/lib/validation/reservedDisplayNames';

function requireText(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

function requireAdminEmail(raw: string, label: string, emptyMessage: string): string | null {
  const empty = requireText(raw, emptyMessage);
  if (empty) return empty;
  const formatErr = validateEmailAddress(raw);
  if (formatErr) return formatErr;
  return validateOptionalAdminEmail(raw, label);
}

function requirePersonName(raw: string, emptyMessage: string): string | null {
  const empty = requireText(raw, emptyMessage);
  if (empty) return empty;
  return validateFullPersonName(raw);
}

function requirePhone(raw: string, emptyMessage: string): string | null {
  const empty = requireText(raw, emptyMessage);
  if (empty) return empty;
  return validatePhilippineMobilePhone(raw);
}

function requireTowerUnit(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Enter the tower and unit number';
  if (value.length < 3) return 'Enter a valid tower and unit number';
  return null;
}

export const MIN_PROPERTY_PHOTOS = 3;
export const MIN_PROPERTY_AMENITIES = 5;

export type PropertySettingsSectionId =
  | 'basic'
  | 'media'
  | 'details'
  | 'amenities'
  | 'house-rules'
  | 'guest-form'
  | 'cancellation'
  | 'location'
  | 'branding'
  | 'guest-rewards'
  | 'payment'
  | 'building-forms'
  | 'email-automations'
  | 'integrations'
  | 'danger';

export type PropertySettingsCompletionInput = {
  profile: PropertyProfileDraft;
  operational: AppSettingsFormValues | null;
  appSettings: AppSettingsDto | null;
  orgSocialLinks: OrgSocialLinks | null;
  nameConflict?: boolean;
  towerConflict?: boolean;
};

export type PropertySettingsCompletionResult = {
  fieldErrors: Record<string, string>;
  sectionMessages: Partial<Record<PropertySettingsSectionId, string>>;
  issueSectionIds: PropertySettingsSectionId[];
  firstIssueSectionId: PropertySettingsSectionId | null;
  firstErrorMessage: string | null;
  isComplete: boolean;
};

function signatureConfigured(appSettings: AppSettingsDto | null): boolean {
  if (!appSettings) return false;
  if (appSettings.fieldSources.gafUnitOwnerSignatureUrl === 'db') return true;
  return appSettings.gafUnitOwnerSignatureUrl.trim().length > 0;
}

export function computePropertySettingsCompletion(
  input: PropertySettingsCompletionInput
): PropertySettingsCompletionResult {
  const { profile, operational, appSettings } = input;
  const fieldErrors: Record<string, string> = {};
  const sectionMessages: Partial<Record<PropertySettingsSectionId, string>> = {};
  const issueSectionIds: PropertySettingsSectionId[] = [];

  const addSectionIssue = (sectionId: PropertySettingsSectionId, message: string) => {
    if (!sectionMessages[sectionId]) sectionMessages[sectionId] = message;
    if (!issueSectionIds.includes(sectionId)) issueSectionIds.push(sectionId);
  };

  const addFieldError = (
    fieldId: string,
    message: string,
    sectionId: PropertySettingsSectionId
  ) => {
    fieldErrors[fieldId] = message;
    if (!issueSectionIds.includes(sectionId)) issueSectionIds.push(sectionId);
  };

  // ── Basic ──
  if (profile.name.trim().length < 2) {
    addFieldError('property-name', 'Enter a property name', 'basic');
  } else {
    const reservedErr = getReservedDisplayNameViolation(profile.name);
    if (reservedErr) {
      addFieldError('property-name', reservedErr, 'basic');
    } else if (input.nameConflict) {
      addFieldError('property-name', 'A property with this name already exists', 'basic');
    }
  }

  if (!profile.type.trim()) {
    addFieldError('property-type', 'Select a property type', 'basic');
  }

  const isCondo = isCondoPropertyType(profile.type);
  const residenceName = profile.residenceName.trim();

  if (isCondo) {
    if (!residenceName) {
      addFieldError('property-residence', 'Select a residence', 'basic');
    }
    if (!profile.tower) {
      addFieldError('property-tower', 'Select a tower', 'basic');
    } else if (residenceName && !isPropertyTowerForResidence(profile.tower, residenceName)) {
      addFieldError('property-tower', 'Select a valid tower for this residence', 'basic');
    }
    if (!isValidUnitNumber(profile.unitNumber)) {
      addFieldError('property-unit', 'Enter a valid 4-digit unit number', 'basic');
    } else if (input.towerConflict) {
      addFieldError('property-unit', 'This tower and unit combination is already in use', 'basic');
    }
  }

  if (operational) {
    const brandColorErr = validateOrgBrandColor(operational.brandColor);
    if (brandColorErr) {
      addFieldError('property-brand-color', brandColorErr, 'basic');
    }
  }

  // ── Socials ──
  if (operational) {
    const orgSocials = input.orgSocialLinks ?? {
      facebookPageUrl: '',
      airbnbUrl: '',
      instagramUrl: '',
      tiktokUrl: '',
    };

    if (!propertySocialLinkInherits(operational.facebookPageUrl)) {
      const facebookErr = validateOptionalAdminUrl(
        operational.facebookPageUrl,
        'Facebook page URL'
      );
      if (facebookErr) addFieldError('property-facebook-page-url', facebookErr, 'branding');
    }

    if (!propertySocialLinkInherits(operational.airbnbUrl)) {
      const airbnbErr = validateOptionalAdminUrl(operational.airbnbUrl, 'Airbnb URL');
      if (airbnbErr) addFieldError('property-airbnb-url', airbnbErr, 'branding');
    }

    if (!propertySocialLinkInherits(operational.instagramUrl)) {
      const instagramErr = validateOptionalAdminUrl(operational.instagramUrl, 'Instagram URL');
      if (instagramErr) {
        addFieldError('property-instagram-url', instagramErr, 'branding');
      }
    }

    if (!propertySocialLinkInherits(operational.tiktokUrl)) {
      const tiktokErr = validateOptionalAdminUrl(operational.tiktokUrl, 'TikTok URL');
      if (tiktokErr) addFieldError('property-tiktok-url', tiktokErr, 'branding');
    }

    const urls = effectiveSocialUrlMap(operational, orgSocials);
    const filled = countFilledSocialUrls(urls);
    if (filled === 0) {
      addFieldError('property-facebook-page-url', 'Add at least one social link', 'branding');
    }

    // External reviews validate per-row in Manage (inline) — not as a card-level section error.

    if (operational.vouchersEnabled && operational.voucherPrizes.length === 0) {
      addFieldError('property-vouchers', 'Add at least one prize', 'guest-rewards');
    }
  }

  // ── Media ──
  const photoCount = countPropertyMedia(profile.media).images;
  if (photoCount < MIN_PROPERTY_PHOTOS) {
    addSectionIssue(
      'media',
      `Add at least ${MIN_PROPERTY_PHOTOS} photos. Guests rely on photos when choosing a stay.`
    );
  }

  // ── Details ──
  const detailDefaults = getResidencePropertyDefaults(
    profile.residenceName.trim() || DEFAULT_RESIDENCE_NAME
  );
  const detailFieldChecks: {
    value: number;
    range: (typeof detailDefaults)['floors'];
    id: string;
    label: string;
  }[] = [
    {
      value: profile.floors,
      range: detailDefaults.floors,
      id: 'property-floors',
      label: 'Floor',
    },
  ];
  for (const field of detailFieldChecks) {
    const err = validateNumericField(field.value, field.range, field.label);
    if (err) addFieldError(field.id, err, 'details');
  }

  if (!profile.checkInTime.trim()) {
    addFieldError('property-check-in', 'Set a check-in time', 'details');
  }
  if (!profile.checkOutTime.trim()) {
    addFieldError('property-check-out', 'Set a check-out time', 'details');
  }
  if (!profile.unitTypeId.trim()) {
    addFieldError('property-unit-type', 'Select a unit type', 'details');
  }

  // ── Amenities ──
  const amenityCount = profile.enabledAmenities.length;
  if (amenityCount < MIN_PROPERTY_AMENITIES) {
    addSectionIssue(
      'amenities',
      `Select at least ${MIN_PROPERTY_AMENITIES} amenities (${amenityCount} selected). This helps guests know what your property offers.`
    );
  }

  // ── Cancellation ──
  if (profile.cancellationPolicy.type === 'custom') {
    const cancellationErr = validateCancellationPolicySettings(profile.cancellationPolicy);
    if (cancellationErr) {
      if (cancellationErr.includes('title')) {
        addFieldError('cancellation-custom-title', cancellationErr, 'cancellation');
      } else if (cancellationErr.includes('description')) {
        addFieldError('cancellation-custom-description', cancellationErr, 'cancellation');
      } else {
        addFieldError('cancellation-custom-title', cancellationErr, 'cancellation');
      }
    }
  }

  // ── Location ──
  if (!profile.address.trim()) {
    addFieldError('property-address', 'Enter the street address', 'location');
  }
  if (!profile.city.trim()) {
    addFieldError('property-city', 'Enter the city', 'location');
  }
  if (!profile.province.trim()) {
    addFieldError('property-province', 'Enter the province or state', 'location');
  }
  if (!profile.country.trim()) {
    addFieldError('property-country', 'Enter the country', 'location');
  }
  if (profile.latitude == null || profile.longitude == null) {
    addFieldError('property-location-map', 'Pin your property on the map', 'location');
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

  // ── Building forms ──
  if (operational) {
    const ownerErr = requirePersonName(operational.gafUnitOwner, 'Enter the unit owner name');
    if (ownerErr) addFieldError('gaf-unit-owner', ownerErr, 'building-forms');

    const towerUnitErr = requireTowerUnit(operational.gafTowerAndUnitNumber);
    if (towerUnitErr) addFieldError('gaf-tower-unit', towerUnitErr, 'building-forms');

    const onsiteErr = requirePersonName(
      operational.gafGuestsOnsiteContactPerson,
      'Enter the on-site contact person'
    );
    if (onsiteErr) addFieldError('gaf-onsite-contact', onsiteErr, 'building-forms');

    const ownerPhoneErr = requirePhone(
      operational.gafOwnerContactNumber,
      'Enter the owner contact number'
    );
    if (ownerPhoneErr) addFieldError('gaf-owner-phone', ownerPhoneErr, 'building-forms');

    if (!signatureConfigured(appSettings)) {
      addFieldError('gaf-owner-signature', 'Upload the unit owner signature', 'building-forms');
    }
  }

  // ── Email automations ──
  if (operational) {
    const emailReplyErr = requireAdminEmail(
      operational.emailReplyTo,
      'Property email',
      'Enter property email'
    );
    if (emailReplyErr) {
      addFieldError('email-reply-to', emailReplyErr, 'email-automations');
    }

    const parkingOwnersErr = validateAdminEmailList(
      operational.parkingOwnerEmails,
      'parking owner'
    );
    if (parkingOwnersErr) {
      addFieldError('parking-owner-emails', parkingOwnersErr, 'email-automations');
    }

    const leadHours = operational.sdRefundCronEmailLeadHours;
    if (
      !Number.isFinite(leadHours) ||
      leadHours < 0 ||
      leadHours > SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS
    ) {
      addFieldError(
        'sd-lead-hours',
        `SD refund email lead must be 0–${SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS} hours`,
        'email-automations'
      );
    }

    const maxAgeDays = operational.sdRefundCronMaxCheckoutAgeDays;
    if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 365) {
      addFieldError('sd-max-age', 'Days after checkout must be 0–365', 'email-automations');
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
