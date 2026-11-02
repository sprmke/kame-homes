import { useEffect, useRef } from 'react';

import { NavLink, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type SuperAdminSecondaryNavItem = {
  label: string;
  to: string;
  /** Match child routes too (default: exact match on `end`). */
  end?: boolean;
  icon?: LucideIcon;
  /** Force active regardless of the route match (nested/aliased routes). */
  active?: boolean;
};

type SuperAdminSecondaryNavProps = {
  items: SuperAdminSecondaryNavItem[];
  className?: string;
  ariaLabel?: string;
};

/** Horizontal, horizontally-scrollable pill tabs for Super Admin detail shells. */
export function SuperAdminSecondaryNav({
  items,
  className,
  ariaLabel = 'Sections',
}: SuperAdminSecondaryNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[data-active="true"]');
    if (!nav || !active) return;
    const left = active.offsetLeft - nav.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < nav.scrollLeft || right > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, left - 16) });
    }
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={cn(
        'overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      <div className="flex w-max min-w-0 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const pill = (active: boolean) => (
            <span
              data-active={active}
              className={cn(
                'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-strong text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
              {item.label}
            </span>
          );

          if (item.active != null) {
            return (
              <NavLink key={item.to} to={item.to}>
                {pill(item.active)}
              </NavLink>
            );
          }

          return (
            <NavLink key={item.to} to={item.to} end={item.end ?? true}>
              {({ isActive }) => pill(isActive)}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
