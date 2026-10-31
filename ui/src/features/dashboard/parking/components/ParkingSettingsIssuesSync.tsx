import { useEffect } from 'react';

import { useSavedParkingSettingsCompletion } from '@/features/dashboard/parking/hooks/useParkingSettingsCompletion';
import { setParkingSettingsIssueSections } from '@/features/dashboard/parking/lib/parkingSettingsIssuesStore';

/** Keeps sidebar section-nav dots in sync with saved parking settings completeness. */
export function ParkingSettingsIssuesSync() {
  const completion = useSavedParkingSettingsCompletion();

  useEffect(() => {
    setParkingSettingsIssueSections(completion.issueSectionIds);
  }, [completion.issueSectionIds]);

  return null;
}
