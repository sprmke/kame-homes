import { ShowcaseSectionLink } from '@/features/guest/marketing/showcase/components/ShowcaseSectionLink';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import {
  resolveShowcasePrimaryCtaHref,
  resolveShowcaseSecondaryCtaHref,
  resolveShowcaseSecondaryCtaLabel,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';
import type { ShowcaseVariant } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

type Props = {
  data: ShowcaseData;
  ctaLabel?: string;
  ctaTarget?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  className?: string;
  /** Hero CTAs in Aurora match inline layout here (no magnetic hover shift). */
  layout?: 'inline' | 'stack';
};

export function primaryButtonClass(variant: ShowcaseVariant, _mode: 'light' | 'dark') {
  // Soft palette ink fill + on-accent label (never pure #fff / #000).
  const fill =
    'bg-[hsl(var(--showcase-ink,var(--foreground)))] text-[hsl(var(--showcase-on-accent,var(--background)))]';

  if (variant === 'verso' || variant === 'monolith') {
    return cn(
      'rounded-none',
      variant === 'monolith' && 'border border-transparent uppercase tracking-[0.12em]',
      fill
    );
  }
  if (variant === 'haven' || variant === 'editorial') {
    return cn('rounded-full', fill);
  }
  if (variant === 'atlas') {
    return fill;
  }
  return cn(
    'border-primary bg-primary rounded-full border text-[hsl(var(--showcase-on-accent,40_14%_96%))] shadow-sm',
    'hover:brightness-[0.97]'
  );
}

export function secondaryButtonClass(variant: ShowcaseVariant, _mode: 'light' | 'dark') {
  const outline = 'border border-border text-foreground';
  if (variant === 'verso' || variant === 'monolith') {
    return cn('rounded-none', variant === 'monolith' && 'uppercase tracking-[0.12em]', outline);
  }
  if (variant === 'haven' || variant === 'editorial') {
    return cn('rounded-full', outline);
  }
  if (variant === 'atlas') {
    return outline;
  }
  return cn('rounded-full', outline);
}

export const showcaseCtaBaseClass =
  'inline-flex min-h-12 min-w-[10.5rem] cursor-pointer items-center justify-center px-8 text-base font-semibold leading-none transition-[background-color,border-color,opacity,box-shadow] duration-200 hover:opacity-90';

const baseBtn = showcaseCtaBaseClass;

export function ShowcaseCtaActions({
  data,
  ctaLabel,
  ctaTarget,
  primaryLabel,
  secondaryLabel,
  className,
  layout = 'inline',
}: Props) {
  const { variant, mode } = useShowcaseTheme();
  const primary = ctaLabel || primaryLabel || 'Request stay';
  const secondary = secondaryLabel || resolveShowcaseSecondaryCtaLabel(data);

  return (
    <div
      className={cn(
        'mt-8 flex gap-3',
        layout === 'stack'
          ? '@sm:flex-row @sm:flex-wrap @sm:justify-center flex-col items-stretch'
          : 'flex-wrap justify-center',
        className
      )}
    >
      <ShowcaseSectionLink
        to={resolveShowcasePrimaryCtaHref(ctaTarget, data)}
        className={cn(baseBtn, primaryButtonClass(variant, mode))}
      >
        {primary}
      </ShowcaseSectionLink>
      <ShowcaseSectionLink
        to={resolveShowcaseSecondaryCtaHref(data)}
        className={cn(baseBtn, secondaryButtonClass(variant, mode))}
      >
        {secondary}
      </ShowcaseSectionLink>
    </div>
  );
}
