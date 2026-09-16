import { Link } from 'react-router-dom';

import { User } from 'lucide-react';

import { GuestAccountMenu } from '@/features/guest/account/components/GuestAccountMenu';
import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const controlClassName =
  'border-white/25 bg-white/15 text-white shadow-sm backdrop-blur-sm hover:bg-white/25 hover:text-white hover:border-white/40';

type GuestOperationalHeaderProps = {
  propertySlug?: string | null;
  propertyImageSrc?: string | null;
  propertyName?: string | null;
  className?: string;
  /** Overrides the default `/properties/:slug` link (e.g. for non-property flows like parking). */
  homeHref?: string;
};

function GuestOperationalAccountControl({ className }: { className?: string }) {
  const { status } = useGuestSession();
  const { openAuthModal } = useGuestAuth();

  if (status === 'authenticated') {
    return (
      <div
        className={cn(
          '[&_button]:border-white/25 [&_button]:bg-white/15 [&_button]:text-white [&_button]:shadow-sm [&_button]:backdrop-blur-sm [&_button]:hover:bg-white/25 [&_button]:hover:text-white',
          className
        )}
      >
        <GuestAccountMenu />
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn('min-h-[44px] min-w-[44px] rounded-full', controlClassName, className)}
      onClick={openAuthModal}
      aria-label="Sign in"
    >
      <User className="size-4" aria-hidden />
    </Button>
  );
}

/** Minimal chrome for property operational pages — sits on the brand-color band. */
export function GuestOperationalHeader({
  propertySlug,
  propertyImageSrc,
  propertyName,
  className,
  homeHref,
}: GuestOperationalHeaderProps) {
  const slug = propertySlug?.trim() ?? '';
  const imageUrl = propertyImageSrc?.trim();
  const name = propertyName?.trim() || 'Property';
  const propertyHref = homeHref ?? (slug ? guestPropertyPath(slug) : '/properties');

  return (
    <header
      className={cn(
        'absolute inset-x-0 top-0 z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="mx-auto flex min-h-[56px] max-w-3xl items-center justify-between gap-3">
        <Link
          to={propertyHref}
          className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-2 transition-opacity hover:opacity-90"
          aria-label={name}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="size-11 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-white/40"
            />
          ) : (
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-2 ring-white/30 backdrop-blur-sm">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-medium text-white/90">{name}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle className={cn('rounded-full', controlClassName)} />
          <GuestOperationalAccountControl />
        </div>
      </div>
    </header>
  );
}
