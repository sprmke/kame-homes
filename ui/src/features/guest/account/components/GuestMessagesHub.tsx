import { useEffect, useMemo, useState } from 'react';

import { ArrowLeft } from 'lucide-react';

import { GuestMessageThreadRow } from '@/features/guest/account/components/GuestMessageThreadRow';
import type { GuestMessageThreadDto } from '@/features/guest/account/lib/guestAccountApi';
import {
  GuestChatHeaderBar,
  GuestChatSearchPanelRow,
} from '@/features/guest/chat/components/GuestChatHeaderBar';
import { GuestChatThread } from '@/features/guest/chat/components/GuestChatThread';
import { useGuestChatMessages, useGuestChatResume } from '@/features/guest/chat/hooks/useGuestChat';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';
import { useChatThreadSearch } from '@/lib/chat/useChatThreadSearch';
import { cn } from '@/lib/utils';
import { formatStayDateRange } from '@/utils/format/dates';

type Props = {
  threads: GuestMessageThreadDto[];
};

/** Bounded height so thread list + message pane can scroll independently. */
export const GUEST_MESSAGES_HUB_SHELL_CLASS =
  'border-border bg-card flex h-[calc(100dvh-12rem)] max-h-[720px] min-h-[480px] flex-col overflow-hidden rounded-2xl border shadow-sm lg:h-[calc(100dvh-10rem)]';

export function GuestMessagesHub({ threads }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileShowConversation, setMobileShowConversation] = useState(false);

  useEffect(() => {
    if (threads.length === 0) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    if (mq.matches && !selectedId) {
      setSelectedId(threads[0]?.conversationId ?? null);
    }
  }, [threads, selectedId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.conversationId === selectedId) ?? null,
    [threads, selectedId]
  );

  const {
    messages,
    isLoading: messagesLoading,
    replyStatus: liveReplyStatus,
    send,
    edit,
    unsend,
    uploadAttachment,
    retryFailedMessage,
    assistantTyping,
    aiFeedback,
    submitAiFeedback,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGuestChatMessages(selectedId);

  const propertySlug = selectedThread?.propertySlug?.trim() || '';
  const resumeQuery = useGuestChatResume({
    propertySlug: propertySlug || undefined,
    enabled: Boolean(propertySlug),
  });

  const threadSearch = useChatThreadSearch(selectedThread ? messages : []);
  const headerReplyStatus = liveReplyStatus ?? selectedThread?.replyStatus ?? null;

  useEffect(() => {
    threadSearch.close();
  }, [selectedId, threadSearch.close]);

  const handleSelect = (conversationId: string) => {
    setSelectedId(conversationId);
    setMobileShowConversation(true);
  };

  const thumb =
    selectedThread?.propertyImageUrl?.trim() ||
    selectedThread?.parkingImageUrl?.trim() ||
    selectedThread?.hostAvatarUrl?.trim() ||
    null;

  return (
    <div className={GUEST_MESSAGES_HUB_SHELL_CLASS}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            'border-border flex h-full min-h-0 w-full shrink-0 flex-col border-r lg:w-[min(100%,320px)]',
            mobileShowConversation ? 'hidden lg:flex' : 'flex'
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {threads.map((thread) => (
              <GuestMessageThreadRow
                key={thread.conversationId}
                thread={thread}
                selected={thread.conversationId === selectedId}
                onSelect={() => handleSelect(thread.conversationId)}
              />
            ))}
          </div>
        </div>

        <div
          className={cn(
            'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            mobileShowConversation ? 'flex' : 'hidden lg:flex'
          )}
        >
          {selectedThread ? (
            <>
              <div className="border-border shrink-0 border-b">
                <div className="px-2.5 py-2.5 sm:px-3">
                  <GuestChatHeaderBar
                    leading={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="min-h-[44px] min-w-[44px] shrink-0 lg:hidden"
                        onClick={() => setMobileShowConversation(false)}
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft className="size-5" aria-hidden />
                      </Button>
                    }
                    avatar={
                      <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-lg">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            width={40}
                            height={40}
                            className="size-full object-cover"
                          />
                        ) : null}
                      </div>
                    }
                    title={selectedThread.propertyName ?? selectedThread.parkingName ?? 'Listing'}
                    subtitle={
                      [
                        selectedThread.hostName,
                        selectedThread.inquiryCheckIn && selectedThread.inquiryCheckOut
                          ? formatStayDateRange(
                              selectedThread.inquiryCheckIn,
                              selectedThread.inquiryCheckOut
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || null
                    }
                    replyStatus={headerReplyStatus}
                    threadSearch={threadSearch}
                    searchEnabled={!messagesLoading && messages.length > 0}
                  />
                </div>
                <GuestChatSearchPanelRow threadSearch={threadSearch} />
              </div>

              <GuestChatThread
                conversationId={selectedId}
                propertySlug={propertySlug || undefined}
                propertyName={selectedThread.propertyName ?? ''}
                messages={messages}
                isLoading={messagesLoading && !!selectedId}
                threadSearch={threadSearch}
                searchInHeader
                faqSuggestions={false}
                hasInquiryDates={Boolean(
                  selectedThread.inquiryCheckIn && selectedThread.inquiryCheckOut
                )}
                inquiryCheckIn={selectedThread.inquiryCheckIn}
                inquiryCheckOut={selectedThread.inquiryCheckOut}
                stayGuideUrl={resumeQuery.data?.stayGuideUrl ?? null}
                tripPath={resumeQuery.data?.tripPath ?? null}
                onSend={async (text, opts) => {
                  await send.mutateAsync({
                    text,
                    replyToMessageId: opts?.replyToMessageId,
                    attachments: opts?.attachments,
                  });
                }}
                onUploadAttachment={(file) => uploadAttachment.mutateAsync(file)}
                uploadingAttachment={uploadAttachment.isPending}
                onEdit={async (messageId, text) => {
                  await edit.mutateAsync({ messageId, text });
                }}
                onUnsend={async (messageId) => {
                  await unsend.mutateAsync(messageId);
                }}
                onRetryFailed={retryFailedMessage}
                sending={send.isPending}
                editing={edit.isPending}
                unsending={unsend.isPending}
                hasOlderMessages={!!hasNextPage}
                loadingOlder={isFetchingNextPage}
                onLoadOlder={() => void fetchNextPage()}
                assistantTyping={assistantTyping}
                aiFeedback={aiFeedback}
                onAiFeedback={(messageId, rating) => void submitAiFeedback(messageId, rating)}
              />
            </>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center px-6 text-sm">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
