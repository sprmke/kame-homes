import { Link } from 'react-router-dom';

import { LogOut } from 'lucide-react';

import { useGuestProfile } from '@/features/guest/account/hooks/useGuestProfile';
import { useGuestSignOut } from '@/features/guest/account/hooks/useGuestSignOut';
import {
  guestInitials,
  resolveGuestAvatarUrl,
  resolveGuestDisplayName,
} from '@/features/guest/account/lib/guestAccountIdentity';
import { GUEST_ACCOUNT_NAV_ITEMS } from '@/features/guest/account/lib/guestAccountNav';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

import { resolveActiveNavHref } from '@/features/dashboard/bookings/lib/navActive';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

type GuestAccountSidebarProps = {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
};

export function GuestAccountSidebar({ pathname, onNavigate, className }: GuestAccountSidebarProps) {
  const { session } = useGuestSession();
  const { data: profile } = useGuestProfile();
  const signOut = useGuestSignOut();

  const navHrefs = GUEST_ACCOUNT_NAV_ITEMS.map((item) => item.href);
  const activeNavHref = resolveActiveNavHref(pathname, navHrefs);
  const { containerRef, setItemRef, bounds } = useSlidingActivePill(activeNavHref, [
    navHrefs.join('\0'),
  ]);

  const displayName = resolveGuestDisplayName(session, profile);
  const avatarUrl = resolveGuestAvatarUrl(session, profile);
  const initials = guestInitials(displayName);
  const email = profile?.email ?? session?.user?.email ?? '';

  const handleSignOut = async () => {
    const ok = await signOut();
    if (ok) {
      onNavigate?.();
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="border-sidebar-border border-b px-4 py-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-11 shrink-0">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="from-primary/90 to-primary bg-gradient-to-br text-sm text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sidebar-foreground truncate text-sm font-semibold">{displayName}</p>
            {email ? <p className="text-sidebar-muted truncate text-xs">{email}</p> : null}
          </div>
        </div>
      </div>

      <nav
        ref={containerRef}
        className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Account menu"
      >
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
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative z-[1] flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                active
                  ? 'text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-muted/40'
              )}
            >
              <Icon
                className={cn(
                  'size-5 shrink-0 transition-colors',
                  active
                    ? 'text-primary-foreground'
                    : 'text-sidebar-muted group-hover:text-foreground'
                )}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-sidebar-foreground hover:bg-muted/60 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
        >
          <LogOut className="text-sidebar-muted size-5 shrink-0" aria-hidden />
          Log out
        </button>
      </div>
    </div>
  );
}
