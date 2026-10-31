import { Shield } from 'lucide-react';

import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

type SuperAdminSidebarScopeProps = {
  collapsed?: boolean;
  variant?: 'default' | 'onPrimary';
};

export function SuperAdminSidebarScope({
  collapsed = false,
  variant = 'default',
}: SuperAdminSidebarScopeProps) {
  const onPrimary = variant === 'onPrimary';
  const scopeIcon = (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        onPrimary
          ? 'bg-primary-foreground/15 text-primary-foreground'
          : 'bg-primary/10 text-primary'
      )}
    >
      <Shield className="h-5 w-5" aria-hidden />
    </div>
  );

  if (collapsed) {
    return <div className="flex w-full justify-center">{scopeIcon}</div>;
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-2 py-2',
        onPrimary ? 'text-primary-foreground' : 'text-sidebar-foreground'
      )}
    >
      {scopeIcon}
      <div className="flex min-w-0 flex-col items-start text-left">
        <span
          className={cn(
            'w-full truncate text-sm font-semibold',
            onPrimary ? 'text-primary-foreground' : 'text-sidebar-foreground'
          )}
        >
          {PLATFORM_APP_NAME || 'Platform admin'}
        </span>
        <span
          className={cn(
            'w-full truncate text-xs',
            onPrimary ? 'text-primary-foreground/70' : 'text-sidebar-muted'
          )}
        >
          Super Admin
        </span>
      </div>
    </div>
  );
}
