import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';
import { ArrowLeft, History, Maximize2, PanelRightOpen, Plus, PenSquare, X } from 'lucide-react';

import { AssistantMemoryButton } from '@/features/dashboard/ai-assistant/components/AssistantMemoryButton';
import { AssistantStatusNotices } from '@/features/dashboard/ai-assistant/components/AssistantStatusNotices';
import { ChatCanvasOverlay } from '@/features/dashboard/ai-assistant/components/ChatCanvasOverlay';
import { ChatThread } from '@/features/dashboard/ai-assistant/components/ChatThread';
import { ConversationHistoryList } from '@/features/dashboard/ai-assistant/components/ConversationHistoryList';
import { DashboardModeToggle } from '@/features/dashboard/ai-assistant/components/DashboardModeToggle';
import { BriefingHome } from '@/features/dashboard/ai-assistant/components/full-page/BriefingHome';
import { SessionChatComposer } from '@/features/dashboard/ai-assistant/components/SessionChatComposer';
import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import { assistantSpring } from '@/features/dashboard/ai-assistant/lib/assistantMotion';
import {
  canvasClosedHref,
  canvasOpenSearch,
  hrefWithChat,
} from '@/features/dashboard/ai-assistant/lib/assistantScope';
import {
  AssistantSurfaceContext,
  type AssistantSurfaceContextValue,
} from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import {
  RAIL_COLLAPSED_PX,
  RAIL_EXPANDED_PX,
} from '@/features/dashboard/ai-assistant/lib/canvasWidth';
import { displayConversationTitle } from '@/features/dashboard/ai-assistant/lib/conversationTitle';
import { useDashboardMode } from '@/features/dashboard/ai-assistant/lib/dashboardModeContext';
import { resolveAdminNavPrefetch } from '@/features/dashboard/bookings/lib/adminNavPrefetch';
import type { SidebarNavSection } from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { NotificationBell } from '@/features/dashboard/notifications/components/NotificationBell';
import { SidebarTenantScope } from '@/features/dashboard/org/components/TenantSwitchers';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsBelowMd, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { prefetchChunkOnce } from '@/hooks/usePrefetchOnIntent';
import { cn } from '@/lib/utils';

const FULL_SURFACE: AssistantSurfaceContextValue = { surface: 'full' };

/** Full-surface context for everything rendered by AI mode chrome. */
export function AiModeSurface({ children }: { children: ReactNode }) {
  return (
    <AssistantSurfaceContext.Provider value={FULL_SURFACE}>
      {children}
    </AssistantSurfaceContext.Provider>
  );
}

function NewChatButton() {
  const { newChat } = useAiAssistantSession();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={newChat}
      aria-label="New chat"
      title="New chat"
      className="size-10 min-h-[40px] min-w-[40px] shrink-0 rounded-xl"
    >
      <PenSquare className="size-4" aria-hidden />
    </Button>
  );
}

// ── Desktop rail ─────────────────────────────────────────────────────────────────────────────

const RAIL_ICON_CLASS = 'size-10 min-h-[40px] min-w-[40px] shrink-0 rounded-xl';

