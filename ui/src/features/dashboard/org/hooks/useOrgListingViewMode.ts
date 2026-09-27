import { useEffect, useRef, useState } from 'react';

import {
  defaultOrgListingViewMode,
  resolveOrgListingViewMode,
  type OrgListingViewMode,
} from '@/features/dashboard/org/lib/orgListingViewMode';

export function useOrgListingViewMode(
  itemCount: number,
  isLoading: boolean,
  scopeKey: string | undefined,
  options?: { hideTable?: boolean }
) {
  const hideTable = options?.hideTable ?? false;
  const userChangedView = useRef(false);
  const [viewMode, setViewMode] = useState<OrgListingViewMode>(() =>
    defaultOrgListingViewMode(itemCount, { hideTable })
  );

  useEffect(() => {
    userChangedView.current = false;
  }, [scopeKey]);

  useEffect(() => {
    if (isLoading) return;
    if (userChangedView.current) return;
    setViewMode(defaultOrgListingViewMode(itemCount, { hideTable }));
  }, [itemCount, isLoading, hideTable]);

  useEffect(() => {
    setViewMode((current) => resolveOrgListingViewMode(current, { hideTable }));
  }, [hideTable]);

  const onViewModeChange = (mode: OrgListingViewMode) => {
    userChangedView.current = true;
    setViewMode(resolveOrgListingViewMode(mode, { hideTable }));
  };

  return {
    viewMode: resolveOrgListingViewMode(viewMode, { hideTable }),
    onViewModeChange,
  };
}
