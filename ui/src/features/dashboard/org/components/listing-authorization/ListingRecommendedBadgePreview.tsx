import { Home } from 'lucide-react';

import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';

import {
  LISTING_VERIFICATION_PREVIEW_CAPTION,
  LISTING_VERIFICATION_PREVIEW_FALLBACK,
} from '@/features/dashboard/org/lib/listingVerificationCopy';

import { cn } from '@/lib/utils';

type Props = {
  listingName?: string | null;
  className?: string;
  showCaption?: boolean;
};

export function ListingRecommendedBadgePreview({
  listingName,
  className,
  showCaption = true,
}: Props) {
  const name = listingName?.trim() || LISTING_VERIFICATION_PREVIEW_FALLBACK;
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <div className={cn('min-w-0', className)}>
      <div
        className="border-border bg-background flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
        aria-hidden
      >
        <div className="from-primary to-primary/80 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-bold text-white">
          {name === LISTING_VERIFICATION_PREVIEW_FALLBACK ? (
            <Home className="size-3.5 opacity-90" strokeWidth={2} />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <p className="text-foreground truncate text-xs font-semibold sm:text-sm">{name}</p>
            <ListingRecommendedBadge size="sm" withTooltip={false} />
          </div>
        </div>
      </div>
      {showCaption ? (
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          {LISTING_VERIFICATION_PREVIEW_CAPTION}
        </p>
      ) : null}
    </div>
  );
}
