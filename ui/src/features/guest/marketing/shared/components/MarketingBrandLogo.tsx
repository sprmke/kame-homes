import { platformMarkInitial, platformWordmarkParts } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

export type MarketingBrandLogoTone = 'default' | 'onPrimary';

export interface MarketingBrandLogoProps {
  className?: string;
  tone?: MarketingBrandLogoTone;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  markClassName?: string;
}

export function MarketingBrandLogo({
  className,
  tone = 'default',
  showWordmark = true,
  wordmarkClassName,
  markClassName,
}: MarketingBrandLogoProps) {
  const wordmark = platformWordmarkParts();
  const markInitial = platformMarkInitial();

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'from-primary to-primary/80 shadow-primary/25 relative flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br shadow-md md:size-10 md:rounded-xl md:shadow-lg',
          tone === 'onPrimary' && 'ring-2 ring-white/25',
          markClassName
        )}
      >
        {markInitial ? (
          <span className="text-base font-bold text-white md:text-xl">{markInitial}</span>
        ) : (
          <span className="bg-primary-foreground/90 h-3 w-3 rounded-full" aria-hidden />
        )}
        <div className="absolute inset-0 rounded-[inherit] bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {showWordmark && wordmark ? (
        <span
          className={cn(
            'text-[17px] font-bold tracking-tight md:text-xl',
            tone === 'onPrimary' ? 'text-white' : 'text-foreground',
            wordmarkClassName
          )}
        >
          {tone === 'onPrimary' ? (
            <>
              {wordmark.primary}
              {wordmark.accent ? <span className="text-white/85">{wordmark.accent}</span> : null}
            </>
          ) : (
            <>
              {wordmark.primary}
              {wordmark.accent ? <span className="text-primary">{wordmark.accent}</span> : null}
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
