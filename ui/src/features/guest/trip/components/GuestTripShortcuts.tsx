import { GuestTripSmartLink } from '@/features/guest/trip/components/GuestTripSmartLink';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type GuestTripShortcut = {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Link target; omit and pass `onSelect` for in-page actions (e.g. calendar download). */
  to?: string;
  onSelect?: () => void;
};

const TILE_CLASS =
  'bg-card hover:bg-muted/70 ring-border focus-visible:ring-ring flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2.5 text-center ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]';

/** Up to four phase-picked shortcuts under the Now card. */
export function GuestTripShortcuts({ items }: { items: GuestTripShortcut[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Trip shortcuts"
      className={cn(
        'grid gap-2',
        items.length === 1 && 'grid-cols-1',
        items.length === 2 && 'grid-cols-2',
        items.length === 3 && 'grid-cols-3',
        items.length >= 4 && 'grid-cols-4'
      )}
    >
      {items.map((item) => {
        const content = (
          <>
            <item.Icon className="text-foreground/80 size-5" strokeWidth={1.75} aria-hidden />
            <span className="line-clamp-2 text-xs font-medium leading-tight">{item.label}</span>
          </>
        );
        if (item.to) {
          return (
            <GuestTripSmartLink key={item.key} to={item.to} className={TILE_CLASS}>
              {content}
            </GuestTripSmartLink>
          );
        }
        return (
          <button key={item.key} type="button" onClick={item.onSelect} className={TILE_CLASS}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
