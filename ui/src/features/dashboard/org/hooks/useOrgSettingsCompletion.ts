import { useMemo } from 'react';

import { useParams } from 'react-router-dom';

import { storedOrgSettingsMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  orgSettingsToFormValues,
  useOrgSettings,
  type OrgOperatorSettingsFormValues,
} from '@/features/dashboard/org/hooks/useOrgSettings';
import {
  computeOrgSettingsCompletion,
  type OrgSettingsCompletionResult,
} from '@/features/dashboard/org/lib/orgSettingsCompletion';
import {
  orgSettingsDraftFromOrg,
  type OrgSettingsDraft,
} from '@/features/dashboard/org/lib/orgSettingsForm';

const EMPTY_COMPLETION: OrgSettingsCompletionResult = {
  fieldErrors: {},
  issueSectionIds: [],
  firstIssueSectionId: null,
  firstErrorMessage: null,
  isValid: true,
};

type DraftCompletionInput = {
  profile: OrgSettingsDraft;
  operator: OrgOperatorSettingsFormValues;
  nameUnavailable: boolean;
  hasOrgLogo: boolean;
};

export function useOrgSettingsCompletionForDraft(input: DraftCompletionInput | null) {
  const completion = useMemo(() => {
    if (!input) return EMPTY_COMPLETION;
    return computeOrgSettingsCompletion(input);
  }, [input?.profile, input?.operator, input?.nameUnavailable, input?.hasOrgLogo]);

  return { completion };
}

/** Saved org snapshot — for sidebar indicators outside the settings editor. */
export function useSavedOrgSettingsCompletion(): OrgSettingsCompletionResult {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const { data: orgsData } = useOrganizations();
  const { data: operatorData } = useOrgSettings();

  const org = useMemo(
    () => orgsData?.organizations.find((entry) => entry.slug === orgSlug),
    [orgsData, orgSlug]
  );

  const profile = useMemo(() => (org ? orgSettingsDraftFromOrg(org) : null), [org]);

  const operator = useMemo(
    () => (operatorData ? orgSettingsToFormValues(operatorData) : null),
    [operatorData]
  );

  const hasOrgLogo = useMemo(() => {
    if (!operatorData) return false;
    return Boolean(
      storedOrgSettingsMediaUrl(operatorData.emailLogoUrl, operatorData.fieldSources.emailLogoUrl)
    );
  }, [operatorData]);

  return useMemo(() => {
    if (!profile || !operator) return EMPTY_COMPLETION;
    return computeOrgSettingsCompletion({
      profile,
      operator,
      nameUnavailable: false,
      hasOrgLogo,
    });
  }, [profile, operator, hasOrgLogo]);
}
