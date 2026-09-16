import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

import { Building2, Compass, Shield } from 'lucide-react';

import { getAppModeFromPath, type AppMode } from '@/features/guest/auth/config/mode-switch';
import { useModeSwitchTransition } from '@/features/guest/marketing/shared/context/ModeSwitchTransitionContext';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  className?: string;
  collapsed?: boolean;
};

type ModeOption = {
  value: AppMode;
  label: string;
  Icon: LucideIcon;
};

const BASE_MODES: ModeOption[] = [
  { value: 'guest', label: 'Explore', Icon: Compass },
  { value: 'host', label: 'Host', Icon: Building2 },
];

const ADMIN_MODE: ModeOption = { value: 'admin', label: 'Admin', Icon: Shield };

export function ModeSwitcher({ className, collapsed = false }: Props) {
  const { pathname } = useLocation();
  const { status } = useAdminSession();
  const capabilities = useOrganizations({ enabled: status === 'admin' });
  const mode = getAppModeFromPath(pathname);
  const { switchMode, isTransitioning } = useModeSwitchTransition();
  const modes = useMemo(
    () => (capabilities.data?.isSuperAdmin ? [...BASE_MODES, ADMIN_MODE] : BASE_MODES),
    [capabilities.data?.isSuperAdmin]
  );

  const switchTo = (target: AppMode) => {
    if (target === mode || isTransitioning) return;
    switchMode(target);
  };

  if (collapsed) {
    const currentIndex = Math.max(
      0,
      modes.findIndex((entry) => entry.value === mode)
    );
    const next = modes[(currentIndex + 1) % modes.length]!;
    const NextIcon = next.Icon;
    return (
      <button
        type="button"
        onClick={() => switchTo(next.value)}
        disabled={isTransitioning}
        className={cn(
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors disabled:pointer-events-none disabled:opacity-60',
          className
        )}
        aria-label={`Switch to ${next.label}`}
        title={`Switch to ${next.label}`}
      >
        <NextIcon className="size-5 shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'border-border bg-muted flex w-full rounded-xl border p-1 shadow-[0_1px_2px_hsl(0_0%_0%_/_0.04)]',
        className
      )}
      role="group"
      aria-label="App mode"
    >
      {modes.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => switchTo(value)}
            disabled={isTransitioning}
            aria-pressed={active}
            aria-label={label}
            className={cn(
              'flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={label}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
