import type { ReactNode } from 'react';

import { MARKETING_PUBLIC_NARROW_CLASS } from '@/features/guest/marketing/shared/components/MarketingPublicPageHero';

import { cn } from '@/lib/utils';

interface MarketingPublicPageContentProps {
  children: ReactNode;
  className?: string;
  /**
   * Caps reading width and centers the column so side margins balance
   * (same column as `MarketingPublicPageHero narrow`).
   */
  narrow?: boolean;
}

export function MarketingPublicPageContent({
  children,
  className,
  narrow = false,
}: MarketingPublicPageContentProps) {
  return (
    <section
      className={cn('container mx-auto px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20', className)}
    >
      <div className={cn('min-w-0', narrow && MARKETING_PUBLIC_NARROW_CLASS)}>{children}</div>
    </section>
  );
}
