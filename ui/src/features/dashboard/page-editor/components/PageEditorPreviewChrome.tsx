import { Monitor, Smartphone } from 'lucide-react';

import { MarketingEditorHistoryControls } from '@/features/dashboard/marketing/components/shared/MarketingEditorHistoryControls';
import { usePageEditorPreviewChrome } from '@/features/dashboard/page-editor/lib/pageEditorPreviewChrome';

import { Button } from '@/components/ui/button';

export function PageEditorViewportToggle({
  variant = 'group',
}: {
  /** `dock` matches Marketing Studio mobile zoom buttons. */
  variant?: 'group' | 'dock';
}) {
  const { viewport, selectDesktop, selectMobile } = usePageEditorPreviewChrome();
  const isDock = variant === 'dock';

  return (
    <div
      className={
        isDock
          ? 'flex items-center gap-1'
          : 'border-border bg-muted/30 flex items-center gap-0.5 rounded-lg border p-0.5'
      }
      role="group"
      aria-label="Preview viewport"
    >
      <Button
        type="button"
        variant={viewport === 'desktop' ? 'secondary' : isDock ? 'outline' : 'ghost'}
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        aria-label="Desktop preview"
        aria-pressed={viewport === 'desktop'}
        onClick={selectDesktop}
      >
        <Monitor className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant={viewport === 'mobile' ? 'secondary' : isDock ? 'outline' : 'ghost'}
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        aria-label="Mobile preview"
        aria-pressed={viewport === 'mobile'}
        onClick={selectMobile}
      >
        <Smartphone className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function PageEditorPreviewHistoryControls() {
  const { canUndo, canRedo, onUndo, onRedo } = usePageEditorPreviewChrome();

  return (
    <MarketingEditorHistoryControls
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
    />
  );
}

/** Desktop (`lg+`) orientation + undo/redo. Hidden on phone — those live in the editor dock. */
export function PageEditorPreviewDesktopBar() {
  return (
    <div className="border-border hidden shrink-0 items-center justify-between gap-2 border-b py-2 pl-9 pr-3 sm:pl-10 sm:pr-4 lg:flex">
      <PageEditorPreviewHistoryControls />
      <PageEditorViewportToggle />
    </div>
  );
}
