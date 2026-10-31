import { Link } from 'react-router-dom';

import { LayoutDashboard, LogOut } from 'lucide-react';

import { getHostMarketingNavCta } from '@/features/guest/auth/config/auth-navigation';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function hostInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'H';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function resolveHostAvatarUrl(session: NonNullable<ReturnType<typeof useAdminSession>['session']>) {
  const meta = session.user.user_metadata ?? {};
  if (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) {
    return meta.avatar_url.trim();
  }
  if (typeof meta.picture === 'string' && meta.picture.trim()) {
    return meta.picture.trim();
  }
  return null;
}

/** Host marketing nav avatar — Dashboard + sign out (mirrors GuestAccountMenu). */
export function HostAccountMenu() {
  const { status, session, name, email, signOut } = useAdminSession();

  if (status !== 'admin' || !session) {
    return null;
  }

  const displayName = name ?? email?.split('@')[0] ?? 'Host';
  const avatarUrl = resolveHostAvatarUrl(session);
  const initials = hostInitials(displayName);
  const dashboardHref = getHostMarketingNavCta(true).href;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full p-0"
          aria-label="Account menu"
        >
          <Avatar className="size-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[60] w-52">
        <DropdownMenuItem asChild>
          <Link to={dashboardHref}>
            <LayoutDashboard className="mr-2 size-4" aria-hidden />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()}>
          <LogOut className="mr-2 size-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
