import { useState } from 'react';

import { Redo2, RotateCcw, Undo2 } from 'lucide-react';

import { MarketingResetConfirmDialog } from '@/features/dashboard/marketing/components/shared/MarketingResetConfirmDialog';

import { Button } from '@/components/ui/button';

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset?: () => void;
  resetDisabled?: boolean;
  resetTitle?: string;
  resetDescription?: string;
};

export function MarketingEditorHistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  resetDisabled = false,
  resetTitle,
  resetDescription,
}: Props) {
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (⌘Z)"
          onClick={onUndo}
        >
          <Undo2 className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (⌘⇧Z)"
          onClick={onRedo}
        >
          <Redo2 className="size-4" aria-hidden />
        </Button>
        {onReset ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            disabled={resetDisabled}
            aria-label="Reset to default"
            title="Reset to default"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      {onReset ? (
        <MarketingResetConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title={resetTitle}
          description={resetDescription}
          onConfirm={() => {
            setResetOpen(false);
            onReset();
          }}
        />
      ) : null}
    </>
  );
}
