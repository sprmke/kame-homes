import { useState, type ReactNode } from 'react';

import { ChevronLeft, Loader2 } from 'lucide-react';

import { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/components/shared/MarketingAutoSaveStatus';
import { MarketingInlineName } from '@/features/dashboard/marketing/components/shared/MarketingInlineName';
import type { MarketingAutoSaveStatus as SaveStatus } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/useMediaQuery';

type Props = {
  /** "Posts", "Videos", "Calendar": where Back goes. */
  backLabel: string;
  /** Leaves the editor (the caller saves first). */
  onBack: () => Promise<void> | void;
  name: string;
  onRename?: (name: string) => Promise<unknown> | void;
  status: SaveStatus;
  errorMessage?: string | null;
  /** The plan cannot store designs: show an upgrade chip instead of save status. */
  canSave: boolean;
  onReload?: () => void;
  onKeepMine?: () => void;
  /** Size button (desktop). */
  size?: ReactNode;
  /** Undo / redo / reset (desktop). */
  history?: ReactNode;
  /** Download / Publish (desktop). */
  actions?: ReactNode;
};

/**
 * Editor chrome while a design is open (focus mode: the tab row is hidden).
 * Desktop: back · name · status … history · size · download · publish.
 * Phones: back · name · status; everything else lives in the bottom dock.
 */
export function MarketingEditorTopBar({
  backLabel,
  onBack,
  name,
  onRename,
  status,
  errorMessage,
  canSave,
  onReload,
  onKeepMine,
  size,
  history,
  actions,
}: Props) {
  const isBelowLg = useIsBelowLg();
  const { open: openUpgradeModal } = useUpgradeModal();
  const [leaving, setLeaving] = useState(false);

  const handleBack = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await onBack();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="border-border bg-card shrink-0 border-b">
      <div className="flex min-h-[52px] items-center gap-1 px-1.5 py-1 sm:gap-2 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] shrink-0 gap-1 px-2"
          onClick={() => void handleBack()}
          aria-label={`Back to ${backLabel}`}
        >
          {leaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ChevronLeft className="size-4" aria-hidden />
          )}
          <span className="max-sm:sr-only">{backLabel}</span>
        </Button>
        <span className="bg-border hidden h-5 w-px sm:block" aria-hidden />
        <MarketingInlineName
          name={name}
          onRename={canSave ? onRename : undefined}
          className="max-w-[min(22rem,45vw)]"
        />
        {canSave ? (
          <MarketingAutoSaveStatus status={status} errorMessage={errorMessage} />
        ) : (
          <button
            type="button"
            onClick={() => openUpgradeModal('customTemplates')}
            className="text-muted-foreground hover:text-foreground flex min-h-[44px] shrink-0 items-center gap-1.5 px-1 text-xs"
          >
            Not saved
            <TierBadge feature="customTemplates" />
          </button>
        )}
        {!isBelowLg ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {history}
            {size}
            {actions}
          </div>
        ) : null}
      </div>
      {status === 'conflict' ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <span className="min-w-0 flex-1">This design changed somewhere else.</span>
          {onReload ? (
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={onReload}>
              Reload
            </Button>
          ) : null}
          {onKeepMine ? (
            <Button type="button" className="min-h-[44px]" onClick={onKeepMine}>
              Keep mine
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
