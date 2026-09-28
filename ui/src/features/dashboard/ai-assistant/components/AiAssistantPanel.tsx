import { useMemo, useState } from 'react';

import { History, Plus, X } from 'lucide-react';

import { AssistantMemoryButton } from '@/features/dashboard/ai-assistant/components/AssistantMemoryButton';
import { AssistantStatusNotices } from '@/features/dashboard/ai-assistant/components/AssistantStatusNotices';
import { ChatCanvasOverlay } from '@/features/dashboard/ai-assistant/components/ChatCanvasOverlay';
import { ChatThread } from '@/features/dashboard/ai-assistant/components/ChatThread';
import { ConversationHistoryList } from '@/features/dashboard/ai-assistant/components/ConversationHistoryList';
import { SessionChatComposer } from '@/features/dashboard/ai-assistant/components/SessionChatComposer';
import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import {
  AssistantSurfaceContext,
  type AssistantSurfaceContextValue,
} from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isNestedOverlayTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        '[data-radix-popper-content-wrapper], [data-radix-dropdown-menu-content], [role="alertdialog"], [data-assistant-command-palette]'
      )
    )
  );
}

function isNestedOverlayEvent(event: {
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}): boolean {
  const orig = event.detail?.originalEvent;
  const related: EventTarget | null =
    orig && 'relatedTarget' in orig
      ? ((orig as { relatedTarget?: EventTarget | null }).relatedTarget ?? null)
      : null;
  return [event.target, orig?.target ?? null, related].some((node) => isNestedOverlayTarget(node));
}

/**
 * Advanced-mode container: the bottom-right slide-over. All chat behavior comes from the shared
 * session (AiAssistantSessionProvider); this file only owns sheet layout.
 */
export function AiAssistantPanel({ open, onOpenChange }: Props) {
  const session = useAiAssistantSession();
  const { usageLabel, conversationId, canvasBlock, setCanvasBlock, newChat, selectConversation } =
    session;
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);
  const canvasOpen = canvasBlock != null;

  const surface = useMemo<AssistantSurfaceContextValue>(
    () => ({ surface: 'sheet', afterNavigate: () => onOpenChange(false) }),
    [onOpenChange]
  );

  return (
    <AssistantSurfaceContext.Provider value={surface}>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) {
            setView('chat');
            setCanvasBlock(null);
          }
        }}
      >
        <SheetContent
          side="right"
          hideClose
          className={cn(
            'flex h-full min-h-0 w-full min-w-0 flex-col gap-0 overflow-hidden p-0',
            canvasOpen ? 'sm:max-w-none lg:max-w-[min(calc(100vw-2rem),72rem)]' : 'sm:max-w-xl'
          )}
          onPointerDownOutside={(event) => {
            if (isNestedOverlayEvent(event)) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (isNestedOverlayEvent(event)) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isNestedOverlayEvent(event)) event.preventDefault();
          }}
        >
          <SheetHeader
            className={cn(
              'border-border/60 flex-row items-center justify-between space-y-0 border-b p-3',
              canvasOpen && 'hidden lg:flex'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <TierBadge feature="aiDashboardAssistant" />
              {usageLabel ? (
                <span
                  className="text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 text-xs tabular-nums"
                  title="Messages today"
                >
                  {usageLabel}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <AssistantMemoryButton iconClassName="h-4 w-4" />
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setView(view === 'history' ? 'chat' : 'history')}
                aria-label={view === 'history' ? 'Back to chat' : 'View past conversations'}
                aria-pressed={view === 'history'}
              >
                <History className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => {
                  newChat();
                  setView('chat');
                }}
                aria-label="Start new conversation"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          <div
            className={cn('flex min-h-0 flex-1', canvasOpen ? 'flex-col lg:flex-row' : 'flex-col')}
          >
            {canvasOpen && canvasBlock ? (
              <ChatCanvasOverlay
                block={canvasBlock}
                onClose={() => setCanvasBlock(null)}
                onResolveAction={session.confirmAction}
                onRunQuickAction={session.runQuickAction}
                quickActionsDisabled={session.sending || session.pending}
                className="min-h-0 flex-1 lg:min-w-0"
              />
            ) : null}

            <div
              className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col',
                canvasOpen && 'hidden lg:flex lg:w-96 lg:flex-none lg:border-l'
              )}
            >
              {view === 'history' ? (
                <ConversationHistoryList
                  activeConversationId={conversationId}
                  onSelect={(id) => {
                    selectConversation(id);
                    setView('chat');
                  }}
                  onDeleted={session.onConversationDeleted}
                />
              ) : (
                <>
                  <ChatThread />
                  <AssistantStatusNotices className="px-3 pb-1" />
                  <SessionChatComposer overlayContainer={overlayRoot} />
                </>
              )}
            </div>
          </div>
          <div
            ref={setOverlayRoot}
            className="pointer-events-none absolute inset-0 z-[110] overflow-visible"
          />
        </SheetContent>
      </Sheet>
    </AssistantSurfaceContext.Provider>
  );
}
