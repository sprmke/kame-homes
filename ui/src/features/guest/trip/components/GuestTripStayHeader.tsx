import { Home } from 'lucide-react';

import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { cn } from '@/lib/utils';

/** Compact stay identity: photo, property, dates. The status lives in the Now card below. */
export function GuestTripStayHeader({
  propertyName,
  imageUrl,
  dateRangeLabel,
  nights,
  placeLabel,
  dimmed,
}: {
  propertyName: string;
  imageUrl: string | null;
  dateRangeLabel: string;
  nights: number;
  placeLabel: string;
  dimmed: boolean;
}) {
  return (
    <header className="flex items-center gap-4">
      <div className="bg-muted relative size-[72px] shrink-0 overflow-hidden rounded-2xl sm:size-20">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="80px"
            className={cn('object-cover', dimmed && 'grayscale')}
          />
        ) : (
          <Home className="text-muted-foreground absolute inset-0 m-auto size-6" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <h1 className="text-balance text-xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">
          {propertyName}
        </h1>
        <p className="text-foreground/80 mt-1 text-sm tabular-nums">
          {dateRangeLabel}
          <span className="text-muted-foreground">
            {' '}
            · {nights === 1 ? '1 night' : `${nights} nights`}
          </span>
        </p>
        {placeLabel ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{placeLabel}</p>
        ) : null}
      </div>
    </header>
  );
}
