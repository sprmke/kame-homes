import { User } from 'lucide-react';

import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';

import {
  VERIFICATION_PREVIEW_CAPTION,
  VERIFICATION_PREVIEW_FALLBACK_NAME,
} from '@/features/dashboard/org/lib/verificationCopy';

import { cn } from '@/lib/utils';

type Props = {
  hostName?: string | null;
  className?: string;
  /** Hide the muted caption under the mock (when parent already explains). */
  showCaption?: boolean;
};

export function RecommendedBadgePreview({ hostName, className, showCaption = true }: Props) {
  const name = hostName?.trim() || VERIFICATION_PREVIEW_FALLBACK_NAME;
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <div className={cn('min-w-0', className)}>
      <div
        className="border-border bg-background flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
        aria-hidden
      >
        <div className="from-primary to-primary/80 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-bold text-white">
          {name === VERIFICATION_PREVIEW_FALLBACK_NAME ? (
            <User className="size-3.5 opacity-90" strokeWidth={2} />
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
          {VERIFICATION_PREVIEW_CAPTION}
        </p>
      ) : null}
    </div>
  );
}
