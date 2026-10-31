import type { OrgOperatorSettingsFormValues } from '@/features/dashboard/org/hooks/useOrgSettings';
import type { OrgSettingsDraft } from '@/features/dashboard/org/lib/orgSettingsForm';
import {
  validateOrgBrandColor,
  validateOrgDescription,
  validateOrgTagline,
} from '@/features/dashboard/org/lib/orgSettingsValidation';
import {
  countFilledSocialUrls,
  socialUrlMapFromLinks,
} from '@/features/dashboard/org/lib/propertySocialLinks';

import { validateOptionalAdminUrl } from '@/lib/validation/adminSettings';
import { getReservedDisplayNameViolation } from '@/lib/validation/reservedDisplayNames';

export const ORG_NAME_MAX_LENGTH = 120;

export type OrgSettingsSectionId = 'basic' | 'branding';

export type OrgSettingsCompletionInput = {
  profile: OrgSettingsDraft;
  operator: OrgOperatorSettingsFormValues;
  nameUnavailable?: boolean;
  /** Custom org logo uploaded (not platform default). */
  hasOrgLogo?: boolean;
};

export type OrgSettingsCompletionResult = {
  fieldErrors: Record<string, string>;
  issueSectionIds: OrgSettingsSectionId[];
  firstIssueSectionId: OrgSettingsSectionId | null;
  firstErrorMessage: string | null;
  isValid: boolean;
};

export function computeOrgSettingsCompletion(
  input: OrgSettingsCompletionInput
): OrgSettingsCompletionResult {
  const { profile, operator, nameUnavailable, hasOrgLogo = false } = input;
  const fieldErrors: Record<string, string> = {};
  const issueSectionIds: OrgSettingsSectionId[] = [];

  const addIssue = (fieldId: string, message: string, sectionId: OrgSettingsSectionId) => {
    if (!fieldErrors[fieldId]) fieldErrors[fieldId] = message;
    if (!issueSectionIds.includes(sectionId)) issueSectionIds.push(sectionId);
  };

  if (!hasOrgLogo) {
    addIssue('org-logo', 'Upload an organization logo', 'basic');
  }

  const name = profile.name.trim();
  if (!name) {
    addIssue('org-name', 'Enter an organization name', 'basic');
  } else if (name.length < 2) {
    addIssue('org-name', 'Organization name must be at least 2 characters', 'basic');
  } else if (name.length > ORG_NAME_MAX_LENGTH) {
    addIssue(
      'org-name',
      `Organization name must be ${ORG_NAME_MAX_LENGTH} characters or fewer`,
      'basic'
    );
  } else {
    const reservedErr = getReservedDisplayNameViolation(name);
    if (reservedErr) addIssue('org-name', reservedErr, 'basic');
  }
  if (nameUnavailable) {
    addIssue('org-name', 'An organization with this name already exists', 'basic');
  }

  const taglineErr = validateOrgTagline(profile.tagline);
  if (taglineErr) addIssue('org-tagline', taglineErr, 'basic');

  const descriptionErr = validateOrgDescription(profile.description);
  if (descriptionErr) addIssue('org-description', descriptionErr, 'basic');

  const brandColorErr = validateOrgBrandColor(profile.brandColor);
  if (brandColorErr) addIssue('org-brand-color', brandColorErr, 'basic');

  const facebookErr = validateOptionalAdminUrl(operator.facebookPageUrl, 'Facebook page URL');
  if (facebookErr) addIssue('facebook-page-url', facebookErr, 'branding');

  const airbnbErr = validateOptionalAdminUrl(operator.airbnbUrl, 'Airbnb URL');
  if (airbnbErr) addIssue('airbnb-url', airbnbErr, 'branding');

  const instagramErr = validateOptionalAdminUrl(operator.instagramUrl, 'Instagram URL');
  if (instagramErr) addIssue('instagram-url', instagramErr, 'branding');

  const tiktokErr = validateOptionalAdminUrl(operator.tiktokUrl, 'TikTok URL');
  if (tiktokErr) addIssue('tiktok-url', tiktokErr, 'branding');

  const urls = socialUrlMapFromLinks(operator);
  if (countFilledSocialUrls(urls) === 0) {
    addIssue('facebook-page-url', 'Add at least one social link', 'branding');
  }

  const firstErrorMessage = Object.values(fieldErrors)[0] ?? null;

  return {
    fieldErrors,
    issueSectionIds,
    firstIssueSectionId: issueSectionIds[0] ?? null,
    firstErrorMessage,
    isValid: issueSectionIds.length === 0,
  };
}
