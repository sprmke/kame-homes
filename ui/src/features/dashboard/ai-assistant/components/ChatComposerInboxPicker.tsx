import { useMemo, useState } from 'react';

import { MessageSquare } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useInboxThreads } from '@/features/dashboard/inbox/hooks/useInbox';
import { platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import type {
  InboxConversation,
  ThreadPlatformFilter,
} from '@/features/dashboard/inbox/types/inbox';
import {
  useOrgIdParam,
  useOrgSlugParam,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';

import { cn } from '@/lib/utils';

const PLATFORM_FILTERS: { id: ThreadPlatformFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
];

function conversationTitle(conversation: InboxConversation): string {
  return conversation.participant_name || conversation.subject_preview || 'Conversation';
}

export function ChatComposerInboxPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const orgSlug = useOrgSlugParam();
  const orgId = useOrgIdParam();
  const propertyId = usePropertyIdParam();
  const parkingId = useParkingIdParam();
  const [platform, setPlatform] = useState<ThreadPlatformFilter>('all');
  const { data, isLoading } = useInboxThreads(
    orgSlug,
    orgId,
    { status: 'all', platform, search: '' },
    { propertyId, parkingId }
  );
  const conversations = useMemo(
    () => data?.pages.flatMap((page) => page.conversations) ?? [],
    [data]
  );

  return (
    <ChatComposerContextPicker
      items={conversations}
      getItemId={(conversation) => conversation.id}
      searchHaystack={(conversation) =>
        [
          conversationTitle(conversation),
          platformLabel(conversation.platform),
          conversation.platform,
          conversation.subject_preview,
        ]
          .filter(Boolean)
          .join(' ')
      }
      groupBy={(items) => {
        const map = new Map<string, InboxConversation[]>();
        for (const item of items) {
          const list = map.get(item.platform) ?? [];
          list.push(item);
          map.set(item.platform, list);
        }
        return [...map.entries()].map(([key, groupItems]) => ({
          key,
          label: platformLabel(key as InboxConversation['platform']),
          items: groupItems,
        }));
      }}
      pageEntityId={pageEntityId}
      renderRow={(conversation, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={conversationTitle(conversation)}
          subtitle={platformLabel(conversation.platform)}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(conversation) =>
        onSelect({
          type: 'inbox_conversation',
          id: conversation.id,
          propertyId,
          label: conversationTitle(conversation),
        })
      }
      searchPlaceholder="Name or message"
      searchAriaLabel="Search conversations"
      listAriaLabel="Conversations"
      emptyLabel="No conversations"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      toolbar={
        <div
          role="group"
          aria-label="Platform"
          className="border-border/60 flex gap-1 overflow-x-auto border-b px-2 py-1.5"
        >
          {PLATFORM_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setPlatform(filter.id)}
              aria-pressed={platform === filter.id}
              className={cn(
                'native-press focus-visible:ring-ring min-h-[44px] shrink-0 rounded-lg px-3 text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2',
                platform === filter.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      }
      trigger={
        <ChatComposerPickerTrigger
          icon={MessageSquare}
          label="Pin a conversation"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
