import type { ReactNode } from 'react';

import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Car,
  ChevronsUpDown,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  HelpCircle,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export type FilmShellContext = 'org' | 'property';

interface NavItem {
  label: string;
  icon: LucideIcon;
}

/** Mirrors buildPropertyNavSections() in features/dashboard/bookings/lib/adminSidebarNav.ts */
const PROPERTY_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Bookings', icon: BookOpen },
  { label: 'Finance', icon: DollarSign },
  { label: 'Maintenance', icon: Wrench },
  { label: 'Pricing', icon: Tags },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Team', icon: Users },
  { label: 'Marketing', icon: Megaphone },
  { label: 'Inbox', icon: Inbox },
  { label: 'Notifications', icon: Bell },
  { label: 'Templates', icon: FileText },
  { label: 'Public Pages', icon: Globe },
  { label: 'Settings', icon: Settings },
  { label: 'Help & Support', icon: HelpCircle },
];

/** Mirrors buildOrgNavSections() */
const ORG_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Bookings', icon: BookOpen },
  { label: 'Properties', icon: Building2 },
  { label: 'Parkings', icon: Car },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Team', icon: Users },
  { label: 'Plans & Billing', icon: CreditCard },
  { label: 'Announcements', icon: Megaphone },
  { label: 'Settings', icon: Settings },
  { label: 'Help & Support', icon: HelpCircle },
];

export const FILM_ORG_NAME = 'Azure North Rentals';
export const FILM_PROPERTY_NAME = 'Monaco 2604';

export interface FilmShellProps {
  /** Sidebar item to mark active (solid primary pill, like the real sliding pill). */
  active: string;
  context?: FilmShellContext;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Shows the "Finish setup" entry above the account footer. */
  setupRemaining?: number;
  children: ReactNode;
  /** Tighter page padding for dense scenes (editors, inbox). */
  dense?: boolean;
}

/**
 * The real admin shell at desktop size: `bg-sidebar` rail with the tenant scope on top, a solid
 * `bg-primary` active pill, setup entry + account footer, and the page header above the body.
 * No top bar on desktop, exactly like `AdminLayout`.
 */
export function FilmShell({
  active,
  context = 'property',
  title,
  subtitle,
  actions,
  setupRemaining,
  children,
  dense,
}: FilmShellProps) {
  const nav = context === 'org' ? ORG_NAV : PROPERTY_NAV;
  const scopeName = context === 'org' ? FILM_ORG_NAME : FILM_PROPERTY_NAME;
  const scopeKicker = context === 'org' ? 'Organization' : FILM_ORG_NAME;
  const ScopeIcon = context === 'org' ? Building2 : Home;

  return (
    <div className="bg-background text-foreground flex h-full w-full">
      <aside className="border-sidebar-border bg-sidebar flex w-[248px] shrink-0 flex-col border-r">
        <div className="border-sidebar-border border-b px-3 py-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ScopeIcon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-semibold">{scopeName}</p>
              <p className="text-sidebar-muted truncate text-xs">{scopeKicker}</p>
            </div>
            <ChevronsUpDown className="text-sidebar-muted size-4" />
          </div>
        </div>

        <nav className="flex-1 overflow-hidden px-3 py-3">
          <div className="space-y-0.5">
            {nav.map((item) => {
              const isActive = item.label === active;
              return (
                <div
                  key={item.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-[7px] text-sm font-medium',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground'
                  )}
                >
                  <item.icon
                    className={cn(
                      'size-[18px] shrink-0',
                      isActive ? 'text-primary-foreground' : 'text-sidebar-muted'
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </nav>

        {setupRemaining != null ? (
          <div className="border-primary/20 from-primary/[0.10] to-primary/[0.03] mx-3 mb-2 flex items-center gap-2 rounded-xl border bg-gradient-to-br px-3 py-2.5">
            <ListChecks className="text-primary size-4 shrink-0" />
            <span className="text-foreground flex-1 text-sm font-medium">Finish setup</span>
            <span className="text-muted-foreground text-xs tabular-nums">{setupRemaining}</span>
          </div>
        ) : null}

        <div className="border-sidebar-border flex items-center gap-2.5 border-t p-3">
          <span className="bg-muted text-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">
            MR
          </span>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">Mika Reyes</p>
            <p className="text-sidebar-muted truncate text-xs">mika@azurenorth.ph</p>
          </div>
        </div>
      </aside>

      <main className={cn('min-w-0 flex-1 overflow-hidden', dense ? 'px-6 py-5' : 'px-8 py-6')}>
        {title ? (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="text-muted-foreground mt-0.5 text-[15px]">{subtitle}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
