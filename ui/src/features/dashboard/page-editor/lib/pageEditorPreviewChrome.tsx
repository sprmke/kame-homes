import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PreviewViewport } from '@/features/guest/lib/previewViewportContext';

import { useMarketingSidebarLayout } from '@/features/dashboard/marketing/hooks/useMarketingSidebarLayout';

type PageEditorPreviewChromeValue = {
  viewport: PreviewViewport;
  selectDesktop: () => void;
  selectMobile: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

const PageEditorPreviewChromeContext = createContext<PageEditorPreviewChromeValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  defaultViewport?: PreviewViewport;
};

export function PageEditorPreviewChromeProvider({
  children,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  defaultViewport = 'mobile',
}: ProviderProps) {
  const [viewport, setViewport] = useState<PreviewViewport>(defaultViewport);
  const { setCollapsed } = useMarketingSidebarLayout('page-editor');

  const selectDesktop = useCallback(() => {
    setViewport('desktop');
    setCollapsed(true);
  }, [setCollapsed]);

  const selectMobile = useCallback(() => {
    setViewport('mobile');
    setCollapsed(false);
  }, [setCollapsed]);

  const value = useMemo(
    () => ({
      viewport,
      selectDesktop,
      selectMobile,
      canUndo,
      canRedo,
      onUndo,
      onRedo,
    }),
    [viewport, selectDesktop, selectMobile, canUndo, canRedo, onUndo, onRedo]
  );

  return (
    <PageEditorPreviewChromeContext.Provider value={value}>
      {children}
    </PageEditorPreviewChromeContext.Provider>
  );
}

export function usePageEditorPreviewChrome(): PageEditorPreviewChromeValue {
  const ctx = useContext(PageEditorPreviewChromeContext);
  if (!ctx) {
    throw new Error(
      'usePageEditorPreviewChrome must be used within PageEditorPreviewChromeProvider'
    );
  }
  return ctx;
}
