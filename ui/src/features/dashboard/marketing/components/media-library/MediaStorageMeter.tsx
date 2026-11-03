import {
  formatBytes,
  formatMb,
  meterShare,
  storageLevel,
} from '@/features/dashboard/marketing/lib/media/marketingMediaRules';
import type { MarketingMediaUsage } from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Props = {
  usage: MarketingMediaUsage;
  onUpgrade?: () => void;
  className?: string;
};

export function MediaStorageMeter({ usage, onUpgrade, className }: Props) {
  const level = storageLevel(usage);
  const share = Math.round(meterShare(usage) * 100);
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-foreground font-medium">
          {formatBytes(usage.usedBytes)} of {formatMb(usage.limits.storageMb)} used
        </span>
        <span className="text-muted-foreground">
          {usage.files} of {usage.limits.maxFiles} files
        </span>
      </div>
      <Progress
        value={share}
        aria-label="Media storage used"
        className={cn(
          'h-1.5',
          level === 'ok' && 'bg-primary/15',
          level === 'warn' && 'bg-amber-500/20 [&>div]:bg-amber-500',
          level === 'full' && 'bg-red-500/20 [&>div]:bg-red-500'
        )}
      />
      {level !== 'ok' && onUpgrade ? (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-muted-foreground text-xs">
            {level === 'full' ? 'Storage is full' : 'Almost full'}
          </span>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onUpgrade}>
            Upgrade
          </Button>
        </div>
      ) : null}
    </div>
  );
}
