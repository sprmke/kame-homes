import type { ReactNode } from 'react';

import {
  Bell,
  BookOpen,
  Building2,
  Car,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sparkles,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { AbsoluteFill } from 'remotion';

import { platformMarkInitial, platformWordmarkParts } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

const filmWordmark = platformWordmarkParts();
const filmMarkInitial = platformMarkInitial();

export type FilmShellContext = 'org' | 'property' | 'parking';

interface NavItem {
  label: string;
  icon: LucideIcon;
}

/** Mirrors buildPropertyNavSections() in ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts */
const PROPERTY_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Bookings', icon: BookOpen },
  { label: 'Finance', icon: DollarSign },
  { label: 'Maintenance', icon: Wrench },
  { label: 'Pricing', icon: Tags },
  { label: 'Team', icon: Users },
  { label: 'Marketing', icon: Megaphone },
  { label: 'Inbox', icon: Inbox },
  { label: 'Notifications', icon: Bell },
  { label: 'Templates', icon: FileText },
  { label: 'Public Pages', icon: Globe },
  { label: 'Plans & Billing', icon: CreditCard },
  { label: 'Settings', icon: Settings },
  { label: 'Help & Support', icon: HelpCircle },
];

/** Mirrors buildOrgNavSections() */
const ORG_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Bookings', icon: BookOpen },
  { label: 'Properties', icon: Building2 },
  { label: 'Parkings', icon: Car },
  { label: 'Team', icon: Users },
  { label: 'Plans & Billing', icon: CreditCard },
  { label: 'Settings', icon: Settings },
  { label: 'Help & Support', icon: HelpCircle },
];

/** Mirrors buildParkingNavSections() */
const PARKING_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Bookings', icon: BookOpen },
  { label: 'Finance', icon: DollarSign },
  { label: 'Pricing', icon: Tags },
  { label: 'Team', icon: Users },
  { label: 'Inbox', icon: Inbox },
  { label: 'Notifications', icon: Bell },
  { label: 'Settings', icon: Settings },
  { label: 'Help & Support', icon: HelpCircle },
];

const NAV_BY_CONTEXT: Record<FilmShellContext, NavItem[]> = {
  org: ORG_NAV,
  property: PROPERTY_NAV,
  parking: PARKING_NAV,
};

export interface FilmShellProps {
  activeLabel: string;
  children: ReactNode;
  context?: FilmShellContext;
  /** Workspace switcher label — org name / property name / parking name. */
  workspace?: string;
  /** Small line above the workspace name (e.g. residence or org). */
  workspaceKicker?: string;
}

export function FilmShell({
  activeLabel,
  children,
  context = 'property',
  workspace = 'Monaco 2604',
  workspaceKicker = 'Azure North',
}: FilmShellProps) {
  const nav = NAV_BY_CONTEXT[context];
  return (
    <AbsoluteFill className="bg-[#f4f7f8] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex h-full">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white px-3.5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-base font-black text-white shadow-lg shadow-teal-600/20">
              {filmMarkInitial || '·'}
            </div>
            <div>
              {filmWordmark ? (
                <p className="text-[15px] font-extrabold leading-none tracking-tight">
                  {filmWordmark.primary}
                  {filmWordmark.accent ? (
                    <span className="text-teal-600 dark:text-teal-400">{filmWordmark.accent}</span>
                  ) : null}
                </p>
              ) : (
                <p className="text-[15px] font-extrabold leading-none tracking-tight">
                  Host workspace
                </p>
              )}
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Host workspace
              </p>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-[10px] font-black text-white">
              {workspace.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {workspace}
              </p>
              <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {context === 'org' ? 'Organization' : workspaceKicker}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>

          <nav className="space-y-0.5 overflow-hidden">
            {nav.map((item) => {
              const active = item.label === activeLabel;
              return (
                <div
                  key={item.label}
                  className={cn(
                    'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[12px] font-semibold',
                    active
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  <item.icon className="h-[15px] w-[15px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {active ? <ChevronRight className="ml-auto h-3.5 w-3.5" /> : null}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-teal-100 bg-teal-50/70 p-3 dark:border-teal-500/25 dark:bg-teal-500/10">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-[11px] font-bold text-teal-800 dark:text-teal-200">
                Automation live
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-teal-100 dark:bg-teal-500/20">
              <div className="h-full w-[82%] rounded-full bg-teal-500" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-[64px] items-center border-b border-slate-200 bg-white/95 px-7 dark:border-slate-800 dark:bg-slate-900/95">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {context === 'org' ? 'Organization' : workspaceKicker}
              </p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{workspace}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                All systems synced
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700">
                <Bell className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                M
              </div>
            </div>
          </header>
          <div className="h-[656px] overflow-hidden p-6">{children}</div>
        </main>
      </div>
    </AbsoluteFill>
  );
}
