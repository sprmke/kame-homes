import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Shared reading column for legal / FAQ / pricing — centered for balance. */
export const MARKETING_PUBLIC_NARROW_CLASS = 'mx-auto w-full max-w-3xl';

interface MarketingPublicPageHeroProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  blobPosition?: 'left' | 'right';
  /** Match `MarketingPublicPageContent narrow` — same centered reading column. */
  narrow?: boolean;
  /** Footer public pages use centered hero copy by default. */
  align?: 'left' | 'center';
  titleClassName?: string;
  descriptionClassName?: string;
  children?: ReactNode;
}

export function MarketingPublicPageHero({
  eyebrow,
  title,
  description,
  blobPosition = 'right',
  narrow = false,
  align = 'center',
  titleClassName,
  descriptionClassName,
  children,
}: MarketingPublicPageHeroProps) {
  const centered = align === 'center';

  return (
    <section className="border-border relative overflow-hidden border-b">
      <div
        className={cn(
          'bg-primary/10 pointer-events-none absolute rounded-full blur-3xl',
          blobPosition === 'right'
            ? '-right-16 top-10 h-56 w-56 sm:h-64 sm:w-64'
            : '-left-10 top-16 h-48 w-48 sm:h-56 sm:w-56'
        )}
        aria-hidden
      />
      <div className="public-page-top container relative mx-auto px-4 pb-8 sm:px-6 md:pb-12 lg:px-8 lg:pb-16">
        <div
          className={cn(
            'md:pt-4 lg:pt-8',
            narrow && MARKETING_PUBLIC_NARROW_CLASS,
            centered && !narrow && 'mx-auto max-w-3xl',
            centered && 'text-center'
          )}
        >
          <span className="public-eyebrow text-primary">{eyebrow}</span>
          <h1
            className={cn(
              'public-display text-foreground mt-3 text-balance font-bold md:mt-4',
              !narrow && !centered && 'max-w-3xl',
              titleClassName
            )}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                'public-lead text-muted-foreground mt-3 md:mt-4',
                centered ? 'mx-auto max-w-2xl' : !narrow && 'max-w-2xl',
                descriptionClassName
              )}
            >
              {description}
            </div>
          ) : null}
          {children ? (
            <div
              className={cn(
                'mt-5 md:mt-7',
                centered && 'flex flex-col items-center justify-center'
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