/** Page icons from the Advanced sidebar (collapsed style), so the canvas can switch pages. */
function RailPageNav({
  navSections,
  activeNavHref,
}: {
  navSections: SidebarNavSection[];
  activeNavHref: string | null;
}) {
  const { conversationId } = useAiAssistantSession();
  const items = navSections.flatMap((section) =>
    section.items.filter((item) => item.href && !item.disabled)
  );
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Pages"
      className="border-sidebar-border flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-t py-2 [scrollbar-width:none]"
    >
      {items.map(({ label, href, Icon }) => {
        const target = href as string;
        const active = target === activeNavHref;
        const prefetch = resolveAdminNavPrefetch(target);
        const onIntent = prefetch ? () => prefetchChunkOnce(target, prefetch) : undefined;
        return (
          <Link
            key={target}
            to={hrefWithChat(target, conversationId)}
            aria-label={label}
            title={label}
            aria-current={active ? 'page' : undefined}
            onMouseEnter={onIntent}
            onFocus={onIntent}
            className={cn(
              RAIL_ICON_CLASS,
              'focus-visible:ring-ring flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-sidebar-muted hover:bg-muted/60 hover:text-foreground dark:hover:bg-muted/40'
            )}
          >
            <Icon className="size-5" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}

type RailProps = {
  /** Same sections as the Advanced sidebar. */
  navSections: SidebarNavSection[];
  /** Highlighted only while a page is open in the canvas. */
  activeNavHref: string | null;
  collapsed: boolean;
  /** Account menu / plan entry from AdminLayout (same footer as the sidebar). */
  footer: ReactNode;
};

/** Desktop (lg+) rail: scope, New chat, page icons, chat history, account (with the mode switch). */
export function AiModeRail({ navSections, activeNavHref, collapsed, footer }: RailProps) {
  const session = useAiAssistantSession();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.aside
      aria-label="Assistant"
      initial={false}
      animate={{ width: collapsed ? RAIL_COLLAPSED_PX : RAIL_EXPANDED_PX }}
      transition={reducedMotion ? { duration: 0 } : assistantSpring.soft}
      className="border-sidebar-border bg-sidebar hidden h-screen shrink-0 flex-col overflow-hidden border-r lg:flex"
      style={{ viewTransitionName: 'dashboard-rail' }}
    >
      <div
        className={cn('border-sidebar-border shrink-0 border-b py-3', collapsed ? 'px-2' : 'px-3')}
      >
        <SidebarTenantScope collapsed={collapsed} />
      </div>

      {/* Icon column stays put in both states; expanding only reveals the chats panel beside it. */}
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'border-sidebar-border flex min-h-0 shrink-0 flex-col items-center',
            !collapsed && 'border-r'
          )}
          style={{ width: RAIL_COLLAPSED_PX }}
        >
          <div className="flex shrink-0 flex-col items-center gap-1 py-2">
            <NewChatButton />
            <NotificationBell />
            <AssistantMemoryButton className={RAIL_ICON_CLASS} />
          </div>
          <RailPageNav navSections={navSections} activeNavHref={activeNavHref} />
        </div>

        {collapsed ? null : (
          <div
            className="flex min-h-0 shrink-0 flex-col pt-2"
            style={{ width: RAIL_EXPANDED_PX - RAIL_COLLAPSED_PX }}
          >
            <ConversationHistoryList
              variant="rail"
              activeConversationId={session.conversationId}
              onSelect={session.selectConversation}
              onDeleted={session.onConversationDeleted}
            />
          </div>
        )}
      </div>

      {footer}
    </motion.aside>
  );
}

// ── History drawer (phone / tablet) ──────────────────────────────────────────────────────────

function HistoryDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useAiAssistantSession();
  const phone = useIsBelowMd();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={phone ? 'bottom' : 'left'}
        className={cn(
          'flex flex-col gap-0 p-0',
          phone ? 'h-[85dvh] rounded-t-2xl' : 'w-[min(20rem,85vw)]'
        )}
      >
        <SheetHeader className="border-border/60 flex-row items-center justify-between space-y-0 border-b p-3">
          <SheetTitle className="text-base">Chats</SheetTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[40px] gap-1.5"
            onClick={() => {
              session.newChat();
              onOpenChange(false);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New chat
          </Button>
        </SheetHeader>
        <ConversationHistoryList
          activeConversationId={session.conversationId}
          onSelect={(id) => {
            session.selectConversation(id);
            onOpenChange(false);
          }}
          onDeleted={session.onConversationDeleted}
        />
      </SheetContent>
    </Sheet>
  );
}

// ── Mobile / tablet top bar ──────────────────────────────────────────────────────────────────

/** Below lg: scope pill, mode toggle, chat history. The only chrome above the chat. */
export function AiModeMobileTopBar() {
  const [historyOpen, setHistoryOpen] = useState(false);
  // Phone: logo-only scope pill (tap opens the same switcher) so the toggle keeps its room.
  const phone = useIsBelowMd();
  return (
    <header className="border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b px-3 py-2 backdrop-blur-xl lg:hidden">
      <div className={phone ? 'shrink-0' : 'min-w-0 flex-1'}>
        <SidebarTenantScope collapsed={phone} />
      </div>
      {phone ? <div className="flex-1" /> : null}
      <DashboardModeToggle variant="compact" />
      <NotificationBell />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 min-h-[44px] min-w-[44px]"
        aria-label="Chats"
        onClick={() => setHistoryOpen(true)}
      >
        <History className="size-5" aria-hidden />
      </Button>
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />
    </header>
  );
}

// ── Chat column ──────────────────────────────────────────────────────────────────────────────

type ChatColumnProps = {
  /** Canvas is closed: show the "open page" affordance in the header. */
  canvasOpen: boolean;
  className?: string;
};

/** Chat column: thread (or briefing home), notices, composer dock. */
export function AiChatColumn({ canvasOpen, className }: ChatColumnProps) {
  const session = useAiAssistantSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);
  const belowMd = useIsBelowMd();
  const title = session.conversationId
    ? displayConversationTitle(session.conversation?.title ?? null)
    : null;

  return (
    <section
      aria-label="Chat"
      className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}
      style={{ viewTransitionName: 'dashboard-chat' }}
    >
      <div className="hidden min-h-12 shrink-0 items-center gap-2 px-4 lg:flex">
        <p
          className="text-muted-foreground min-w-0 flex-1 truncate text-sm"
          title={title ?? undefined}
        >
          {title && session.conversation ? title : null}
        </p>
        {!canvasOpen ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[36px] gap-1.5"
            onClick={() =>
              navigate({ pathname: location.pathname, search: canvasOpenSearch(location.search) })
            }
          >
            <PanelRightOpen className="size-4" aria-hidden />
            Split View
          </Button>
        ) : null}
      </div>

      {session.canvasBlock ? (
        <ChatCanvasOverlay
          block={session.canvasBlock}
          onClose={() => session.setCanvasBlock(null)}
          onResolveAction={session.confirmAction}
          onRunQuickAction={session.runQuickAction}
          quickActionsDisabled={session.sending || session.pending}
          className="min-h-0 flex-1"
        />
      ) : (
        <ChatThread emptyState={<BriefingHome />} />
      )}

      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto w-full max-w-[760px]">
          <AssistantStatusNotices className="pb-2" />
          <SessionChatComposer
            overlayContainer={overlayRoot}
            autoFocus={!belowMd}
            className="bg-background shadow-elevated rounded-2xl p-2"
          />
        </div>
      </div>
      <div
        ref={setOverlayRoot}
        className="pointer-events-none absolute inset-0 z-[60] overflow-visible"
      />
    </section>
  );
}

