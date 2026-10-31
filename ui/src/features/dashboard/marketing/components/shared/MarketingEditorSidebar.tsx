import { useCallback, useRef, useState, type ReactNode } from 'react';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { MarketingEditorMobilePanel } from '@/features/dashboard/marketing/components/shared/MarketingEditorMobilePanel';
import {
  MARKETING_SIDEBAR_COLLAPSED_WIDTH,
  useMarketingSidebarLayout,
  type MarketingSidebarLayoutKey,
} from '@/features/dashboard/marketing/hooks/useMarketingSidebarLayout';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type Props = {
  layoutKey: MarketingSidebarLayoutKey;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** When set, expanded sidebar uses this width instead of the persisted layout width. */
  fixedWidth?: number;
  /** Drag-to-resize handle. Ignored when `fixedWidth` is set. Default true. */
  resizable?: boolean;
  /** Hide the round collapse button (an icon rail opens / closes the panel instead). */
  hideCollapseToggle?: boolean;
  /**
   * How the panel behaves below `lg`:
   * - `stack` (default) — full-width block above the canvas (legacy).
   * - `sheet` — panel content moves into a bottom sheet so the canvas goes full-bleed;
   *   the editor owns `mobileOpen` / `onMobileOpenChange` (toggled from
   *   `MarketingEditorMobileToolbar`).
   */
  mobileVariant?: 'stack' | 'sheet';
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** Bottom-sheet title when `mobileVariant="sheet"`. */
  mobileTitle?: string;
  mobileDescription?: string;
};

export function MarketingEditorSidebar({
  layoutKey,
  header,
  children,
  footer,
  className,
  fixedWidth,
  resizable = true,
  hideCollapseToggle = false,
  mobileVariant = 'stack',
  mobileOpen = false,
  onMobileOpenChange,
  mobileTitle = 'Editor panel',
  mobileDescription,
}: Props) {
  const isBelowLg = useIsBelowLg();
  const { width, collapsed, setWidth, setCollapsed, finishResize } =
    useMarketingSidebarLayout(layoutKey);
  const widthRef = useRef(width);
  const [isResizing, setIsResizing] = useState(false);
  const canResize = resizable && fixedWidth == null;

  widthRef.current = width;

  const isDesktopCollapsed = collapsed && !isBelowLg && !hideCollapseToggle;
  const expandedWidth = fixedWidth ?? width;
  const desktopWidth = isDesktopCollapsed ? MARKETING_SIDEBAR_COLLAPSED_WIDTH : expandedWidth;

  const handleToggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBelowLg || collapsed || !canResize) return;

      event.preventDefault();
      setIsResizing(true);
      const startX = event.clientX;
      const startWidth = widthRef.current;

      const handleMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + (moveEvent.clientX - startX);
        setWidth(nextWidth, false);
      };

      const handleUp = () => {
        setIsResizing(false);
        finishResize(widthRef.current, startWidth);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [canResize, collapsed, finishResize, isBelowLg, setWidth]
  );

  // Sheet variant on mobile: panel content moves into a bottom sheet so the editor
  // canvas can go full-bleed. All hooks above still run (desktop layout unchanged).
  if (isBelowLg && mobileVariant === 'sheet') {
    return (
      <MarketingEditorMobilePanel
        open={mobileOpen}
        onOpenChange={(next) => onMobileOpenChange?.(next)}
        title={mobileTitle}
        description={mobileDescription}
        footer={footer}
      >
        {header ? <div className="mb-4">{header}</div> : null}
        {children}
      </MarketingEditorMobilePanel>
    );
  }

  return (
    <div
      className={cn(
        'border-border bg-card relative flex min-h-0 min-w-0 shrink-0 flex-col border-b lg:h-full lg:max-h-none lg:border-b-0 lg:border-r',
        fixedWidth == null && 'lg:max-w-[480px]',
        isBelowLg
          ? 'w-full max-w-full flex-1 basis-0'
          : 'hidden lg:flex lg:flex-none lg:basis-auto',
        !isResizing && 'transition-[width] duration-300 ease-out',
        className
      )}
      style={isBelowLg ? undefined : { width: desktopWidth }}
    >
      {!isBelowLg && !hideCollapseToggle ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-card absolute right-0 top-4 z-50 size-9 min-h-[44px] min-w-[44px] translate-x-1/2 rounded-full shadow-md transition-transform duration-300 ease-out hover:scale-105"
          aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isDesktopCollapsed}
          onClick={handleToggle}
        >
          {isDesktopCollapsed ? (
            <PanelLeftOpen className="size-3.5" aria-hidden />
          ) : (
            <PanelLeftClose className="size-3.5" aria-hidden />
          )}
        </Button>
      ) : null}

      {!isBelowLg && !isDesktopCollapsed && canResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="hover:bg-primary/15 active:bg-primary/25 absolute bottom-0 right-0 top-0 z-30 w-1.5 -translate-x-1/2 cursor-col-resize touch-none"
          onPointerDown={handleResizeStart}
        />
      ) : null}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[opacity,transform] duration-300 ease-out',
          isDesktopCollapsed && 'pointer-events-none opacity-0 lg:-translate-x-2'
        )}
        aria-hidden={isDesktopCollapsed}
      >
        {header ? <div className="border-border shrink-0 border-b px-4 py-3">{header}</div> : null}
        <ScrollArea className="h-0 min-h-0 min-w-0 flex-1 [&>[data-radix-scroll-area-viewport]]:min-w-0 [&>[data-radix-scroll-area-viewport]]:max-w-full [&>[data-radix-scroll-area-viewport]]:overflow-y-auto [&>[data-radix-scroll-area-viewport]]:overflow-x-hidden">
          <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden px-4 py-4 pb-6">
            {children}
          </div>
        </ScrollArea>
        {footer ? <div className="border-border shrink-0 border-t px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
