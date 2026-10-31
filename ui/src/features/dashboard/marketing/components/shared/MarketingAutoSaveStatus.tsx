import { AlertCircle, Check, Cloud, Loader2 } from 'lucide-react';

import type { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';

type Props = {
  status: MarketingAutoSaveStatus;
  errorMessage?: string | null;
};

export function MarketingAutoSaveStatus({ status, errorMessage }: Props) {
  if (status === 'idle') return null;

  if (status === 'pending') {
    return (
      <span className="text-muted-foreground flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm">
        <Cloud className="size-3.5 shrink-0" aria-hidden />
        Unsaved
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="text-muted-foreground flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm">
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="text-muted-foreground flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm">
        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Saved
      </span>
    );
  }

  return (
    <span
      className="text-destructive flex min-h-[44px] items-center gap-1.5 px-1 text-xs sm:text-sm"
      title={errorMessage ?? undefined}
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      Save failed
    </span>
  );
}
