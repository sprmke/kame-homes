import { useEffect } from 'react';

import { useSavedOrgSettingsCompletion } from '@/features/dashboard/org/hooks/useOrgSettingsCompletion';
import { setOrgSettingsIssueSections } from '@/features/dashboard/org/lib/orgSettingsIssuesStore';

/** Keeps sidebar section-nav dots in sync with saved org settings completeness. */
export function OrgSettingsIssuesSync() {
  const completion = useSavedOrgSettingsCompletion();

  useEffect(() => {
    setOrgSettingsIssueSections(completion.issueSectionIds);
  }, [completion.issueSectionIds]);

  return null;
}
