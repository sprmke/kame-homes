import { createContext, useContext, type ReactNode } from 'react';

/** Page Editor preview frame size — null outside the editor. */
export type PreviewViewport = 'desktop' | 'mobile';

const PreviewViewportContext = createContext<PreviewViewport | null>(null);

export function PreviewViewportProvider({
  value,
  children,
}: {
  value: PreviewViewport;
  children: ReactNode;
}) {
  return (
    <PreviewViewportContext.Provider value={value}>{children}</PreviewViewportContext.Provider>
  );
}

export function usePreviewViewport(): PreviewViewport | null {
  return useContext(PreviewViewportContext);
}

/** True when the Page Editor mobile frame is active. Prefer container queries for layout. */
export function usePreviewForcesMobile(): boolean {
  return usePreviewViewport() === 'mobile';
}
