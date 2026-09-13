import { useState, type ReactNode } from 'react';

import { Mic, MoreVertical, Search } from 'lucide-react';

import { ChatThreadSearchPanel } from '@/components/chat/ChatThreadSearch';
import { GuestChatAwaitingReplyBadge } from '@/components/chat/GuestChatAwaitingReplyBadge';
import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { isAwaitingHostReply } from '@/lib/chat/chatReplyStatus';
import type { ChatThreadSearchController } from '@/lib/chat/useChatThreadSearch';
import { cn } from '@/lib/utils';

type HeaderProps = {
  leading?: ReactNode;
  avatar: ReactNode;
  title: string;
  subtitle?: string | null;
  replyStatus?: string | null;
  threadSearch: ChatThreadSearchController;
  searchEnabled?: boolean;
  /** Shown as a "Talk to receptionist" option in the header menu when set. */
  onStartVoiceSession?: () => void;
  /** e.g. inline dialog close — rendered after the options menu. */
  trailing?: ReactNode;
  className?: string;
};

const headerIconButtonClass =
  'text-muted-foreground hover:text-foreground hover:bg-muted/50 inline-flex size-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-colors';

function ChatOptionsItems({
  variant,
  searchEnabled,
  onStartVoiceSession,
  onSearch,
}: {
  variant: 'sheet' | 'menu';
  searchEnabled: boolean;
  onStartVoiceSession?: () => void;
  onSearch: () => void;
}) {
  if (variant === 'sheet') {
    return (
      <>
        {onStartVoiceSession ? (
          <MobileChoiceItem
            label="Talk to receptionist"
            icon={<Mic className="size-5" aria-hidden />}
            onSelect={onStartVoiceSession}
          />
        ) : null}
        {searchEnabled ? (
          <MobileChoiceItem
            label="Search"
            icon={<Search className="size-5" aria-hidden />}
            onSelect={onSearch}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {onStartVoiceSession ? (
        <DropdownMenuItem
          onSelect={() => {
            window.setTimeout(() => onStartVoiceSession(), 0);
          }}
        >
          <Mic className="size-4" aria-hidden />
          Talk to receptionist
        </DropdownMenuItem>
      ) : null}
      {searchEnabled ? (
        <DropdownMenuItem
          onSelect={() => {
            onSearch();
          }}
        >
          <Search className="size-4" aria-hidden />
          Search
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

/** Guest chat identity row — options menu inline with host info. */
export function GuestChatHeaderBar({
  leading,
  avatar,
  title,
  subtitle,
  replyStatus,
  threadSearch,
  searchEnabled = true,
  onStartVoiceSession,
  trailing,
  className,
}: HeaderProps) {
  const isMobileLayout = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);
  const awaitingReply = isAwaitingHostReply(replyStatus);
  const showMenu = searchEnabled || !!onStartVoiceSession;

  const openSearch = () => {
    threadSearch.openSearch();
  };

  const menuTrigger = (
    <button
      type="button"
      className={headerIconButtonClass}
      aria-label="Chat options"
      aria-expanded={sheetOpen}
      aria-haspopup={isMobileLayout ? 'dialog' : 'menu'}
      onClick={isMobileLayout ? () => setSheetOpen(true) : undefined}
    >
      <MoreVertical className="size-5" aria-hidden />
    </button>
  );

  return (
    <div className={cn('flex min-w-0 flex-nowrap items-center gap-2 sm:gap-2.5', className)}>
      {leading}
      {avatar}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p>
        ) : null}
        {awaitingReply ? <GuestChatAwaitingReplyBadge className="mt-0.5" /> : null}
      </div>
      {showMenu ? (
        isMobileLayout ? (
          <>
            {menuTrigger}
            <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Chat options">
              <div role="listbox" aria-label="Chat options">
                <ChatOptionsItems
                  variant="sheet"
                  searchEnabled={searchEnabled}
                  onStartVoiceSession={
                    onStartVoiceSession
                      ? () => {
                          setSheetOpen(false);
                          window.setTimeout(() => onStartVoiceSession(), 0);
                        }
                      : undefined
                  }
                  onSearch={() => {
                    setSheetOpen(false);
                    openSearch();
                  }}
                />
              </div>
            </MobileChoiceSheet>
          </>
        ) : (
          <DropdownMenu modal>
            <DropdownMenuTrigger asChild>{menuTrigger}</DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="z-[110] min-w-[9rem]"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <ChatOptionsItems
                variant="menu"
                searchEnabled={searchEnabled}
                onStartVoiceSession={onStartVoiceSession}
                onSearch={openSearch}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      ) : null}
      {trailing}
    </div>
  );
}

export { headerIconButtonClass };

/** Full-width search row below the guest chat header (same pattern as host inbox). */
export function GuestChatSearchPanelRow({
  threadSearch,
  className,
}: {
  threadSearch: ChatThreadSearchController;
  className?: string;
}) {
  if (!threadSearch.open) return null;

  return (
    <ChatThreadSearchPanel
      query={threadSearch.query}
      onQueryChange={threadSearch.setQuery}
      matchCount={threadSearch.matches.length}
      activeIndex={threadSearch.activeIndex}
      onPrev={threadSearch.goPrev}
      onNext={threadSearch.goNext}
      onClose={threadSearch.close}
      className={cn('shrink-0', className)}
    />
  );
}
