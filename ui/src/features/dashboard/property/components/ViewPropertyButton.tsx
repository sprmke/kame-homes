import { ExternalLink } from 'lucide-react';

import { absoluteGuestPropertyUrl } from '@/features/guest/lib/guestPublicPaths';

import { mobileHeroActionClassName } from '@/components/mobile/MobileHeroActionButton';
import { cn } from '@/lib/utils';

type Props = {
  propertySlug: string;
  className?: string;
  /** Icon-only trigger beside the tenant switcher on the mobile brand hero. */
  variant?: 'default' | 'heroIcon';
};

export function ViewPropertyButton({ propertySlug, className, variant = 'default' }: Props) {
  const href = absoluteGuestPropertyUrl(propertySlug);
  const heroIcon = variant === 'heroIcon';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View Property, opens in a new tab"
      className={cn(
        heroIcon
          ? mobileHeroActionClassName
          : cn(
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 sm:px-3.5',
              'gradient-primary text-primary-foreground shadow-soft text-[13px] font-semibold',
              'hover:shadow-primary-glow transition-all duration-200 motion-safe:active:scale-[0.98]'
            ),
        className
      )}
    >
      <ExternalLink className="size-4 shrink-0" aria-hidden />
      {heroIcon ? null : <span>View Property</span>}
    </a>
  );
}
