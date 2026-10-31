import { createContext, useContext, type ReactNode } from 'react';

import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';

export type StayGuidePreviewOverride = {
  kind: 'stay-guide';
  data: GuestStayGuideDto;
};

export type PropertyLandingPreviewOverride = {
  kind: 'property-landing';
  data: ResolvedPropertyDetail;
};

export type PropertyShowcasePreviewOverride = {
  kind: 'property-showcase';
  data: ResolvedPropertyDetail;
  showcaseConfig: import('@/features/guest/marketing/showcase/types/showcase').PropertyShowcaseConfig;
  templateKey: string;
};

export type PreviewOverride =
  StayGuidePreviewOverride | PropertyLandingPreviewOverride | PropertyShowcasePreviewOverride;

const PreviewOverrideContext = createContext<PreviewOverride | null>(null);

export function PreviewOverrideProvider({
  value,
  children,
}: {
  value: PreviewOverride | null;
  children: ReactNode;
}) {
  return (
    <PreviewOverrideContext.Provider value={value}>{children}</PreviewOverrideContext.Provider>
  );
}

export function usePreviewOverride(): PreviewOverride | null {
  return useContext(PreviewOverrideContext);
}
