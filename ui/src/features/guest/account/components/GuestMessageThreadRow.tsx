import type { GuestMessageThreadDto } from '@/features/guest/account/lib/guestAccountApi';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { formatInboxTime } from '@/features/dashboard/inbox/lib/inboxFormat';

import { GuestChatAwaitingReplyBadge } from '@/components/chat/GuestChatAwaitingReplyBadge';
import { isAwaitingHostReply } from '@/lib/chat/chatReplyStatus';
import { cn } from '@/lib/utils';

type Props = {
  thread: GuestMessageThreadDto;
  selected: boolean;
  onSelect: () => void;
};

export function GuestMessageThreadRow({ thread, selected, onSelect }: Props) {
  const title = thread.propertyName?.trim() || thread.parkingName?.trim() || 'Listing';
  const thumb =
    thread.propertyImageUrl?.trim() ||
    thread.parkingImageUrl?.trim() ||
    thread.hostAvatarUrl?.trim() ||
    null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex min-h-[44px] w-full gap-3 px-3 py-3 text-left transition-colors',
        'hover:bg-muted/40',
        selected && 'bg-muted/60'
      )}
    >
      {selected ? (
        <span className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full" aria-hidden />
      ) : null}
      <div className="bg-muted relative mt-0.5 size-11 shrink-0 overflow-hidden rounded-xl">
        {thumb ? (
          <Image src={thumb} alt="" width={44} height={44} className="size-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm font-medium',
              thread.unreadCount > 0 ? 'text-foreground' : 'text-foreground'
            )}
          >
            {title}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {thread.unreadCount > 0 ? (
              <span
                className="bg-primary size-2 rounded-full"
                aria-label={`${thread.unreadCount} unread`}
              />
            ) : null}
            {thread.lastMessageAt ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {formatInboxTime(thread.lastMessageAt)}
              </span>
            ) : null}
          </div>
        </div>
        {thread.hostName ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{thread.hostName}</p>
        ) : null}
        {isAwaitingHostReply(thread.replyStatus) ? (
          <GuestChatAwaitingReplyBadge className="mt-1" />
        ) : null}
        {thread.lastMessagePreview ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            {thread.lastMessagePreview}
          </p>
        ) : null}
      </div>
    </button>
  );
}
