import type { MarketingGenerationReference } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  references: MarketingGenerationReference[];
  selectedIds: Set<string>;
  remainingSlots: number;
  onPick: (reference: MarketingGenerationReference) => void;
};

export function AiStudioReferenceLibraryDrawer({
  open,
  onOpenChange,
  references,
  selectedIds,
  remainingSlots,
  onPick,
}: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent sheetLayout="split" className="lg:max-w-lg">
        <ResponsiveModalHeader className="px-4 pt-4 lg:px-0 lg:pt-0">
          <ResponsiveModalTitle>Library</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 lg:px-0 lg:pb-0">
          {references.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No saved photos</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {references.map((reference) => {
                const selected = selectedIds.has(reference.id);
                const blocked = !selected && remainingSlots <= 0;
                return (
                  <button
                    key={reference.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      if (selected || blocked) return;
                      onPick(reference);
                      if (remainingSlots <= 1) onOpenChange(false);
                    }}
                    className={cn(
                      'relative aspect-square min-h-[44px] overflow-hidden rounded-lg',
                      selected && 'ring-primary ring-2 ring-offset-2',
                      blocked && 'opacity-40'
                    )}
                    aria-label={
                      selected
                        ? `${reference.file_name ?? 'Reference'} selected`
                        : `Use ${reference.file_name ?? 'reference'}`
                    }
                    aria-pressed={selected}
                  >
                    <img src={reference.public_url} alt="" className="size-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-4 pb-4 lg:hidden">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
