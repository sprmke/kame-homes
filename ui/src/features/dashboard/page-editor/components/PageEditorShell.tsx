import { useEffect, useState, type ReactNode } from 'react';

import { SlidersHorizontal } from 'lucide-react';

import { marketingEditorScrollClearanceClassName } from '@/features/dashboard/marketing/components/shared/marketingEditorDock';
import { MarketingEditorMobileToolbar } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobileToolbar';
import { MarketingEditorSidebar } from '@/features/dashboard/marketing/components/shared/MarketingEditorSidebar';
import { useMarketingSidebarLayout } from '@/features/dashboard/marketing/hooks/useMarketingSidebarLayout';
import {
  PageEditorPreviewDesktopBar,
  PageEditorPreviewHistoryControls,
  PageEditorViewportToggle,
} from '@/features/dashboard/page-editor/components/PageEditorPreviewChrome';
import { PageEditorPreviewChromeProvider } from '@/features/dashboard/page-editor/lib/pageEditorPreviewChrome';
import { PageEditorPreviewScrollProvider } from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';

import { cn } from '@/lib/utils';

const PAGE_EDITOR_SIDEBAR_WIDTH = 480;

type Props = {
  header: ReactNode;
  controls: ReactNode;
  preview: ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  className?: string;
};

export function PageEditorShell({
  header,
  controls,
  preview,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className,
}: Props) {
  const { setCollapsed } = useMarketingSidebarLayout('page-editor');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // Always open the controls sidebar when entering the editor (mobile preview fits beside it).
  useEffect(() => {
    setCollapsed(false);
  }, [setCollapsed]);

  return (
    <PageEditorPreviewScrollProvider>
      <PageEditorPreviewChromeProvider
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      >
        <div
          className={cn(
            'border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden border max-lg:rounded-none max-lg:border-x-0 lg:h-[calc(100vh-120px)] lg:min-h-[520px] lg:flex-none lg:rounded-xl',
            className
          )}
        >
          {header}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <MarketingEditorSidebar
              layoutKey="page-editor"
              fixedWidth={PAGE_EDITOR_SIDEBAR_WIDTH}
              resizable={false}
              mobileVariant="sheet"
              mobileOpen={mobilePanelOpen}
              onMobileOpenChange={setMobilePanelOpen}
              mobileTitle="Edit content"
            >
              {controls}
            </MarketingEditorSidebar>
            <div
              className={cn(
                'bg-muted/20 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                marketingEditorScrollClearanceClassName
              )}
            >
              <PageEditorPreviewDesktopBar />
              {preview}
            </div>
          </div>
        </div>

        <MarketingEditorMobileToolbar
          panelLabel="Edit content"
          panelIcon={SlidersHorizontal}
          panelOpen={mobilePanelOpen}
          onTogglePanel={() => setMobilePanelOpen((open) => !open)}
          controls={
            <>
              <PageEditorViewportToggle variant="dock" />
              <PageEditorPreviewHistoryControls />
            </>
          }
        />
      </PageEditorPreviewChromeProvider>
    </PageEditorPreviewScrollProvider>
  );
}