// ── Canvas header ────────────────────────────────────────────────────────────────────────────

type CanvasHeaderProps = {
  title: string | undefined;
};

/** Header of the canvas pane: page title, Full page (leaves AI mode), close (desktop) / Back (below lg). */
export function AiCanvasHeader({ title }: CanvasHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { setMode } = useDashboardMode();
  const { conversationId } = useAiAssistantSession();
  const close = () => navigate(canvasClosedHref(location.pathname, conversationId));
  const label = useMemo(() => title ?? 'Page', [title]);

  // Esc closes the canvas (the composer handles Esc first while a reply is streaming).
  const closeHref = canvasClosedHref(location.pathname, conversationId);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]'))
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      navigate(closeHref);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeHref, navigate]);

  return (
    <div className="border-border/60 bg-card flex min-h-12 shrink-0 items-center gap-1 border-b px-2 lg:px-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 min-h-[44px] min-w-[44px] lg:hidden"
        onClick={close}
        aria-label="Back to chat"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Button>
      <p
        className="text-muted-foreground min-w-0 flex-1 truncate text-sm font-medium"
        title={label}
      >
        {label}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-[40px] gap-1.5"
        title="Leave AI mode"
        onClick={() => setMode('advanced')}
      >
        <Maximize2 className="size-4" aria-hidden />
        <span className="max-sm:sr-only">Full page</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden size-10 min-h-[40px] min-w-[40px] lg:inline-flex"
        onClick={close}
        aria-label="Close page"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
