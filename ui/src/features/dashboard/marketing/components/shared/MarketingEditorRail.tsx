import type { ComponentType, ReactNode } from 'react';

import { PanelRightClose, X } from 'lucide-react';

import { MarketingEditorMobilePanel } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobilePanel';
import { MarketingEditorSidebar } from '@/features/dashboard/marketing/components/shared/MarketingEditorSidebar';
import type { MarketingSidebarLayoutKey } from '@/features/dashboard/marketing/hooks/useMarketingSidebarLayout';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type MarketingRailSection = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Panel body. Rendered only while the section is open. */
  panel: ReactNode;
  /** Header title (defaults to `label`). */
  title?: string;
  /** Clicking runs this instead of opening a panel (e.g. open the AI dialog). */
  onActivate?: () => void;
};

type RailProps = {
  layoutKey: MarketingSidebarLayoutKey;
  sections: MarketingRailSection[];
  /** Open section key, or null for a closed panel. */
  active: string | null;
  onActiveChange: (key: string | null) => void;
};

/**
 * Left icon rail + slide-out panel for the Videos and Calendar editors, styled to
 * match the Posts editor's (Polotno) rail so all three read the same. Desktop only:
 * on phones the same sections open as bottom sheets from the editor dock.
 */
export function MarketingEditorRail({ layoutKey, sections, active, onActiveChange }: RailProps) {
  const isBelowLg = useIsBelowLg();
  const open = sections.find((section) => section.key === active) ?? null;

  if (isBelowLg) {
    return (
      <MarketingEditorMobilePanel
        open={Boolean(open)}
        onOpenChange={(next) => !next && onActiveChange(null)}
        title={open?.title ?? open?.label ?? ''}
      >
        {open?.panel ?? null}
      </MarketingEditorMobilePanel>
    );
  }

  return (
    <div className="flex min-h-0 shrink-0">
      <nav
        role="tablist"
        aria-orientation="vertical"
        aria-label="Editor panels"
        className="border-border bg-card flex w-[72px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r py-2"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const selected = section.key === active;
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`rail-panel-${layoutKey}`}
              onClick={() => {
                if (section.onActivate) {
                  section.onActivate();
                  return;
                }
                onActiveChange(selected ? null : section.key);
              }}
              className={cn(
                'mx-1 flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] leading-tight transition-colors',
                'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
                selected
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="text-center">{section.label}</span>
            </button>
          );
        })}
      </nav>
      {open ? (
        <MarketingEditorSidebar
          layoutKey={layoutKey}
          hideCollapseToggle
          className="lg:border-r"
          header={
            <div className="flex items-center justify-between gap-2" id={`rail-panel-${layoutKey}`}>
              <p className="text-sm font-semibold">{open.title ?? open.label}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="admin-overflow-trigger size-8"
                aria-label="Close panel"
                onClick={() => onActiveChange(null)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          }
        >
          {open.panel}
        </MarketingEditorSidebar>
      ) : null}
    </div>
  );
}

type InspectorProps = {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  headerAside?: ReactNode;
};

/**
 * Right-hand properties panel (selected scene, calendar style). Collapsible on desktop;
 * a bottom sheet on phones (opened from the editor dock).
 */
export function MarketingEditorInspector({
  title,
  open,
  onOpenChange,
  children,
  headerAside,
}: InspectorProps) {
  const isBelowLg = useIsBelowLg();

  if (isBelowLg) {
    return (
      <MarketingEditorMobilePanel
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        headerAside={headerAside}
      >
        {children}
      </MarketingEditorMobilePanel>
    );
  }

  if (!open) return null;

  return (
    <aside
      aria-label={title}
      className="border-border bg-card flex min-h-0 w-[19rem] shrink-0 flex-col border-l xl:w-80"
    >
      <div className="border-border flex min-h-[52px] shrink-0 items-center gap-2 border-b px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        {headerAside}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="admin-overflow-trigger size-8"
          aria-label={`Hide ${title}`}
          onClick={() => onOpenChange(false)}
        >
          <PanelRightClose className="size-4" aria-hidden />
        </Button>
      </div>
      <ScrollArea className="h-0 min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]]:overflow-x-hidden">
        <div className="min-w-0 space-y-4 px-4 py-4 pb-8">{children}</div>
      </ScrollArea>
    </aside>
  );
}
