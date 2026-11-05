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
    <section className={cn('public-section-y container mx-auto px-4 sm:px-6 lg:px-8', className)}>
      <div className={cn('min-w-0', narrow && MARKETING_PUBLIC_NARROW_CLASS)}>{children}</div>
    </section>
  );
}
