import { Link } from 'react-router-dom';

import { GUEST_ACCOUNT_NAV_ITEMS } from '@/features/guest/account/lib/guestAccountNav';

import { resolveActiveNavHref } from '@/features/dashboard/bookings/lib/navActive';

import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

type GuestAccountMobileNavProps = {
  pathname: string;
  className?: string;
};

export function GuestAccountMobileNav({ pathname, className }: GuestAccountMobileNavProps) {
  const navHrefs = GUEST_ACCOUNT_NAV_ITEMS.map((item) => item.href);
  const activeNavHref = resolveActiveNavHref(pathname, navHrefs);
  const { containerRef, setItemRef, bounds } = useSlidingActivePill(activeNavHref, [
    navHrefs.join('\0'),
  ]);

  return (
    <nav
      className={cn(
        'border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 overflow-hidden border-b backdrop-blur',
        className
      )}
      aria-label="Account"
    >
      <div ref={containerRef} className="relative grid grid-cols-6 gap-0.5 px-1.5 py-1.5 sm:px-2">
        {bounds ? (
          <SlidingActivePill bounds={bounds} className="bg-primary-strong rounded-xl shadow-sm" />
        ) : null}
        {GUEST_ACCOUNT_NAV_ITEMS.map((item) => {
          const active = item.href === activeNavHref;
          const Icon = item.Icon;

          return (
            <Link
              key={item.href}
              ref={setItemRef(item.href)}
              to={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              className={cn(
                'relative z-[1] flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors',
                active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="w-full truncate text-center text-[10px] font-medium leading-none sm:text-[11px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
