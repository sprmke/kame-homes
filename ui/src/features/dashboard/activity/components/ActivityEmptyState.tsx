import { ScrollText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  message: string;
  onClearFilters?: () => void;
  onRetry?: () => void;
  className?: string;
};

export function ActivityEmptyState({ message, onClearFilters, onRetry, className }: Props) {
  return (
    <div
      className={cn(
        'surface-card flex flex-col items-center gap-3 px-6 py-12 text-center sm:py-14',
        className
      )}
    >
      <div className="bg-muted flex size-11 items-center justify-center rounded-full">
        <ScrollText className="text-muted-foreground size-5" aria-hidden />
      </div>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      {onClearFilters ? (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
