/**
 * Host confirm sheet when multiple org-owned parkings are available for a stay.
 */

import { useEffect, useState } from 'react';

import { Copy, ExternalLink, Search } from 'lucide-react';

import type { OwnerDefaultParkingSlot } from '@/features/dashboard/bookings/hooks/useOwnerDefaultParking';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: OwnerDefaultParkingSlot[];
  defaultSlotId: string | null;
  checkInDate: string;
  checkOutDate: string;
  onOpen: (slot: OwnerDefaultParkingSlot) => void;
  onCopy: (slot: OwnerDefaultParkingSlot) => void;
  onSearchOthers: () => void;
};

export function OwnerParkingConfirmSheet({
  open,
  onOpenChange,
  slots,
  defaultSlotId,
  checkInDate,
  checkOutDate,
  onOpen,
  onCopy,
  onSearchOthers,
}: Props) {
  const [selectedId, setSelectedId] = useState(defaultSlotId ?? slots[0]?.id ?? '');

  useEffect(() => {
    if (!open) return;
    setSelectedId(defaultSlotId ?? slots[0]?.id ?? '');
  }, [open, defaultSlotId, slots]);

  const selected = slots.find((s) => s.id === selectedId) ?? slots[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 p-0 sm:mx-auto sm:max-w-lg">
        <SheetHeader className="border-border/60 border-b px-4 py-3 text-left">
          <SheetTitle>Your parking</SheetTitle>
          {(checkInDate || checkOutDate) && (
            <p className="text-muted-foreground text-sm">
              {[checkInDate, checkOutDate].filter(Boolean).join(' → ')}
            </p>
          )}
        </SheetHeader>

        <div className="max-h-[50dvh] space-y-1 overflow-y-auto px-2 py-2">
          {slots.map((slot) => {
            const active = slot.id === selected?.id;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedId(slot.id)}
                className={cn(
                  'flex min-h-[44px] w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors',
                  active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60'
                )}
                aria-pressed={active}
              >
                <span className="text-sm font-medium">{slot.name}</span>
                {slot.residenceName ? (
                  <span className="text-muted-foreground text-xs">{slot.residenceName}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <SheetFooter className="border-border/60 flex-col gap-2 border-t px-4 py-3 sm:flex-col">
          <div className="flex w-full gap-2">
            <Button
              type="button"
              className="min-h-[44px] flex-1"
              disabled={!selected}
              onClick={() => selected && onOpen(selected)}
            >
              <ExternalLink className="mr-1.5 size-4" aria-hidden />
              Open
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] flex-1"
              disabled={!selected}
              onClick={() => selected && onCopy(selected)}
            >
              <Copy className="mr-1.5 size-4" aria-hidden />
              Copy
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] w-full"
            onClick={onSearchOthers}
          >
            <Search className="mr-1.5 size-4" aria-hidden />
            Search other parkings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
