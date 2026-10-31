import { ArrowLeft } from 'lucide-react';

import { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/components/shared/MarketingAutoSaveStatus';
import type { MarketingAutoSaveStatus as AutoSaveStatus } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';
import { PageEditorPreviewActions } from '@/features/dashboard/page-editor/components/PageEditorPreviewActions';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { Button } from '@/components/ui/button';

type Props = {
  /** Guest page being edited (e.g. Property, Stay Guide). */
  pageLabel: string;
  /** Called on Back click — the caller decides whether to navigate immediately or show a
   * leave-confirmation dialog first, based on whether there are unsaved changes. */
  onBack: () => void;
  autoSaveStatus: AutoSaveStatus;
  autoSaveError?: string | null;
  /** Shown instead of the autosave status when the plan doesn't include autosave (`publicPagesAutosave`) — opens the upgrade modal on click. */
  manualSave?: { visible: boolean; onClick: () => void; isSaving?: boolean };
  openHref?: string;
  copyHref?: string;
  publicPageLabel?: string;
};

export function PageEditorHeader({
  pageLabel,
  onBack,
  autoSaveStatus,
  autoSaveError,
  manualSave,
  openHref,
  copyHref,
  publicPageLabel,
}: Props) {
  const showPageLinks = Boolean(openHref && copyHref && publicPageLabel);

  return (
    <header className="border-border bg-card flex min-h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] shrink-0"
        aria-label="Back to Public Pages"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" aria-hidden />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h2 className="text-foreground truncate text-sm font-semibold sm:text-base">
          Edit - {pageLabel}
        </h2>
        <TierBadge feature="publicPagesAutosave" />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <div className="flex min-w-[5.5rem] justify-end sm:min-w-[6.5rem]">
          {manualSave?.visible ? (
            <Button
              type="button"
              size="sm"
              className="min-h-[44px]"
              onClick={manualSave.onClick}
              disabled={manualSave.isSaving}
            >
              {manualSave.isSaving ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <MarketingAutoSaveStatus status={autoSaveStatus} errorMessage={autoSaveError} />
          )}
        </div>
        {showPageLinks ? (
          <PageEditorPreviewActions
            openHref={openHref!}
            copyHref={copyHref!}
            pageLabel={publicPageLabel!}
          />
        ) : null}
      </div>
    </header>
  );
}
