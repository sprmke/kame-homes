import { useState } from 'react';

import { Check, ChevronDown, Copy, Loader2, Scaling } from 'lucide-react';

import { SizeGlyph } from '@/features/dashboard/marketing/components/library/MarketingNewButton';
import type { MarketingContentType } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  MARKETING_SIZES,
  sizeLabel,
  type MarketingSizeOption,
} from '@/features/dashboard/marketing/lib/marketingLibrary';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

export type MarketingSizeSibling = { id: string; aspectPreset: string | null };

type Props = {
  contentType: MarketingContentType;
  size: string;
  /** Same design in other sizes (size group). */
  siblings: MarketingSizeSibling[];
  onOpenSibling: (id: string) => void;
  /** Make a copy in another size, linked to this design (keeps this one). */
  onCopyToSize?: (size: string) => Promise<unknown>;
  /** Change this design's size in place (layout may shift). */
  onResize?: (size: string) => Promise<unknown> | void;
  /** Sizes that can be produced (posts: 4:5 only when already open). */
  sizes?: MarketingSizeOption[];
  disabled?: boolean;
  className?: string;
  /** Controlled open state (mobile dock opens it from the ⋯ sheet). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the top-bar button (controlled use). */
  hideTrigger?: boolean;
};

/** Top-bar size button + chooser: switch to a sibling, copy to a size, or resize. */
export function MarketingSizeDialog({
  contentType,
  size,
  siblings,
  onOpenSibling,
  onCopyToSize,
  onResize,
  sizes = MARKETING_SIZES[contentType],
  disabled,
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [busy, setBusy] = useState<string | null>(null);
  const siblingBySize = new Map(
    siblings.filter((sibling) => sibling.aspectPreset).map((s) => [s.aspectPreset!, s.id])
  );
  const options = sizes.some((option) => option.value === size)
    ? sizes
    : [...sizes, ...MARKETING_SIZES[contentType].filter((option) => option.value === size)];

  const run = async (key: string, task: () => Promise<unknown> | void) => {
    setBusy(key);
    try {
      await task();
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant="outline"
          className={cn('min-h-[44px] gap-1.5', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <Scaling className="size-4" aria-hidden />
          {sizeLabel(contentType, size)}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      )}
      <ResponsiveModal open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(90dvh,40rem)] max-w-[min(calc(100vw-1.5rem),28rem)] flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:max-w-[min(90vw,28rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="shrink-0 space-y-1 px-5 pb-3 pr-12 pt-4 text-left sm:px-6">
            <ResponsiveModalTitle>Size</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              A copy keeps this design as it is. Resize changes this one.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {options.map((option) => {
              const current = option.value === size;
              const siblingId = siblingBySize.get(option.value);
              return (
                <li key={option.value} className="flex min-h-[56px] items-center gap-3 py-2">
                  <SizeGlyph width={option.width} height={option.height} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="text-muted-foreground block text-xs">{option.hint}</span>
                  </span>
                  {current ? (
                    <span className="text-primary flex items-center gap-1 text-xs font-medium">
                      <Check className="size-3.5" aria-hidden />
                      Open
                    </span>
                  ) : siblingId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => {
                        setOpen(false);
                        onOpenSibling(siblingId);
                      }}
                    >
                      Open
                    </Button>
                  ) : (
                    <span className="flex gap-1.5">
                      {onResize ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-[44px]"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void run(`resize:${option.value}`, () => onResize(option.value))
                          }
                        >
                          {busy === `resize:${option.value}` ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : null}
                          Resize
                        </Button>
                      ) : null}
                      {onCopyToSize ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-[44px] gap-1.5"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void run(`copy:${option.value}`, () => onCopyToSize(option.value))
                          }
                        >
                          {busy === `copy:${option.value}` ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Copy className="size-4" aria-hidden />
                          )}
                          Copy
                        </Button>
                      ) : null}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
