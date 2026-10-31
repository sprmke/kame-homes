import { useEffect } from 'react';

import { useSavedPropertySettingsCompletion } from '@/features/dashboard/org/hooks/usePropertySettingsCompletion';
import { setPropertySettingsIssueSections } from '@/features/dashboard/org/lib/propertySettingsIssuesStore';

/** Keeps sidebar section-nav dots in sync with saved property settings completeness. */
export function PropertySettingsIssuesSync() {
  const completion = useSavedPropertySettingsCompletion();

  useEffect(() => {
    setPropertySettingsIssueSections(completion.issueSectionIds);
  }, [completion.issueSectionIds]);

  return null;
}
