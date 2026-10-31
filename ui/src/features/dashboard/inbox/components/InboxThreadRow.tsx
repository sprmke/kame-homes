import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { formatInboxTime, platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import type { InboxConversation } from '@/features/dashboard/inbox/types/inbox';

import { softBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatStayDateRange } from '@/utils/format/dates';

type Props = {
  conversation: InboxConversation;
  selected: boolean;
  showPlatform: boolean;
  onSelect: () => void;
};

export function InboxThreadRow({ conversation, selected, showPlatform, onSelect }: Props) {
  const name = conversation.participant_name?.trim() || 'Guest';
  const unread = conversation.unread_count > 0;
  const pending = conversation.reply_status === 'pending';

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
      {selected && (
        <span className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full" aria-hidden />
      )}
      <PlatformLogo platform={conversation.platform} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'text-foreground truncate text-sm',
              unread ? 'font-semibold' : 'font-medium'
            )}
          >
            {name}
          </span>
          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
            {formatInboxTime(conversation.last_message_at)}
          </span>
        </div>
        <p
          className={cn(
            'mt-0.5 line-clamp-2 text-xs leading-relaxed',
            unread ? 'text-foreground/85' : 'text-foreground/60'
          )}
        >
          {conversation.subject_preview || '-'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {conversation.platform === 'web' &&
          conversation.inquiry_check_in &&
          conversation.inquiry_check_out ? (
            <span className="bg-muted/80 text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              {formatStayDateRange(conversation.inquiry_check_in, conversation.inquiry_check_out)}
            </span>
          ) : null}
          {showPlatform && (
            <span className="bg-muted/80 text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-medium">
              {platformLabel(conversation.platform)}
            </span>
          )}
          {pending && (
            <span
              className={cn('px-1.5 py-0.5 text-[10px] font-medium', softBadgeClasses('pending'))}
            >
              Pending
            </span>
          )}
          {unread && (
            <span
              className="bg-primary size-2 rounded-full"
              aria-label={`${conversation.unread_count} unread`}
            />
          )}
        </div>
      </div>
    </button>
  );
}
