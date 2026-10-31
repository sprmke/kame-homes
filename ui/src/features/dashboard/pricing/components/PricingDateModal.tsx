import { useEffect, useRef } from 'react';

import { format } from 'date-fns';
import { Ban, CalendarRange, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `blocked` when every selected night is already blocked (offer Unblock only). Omit `onBlock`/`onUnblock` to disable date blocking entirely. */
  mode?: 'available' | 'blocked';
  selectedDates: Date[];
  suggestedPrice: number;
  newPrice: string;
  onNewPriceChange: (value: string) => void;
  onResetToDefault: () => void;
  onApply: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  saving?: boolean;
};

function formatSelectionSummary(dates: Date[]): {
  headline: string;
  nights: number;
} {
  if (dates.length === 0) {
    return { headline: '', nights: 0 };
  }

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (dates.length === 1) {
    return {
      headline: format(first, 'EEEE, MMM d, yyyy'),
      nights: 1,
    };
  }

  return {
    headline: `${format(first, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`,
    nights: dates.length,
  };
}

export function PricingDateModal({
  open,
  onOpenChange,
  mode = 'available',
  selectedDates,
  suggestedPrice,
  newPrice,
  onNewPriceChange,
  onResetToDefault,
  onApply,
  onBlock,
  onUnblock,
  saving = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { headline, nights } = formatSelectionSummary(selectedDates);
  const parsedPrice = Number(newPrice);
  const matchesDefault =
    newPrice.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice === suggestedPrice;

  useEffect(() => {
    if (!open || mode !== 'available') return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, mode, selectedDates]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="max-w-[min(calc(100vw-1.5rem),28rem)] gap-0 overflow-hidden !p-0"
      >
        <ResponsiveModalHeader className="border-border/60 space-y-4 border-b px-4 pb-4 pt-5 text-left sm:px-5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                mode === 'blocked' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
              )}
            >
              {mode === 'blocked' ? (
                <Ban className="size-5" aria-hidden />
              ) : (
                <CalendarRange className="size-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <ResponsiveModalTitle className="text-base font-semibold leading-snug sm:text-lg">
                {mode === 'blocked' ? 'Blocked dates' : 'Set nightly rate'}
              </ResponsiveModalTitle>
            </div>
          </div>

          {headline ? (
            <div className="border-border/60 bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <p className="text-foreground min-w-0 text-sm font-medium leading-snug">{headline}</p>
              <span className="bg-background text-muted-foreground ring-border/60 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1">
                {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
            </div>
          ) : null}
        </ResponsiveModalHeader>

        {mode === 'available' ? (
          <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="custom-nightly-price" className="flex text-sm font-medium">
                Rate per night
              </Label>
              <button
                type="button"
                className={cn(
                  'shrink-0 rounded-md px-2 text-xs font-medium tabular-nums transition-colors',
                  matchesDefault
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
                onClick={() => onNewPriceChange(String(suggestedPrice))}
              >
                Default {formatMoneyCompact(suggestedPrice)}
              </button>
            </div>

            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-medium">
                ₱
              </span>
              <Input
                ref={inputRef}
                id="custom-nightly-price"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={newPrice}
                placeholder={String(suggestedPrice)}
                onChange={(e) => onNewPriceChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newPrice.trim()) onApply();
                  }
                }}
                className="h-11 pl-9 text-base font-semibold tabular-nums sm:h-12 sm:text-lg"
              />
            </div>
          </div>
        ) : null}

        <ResponsiveModalFooter className="border-border/60 bg-muted/20 flex-col gap-2 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {mode === 'blocked' && onUnblock ? (
            <Button
              type="button"
              className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
              onClick={onUnblock}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Unblock
            </Button>
          ) : (
            <>
              {onBlock ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={onBlock}
                  disabled={saving}
                >
                  <Ban className="mr-1.5 size-4" aria-hidden />
                  Block
                </Button>
              ) : (
                <span className="hidden sm:block" aria-hidden />
              )}
              <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={onResetToDefault}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={onApply}
                  disabled={!newPrice.trim() || saving}
                >
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Apply
                </Button>
              </div>
            </>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
