import type { OrgOperatorSettingsFormValues } from '@/features/dashboard/org/hooks/useOrgSettings';
import type {
  OrgSettingsCompletionResult,
  OrgSettingsSectionId,
} from '@/features/dashboard/org/lib/orgSettingsCompletion';
import type { OrgSettingsDraft } from '@/features/dashboard/org/lib/orgSettingsForm';

const ORG_FIELD_SECTIONS: Record<string, OrgSettingsSectionId> = {
  'org-logo': 'basic',
  'org-name': 'basic',
  'org-tagline': 'basic',
  'org-description': 'basic',
  'org-contact-name': 'basic',
  'org-contact-role': 'basic',
  'org-contact-phone': 'basic',
  'org-contact-email': 'basic',
  'org-brand-color': 'basic',
  'facebook-page-url': 'branding',
  'airbnb-url': 'branding',
  'instagram-url': 'branding',
  'tiktok-url': 'branding',
};

export type OrgSettingsSavePlan = {
  saveProfile: boolean;
  saveOperator: boolean;
  blockedSections: OrgSettingsSectionId[];
  firstBlockedSectionId: OrgSettingsSectionId | null;
  firstBlockedMessage: string | null;
  hasSavableWork: boolean;
};

function orgBasicDirty(draft: OrgSettingsDraft, baseline: OrgSettingsDraft): boolean {
  return (
    draft.name.trim() !== baseline.name.trim() ||
    draft.description.trim() !== baseline.description.trim() ||
    draft.tagline.trim() !== baseline.tagline.trim() ||
    draft.brandColor.trim().toLowerCase() !== baseline.brandColor.trim().toLowerCase()
  );
}

function orgBrandingDirty(
  draft: OrgOperatorSettingsFormValues,
  baseline: OrgOperatorSettingsFormValues
): boolean {
  return (
    draft.facebookPageUrl.trim() !== baseline.facebookPageUrl.trim() ||
    draft.airbnbUrl.trim() !== baseline.airbnbUrl.trim() ||
    draft.instagramUrl.trim() !== baseline.instagramUrl.trim() ||
    draft.tiktokUrl.trim() !== baseline.tiktokUrl.trim()
  );
}

function orgDirtyFieldIdsInSection(
  sectionId: OrgSettingsSectionId,
  profileDraft: OrgSettingsDraft,
  profileBaseline: OrgSettingsDraft,
  operatorDraft: OrgOperatorSettingsFormValues,
  operatorBaseline: OrgOperatorSettingsFormValues
): string[] {
  const ids: string[] = [];

  if (sectionId === 'basic') {
    if (profileDraft.name.trim() !== profileBaseline.name.trim()) ids.push('org-name');
    if (profileDraft.tagline.trim() !== profileBaseline.tagline.trim()) ids.push('org-tagline');
    if (profileDraft.description.trim() !== profileBaseline.description.trim()) {
      ids.push('org-description');
    }
    if (
      profileDraft.brandColor.trim().toLowerCase() !==
      profileBaseline.brandColor.trim().toLowerCase()
    ) {
      ids.push('org-brand-color');
    }
  }

  if (sectionId === 'branding') {
    if (operatorDraft.facebookPageUrl.trim() !== operatorBaseline.facebookPageUrl.trim()) {
      ids.push('facebook-page-url');
    }
    if (operatorDraft.airbnbUrl.trim() !== operatorBaseline.airbnbUrl.trim()) {
      ids.push('airbnb-url');
    }
    if (operatorDraft.instagramUrl.trim() !== operatorBaseline.instagramUrl.trim()) {
      ids.push('instagram-url');
    }
    if (operatorDraft.tiktokUrl.trim() !== operatorBaseline.tiktokUrl.trim()) {
      ids.push('tiktok-url');
    }
  }

  return ids;
}

function orgSectionHasValidationIssue(
  sectionId: OrgSettingsSectionId,
  completion: OrgSettingsCompletionResult,
  profileDraft: OrgSettingsDraft,
  profileBaseline: OrgSettingsDraft,
  operatorDraft: OrgOperatorSettingsFormValues,
  operatorBaseline: OrgOperatorSettingsFormValues
): boolean {
  // Logo is upload-immediate (not a draft field) but still required for Basic.
  if (sectionId === 'basic' && completion.fieldErrors['org-logo']) return true;

  const dirtyFieldIds = orgDirtyFieldIdsInSection(
    sectionId,
    profileDraft,
    profileBaseline,
    operatorDraft,
    operatorBaseline
  );

  if (dirtyFieldIds.length > 0) {
    return dirtyFieldIds.some((fieldId) => Boolean(completion.fieldErrors[fieldId]));
  }

  return Object.entries(completion.fieldErrors).some(
    ([fieldId, message]) => Boolean(message) && ORG_FIELD_SECTIONS[fieldId] === sectionId
  );
}

function firstOrgSectionIssue(
  sectionId: OrgSettingsSectionId,
  completion: OrgSettingsCompletionResult
): string | null {
  for (const [fieldId, message] of Object.entries(completion.fieldErrors)) {
    if (message && ORG_FIELD_SECTIONS[fieldId] === sectionId) return message;
  }
  return null;
}

export function planOrgSettingsSave(input: {
  profileDraft: OrgSettingsDraft;
  profileBaseline: OrgSettingsDraft;
  operatorDraft: OrgOperatorSettingsFormValues;
  operatorBaseline: OrgOperatorSettingsFormValues;
  completion: OrgSettingsCompletionResult;
}): OrgSettingsSavePlan {
  const basicDirty = orgBasicDirty(input.profileDraft, input.profileBaseline);
  const brandingDirty = orgBrandingDirty(input.operatorDraft, input.operatorBaseline);

  const blockedSections: OrgSettingsSectionId[] = [];
  let saveProfile = false;
  let saveOperator = false;

  if (basicDirty) {
    if (
      orgSectionHasValidationIssue(
        'basic',
        input.completion,
        input.profileDraft,
        input.profileBaseline,
        input.operatorDraft,
        input.operatorBaseline
      )
    ) {
      blockedSections.push('basic');
    } else {
      saveProfile = true;
    }
  }

  if (brandingDirty) {
    if (
      orgSectionHasValidationIssue(
        'branding',
        input.completion,
        input.profileDraft,
        input.profileBaseline,
        input.operatorDraft,
        input.operatorBaseline
      )
    ) {
      blockedSections.push('branding');
    } else {
      saveOperator = true;
    }
  }

  const firstBlockedSectionId = blockedSections[0] ?? null;
  const firstBlockedMessage = firstBlockedSectionId
    ? firstOrgSectionIssue(firstBlockedSectionId, input.completion)
    : null;

  return {
    saveProfile,
    saveOperator,
    blockedSections,
    firstBlockedSectionId,
    firstBlockedMessage,
    hasSavableWork: saveProfile || saveOperator,
  };
}
