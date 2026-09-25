import { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2, SendHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { takeContactHostDraft } from '@/features/guest/auth/lib/guestAuthResume';
import { GuestChatFaqSuggestions } from '@/features/guest/chat/components/GuestChatFaqSuggestions';
import {
  GuestChatHeaderBar,
  GuestChatSearchPanelRow,
  headerIconButtonClass,
} from '@/features/guest/chat/components/GuestChatHeaderBar';
import { GuestChatThread } from '@/features/guest/chat/components/GuestChatThread';
import { VoiceSessionPanel } from '@/features/guest/chat/components/voice/VoiceSessionPanel';
import {
  GUEST_CHAT_MESSAGES_KEY,
  GUEST_CHAT_RESUME_KEY,
  useGuestChatMessages,
  useGuestChatResume,
  useGuestChatStart,
} from '@/features/guest/chat/hooks/useGuestChat';
import { sendGuestChatMessage, startGuestWebChat } from '@/features/guest/chat/lib/guestChatApi';
import { BookingCalendarModal } from '@/features/guest/marketing/properties/components/property-detail/BookingCalendarModal';
import type { ListingHostInfo } from '@/features/guest/marketing/shared/components/ListingHostCard';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CHAT_MESSAGE_MAX_CHARS } from '@/lib/chat/messageLimits';
import { useChatThreadSearch } from '@/lib/chat/useChatThreadSearch';
import { formatDateToYYYYMMDD, formatStayDateRange } from '@/utils/format/dates';

export type ContactHostSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertySlug?: string;
  parkingSlug?: string;
  propertyName: string;
  checkIn: Date | null;
  checkOut: Date | null;
  onDatesChange: (checkIn: Date | null, checkOut: Date | null) => void;
  host: ListingHostInfo;
  initialDraft?: string;
};

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ContactHostSheet({
  open,
  onOpenChange,
  propertySlug,
  parkingSlug,
  propertyName,
  checkIn,
  checkOut,
  onDatesChange,
  host,
  initialDraft = '',
}: ContactHostSheetProps) {
  const listingSlug = propertySlug?.trim() || parkingSlug?.trim() || '';
  const queryClient = useQueryClient();
  const { status } = useGuestAuth();
  const [composeDraft, setComposeDraft] = useState(initialDraft);
  const [sendingFirst, setSendingFirst] = useState(false);
  const [localConversationId, setLocalConversationId] = useState<string | null>(null);
  const [datesModalOpen, setDatesModalOpen] = useState(false);
  const [voiceSessionOpen, setVoiceSessionOpen] = useState(false);
  const pendingAutoSendRef = useRef(false);

  const checkInDate = checkIn ? formatDateToYYYYMMDD(checkIn) : '';
  const checkOutDate = checkOut ? formatDateToYYYYMMDD(checkOut) : '';
  const hasDates = Boolean(checkInDate && checkOutDate);

  const resumeQuery = useGuestChatResume({
    propertySlug,
    parkingSlug,
    enabled: open && status === 'authenticated' && !!listingSlug,
  });

  const resumedConversationId =
    resumeQuery.data?.hasMessages && resumeQuery.data.conversationId
      ? resumeQuery.data.conversationId
      : null;
  const isReturningGuest = Boolean(resumedConversationId);
  const requiresDatesForSend = !isReturningGuest && !localConversationId;

  const resumeCheckInDate = resumeQuery.data?.inquiryCheckIn?.trim() ?? '';
  const resumeCheckOutDate = resumeQuery.data?.inquiryCheckOut?.trim() ?? '';

  const startQuery = useGuestChatStart({
    propertySlug,
    parkingSlug,
    checkInDate,
    checkOutDate,
    enabled:
      open &&
      status === 'authenticated' &&
      !!listingSlug &&
      hasDates &&
      !isReturningGuest &&
      !localConversationId,
  });

  const conversationId =
    localConversationId ?? resumedConversationId ?? startQuery.data?.conversationId ?? null;

  const {
    messages,
    isLoading: messagesLoading,
    replyStatus,
    send,
    edit,
    unsend,
    uploadAttachment,
    retryFailedMessage,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGuestChatMessages(conversationId);

  const hostLabel = host.ownerName.trim() || 'Host';
  const hostAvatar = host.ownerAvatarUrl || host.organizationLogoUrl || null;

  const displayCheckInDate = checkInDate || resumeCheckInDate;
  const displayCheckOutDate = checkOutDate || resumeCheckOutDate;
  const dateLabel =
    displayCheckInDate && displayCheckOutDate
      ? (formatStayDateRange(displayCheckInDate, displayCheckOutDate) ?? '')
      : '';

  const showThread =
    Boolean(conversationId) &&
    (messages.length > 0 || isReturningGuest || Boolean(localConversationId));

  const stayGuideUrl = resumeQuery.data?.stayGuideUrl ?? startQuery.data?.stayGuideUrl ?? null;

  const threadSearch = useChatThreadSearch(showThread ? messages : []);

  useEffect(() => {
    if (!open) threadSearch.close();
  }, [open, threadSearch.close]);

  const sendFirstMessage = useCallback(
    async (text: string) => {
      setSendingFirst(true);
      try {
        let convId = conversationId;
        if (!convId) {
          if (!hasDates) return;
          const started = await startGuestWebChat({
            propertySlug,
            parkingSlug,
            checkInDate,
            checkOutDate,
          });
          convId = started.conversationId;
          setLocalConversationId(convId);
        }

        await sendGuestChatMessage(convId, text);
        await queryClient.invalidateQueries({
          queryKey: [GUEST_CHAT_MESSAGES_KEY, convId],
        });
        await queryClient.invalidateQueries({
          queryKey: [GUEST_CHAT_RESUME_KEY, propertySlug ?? '', parkingSlug ?? ''],
        });
        setComposeDraft('');
      } catch (e) {
        toast.error((e as Error).message);
        throw e;
      } finally {
        setSendingFirst(false);
      }
    },
    [conversationId, hasDates, propertySlug, parkingSlug, checkInDate, checkOutDate, queryClient]
  );

  useEffect(() => {
    if (!open || !resumeQuery.data?.hasMessages) return;
    const nextCheckIn = parseIsoDate(resumeQuery.data.inquiryCheckIn);
    const nextCheckOut = parseIsoDate(resumeQuery.data.inquiryCheckOut);
    if (nextCheckIn && nextCheckOut && !hasDates) {
      onDatesChange(nextCheckIn, nextCheckOut);
    }
  }, [open, resumeQuery.data, hasDates, onDatesChange]);

  useEffect(() => {
    if (open) {
      const restored = takeContactHostDraft();
      if (restored) {
        setComposeDraft(restored);
        pendingAutoSendRef.current = true;
      } else if (initialDraft) {
        setComposeDraft(initialDraft);
      }
      return;
    }

    setSendingFirst(false);
    setLocalConversationId(null);
    setDatesModalOpen(false);
    setVoiceSessionOpen(false);
    pendingAutoSendRef.current = false;
    if (!showThread) setComposeDraft('');
  }, [open, initialDraft, showThread]);

  useEffect(() => {
    if (!open || status !== 'authenticated' || !pendingAutoSendRef.current) return;
    const text = composeDraft.trim();
    if (!text || showThread || sendingFirst) return;
    if (requiresDatesForSend && !hasDates) return;
    if (resumeQuery.isLoading) return;

    pendingAutoSendRef.current = false;
    void sendFirstMessage(text);
  }, [
    open,
    status,
    composeDraft,
    hasDates,
    showThread,
    sendingFirst,
    sendFirstMessage,
    requiresDatesForSend,
    resumeQuery.isLoading,
  ]);

  const openDatesModal = useCallback(() => {
    setDatesModalOpen(true);
  }, []);

  const handleDatesSaved = useCallback(
    (nextCheckIn: Date | null, nextCheckOut: Date | null) => {
      onDatesChange(nextCheckIn, nextCheckOut);
      if (nextCheckIn && nextCheckOut) {
        setDatesModalOpen(false);
      }
    },
    [onDatesChange]
  );

  const handleSendFirst = useCallback(() => {
    const text = composeDraft.trim();
    if (!text || sendingFirst || send.isPending) return;

    if (requiresDatesForSend && !hasDates) {
      openDatesModal();
      return;
    }

    if (status !== 'authenticated') return;

    void sendFirstMessage(text);
  }, [
    composeDraft,
    sendingFirst,
    send.isPending,
    requiresDatesForSend,
    hasDates,
    status,
    openDatesModal,
    sendFirstMessage,
  ]);

  const handlePickFaq = useCallback(
    (prompt: string) => {
      const text = prompt.trim();
      if (!text || sendingFirst || send.isPending) return;

      if (requiresDatesForSend && !hasDates) {
        setComposeDraft(text);
        pendingAutoSendRef.current = true;
        openDatesModal();
        return;
      }

      if (status !== 'authenticated') return;

      void sendFirstMessage(text);
    },
    [
      sendingFirst,
      send.isPending,
      requiresDatesForSend,
      hasDates,
      status,
      openDatesModal,
      sendFirstMessage,
    ]
  );

  const canComposeWithoutDates = !requiresDatesForSend || hasDates;

  const voiceReceptionistEnabled =
    status === 'authenticated' &&
    (resumeQuery.data?.voiceReceptionistEnabled === true ||
      startQuery.data?.voiceReceptionistEnabled === true);

  const startVoiceSession = useCallback(() => {
    threadSearch.close();
    setVoiceSessionOpen(true);
  }, [threadSearch.close]);

  const hostAvatarNode = (
    <div className="from-primary to-primary/80 ring-background relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br ring-2">
      {hostAvatar ? (
        <Image
          src={hostAvatar}
          alt={hostLabel}
          width={40}
          height={40}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {hostLabel.charAt(0)}
        </div>
      )}
    </div>
  );

  const loading =
    status === 'loading' ||
    (open && status === 'authenticated' && resumeQuery.isLoading && !localConversationId) ||
    (open &&
      status === 'authenticated' &&
      hasDates &&
      !isReturningGuest &&
      startQuery.isLoading &&
      !showThread &&
      !composeDraft);

  const headerCloseButton = (
    <ResponsiveModalClose asChild>
      <button type="button" className={headerIconButtonClass} aria-label="Close">
        <X className="size-5" aria-hidden />
      </button>
    </ResponsiveModalClose>
  );

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          showCloseButton={false}
          className="flex h-[min(90dvh,720px)] max-h-[min(92dvh,720px)] w-full max-w-[min(calc(100vw-1.5rem),32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0"
          onEscapeKeyDown={(event) => {
            if (voiceSessionOpen) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (voiceSessionOpen) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (voiceSessionOpen) event.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border shrink-0 gap-0 space-y-0 border-b px-5 py-4 text-left">
            <ResponsiveModalTitle className="sr-only">{hostLabel}</ResponsiveModalTitle>
            <GuestChatHeaderBar
              avatar={hostAvatarNode}
              title={hostLabel}
              subtitle={dateLabel ? `${propertyName} · ${dateLabel}` : propertyName}
              replyStatus={showThread ? replyStatus : undefined}
              threadSearch={threadSearch}
              searchEnabled={showThread && !messagesLoading && messages.length > 0}
              onStartVoiceSession={
                voiceReceptionistEnabled && !voiceSessionOpen ? startVoiceSession : undefined
              }
              trailing={headerCloseButton}
            />
          </ResponsiveModalHeader>
          {showThread && !voiceSessionOpen ? (
            <GuestChatSearchPanelRow threadSearch={threadSearch} className="px-5" />
          ) : null}

          <div className="bg-muted/20 flex min-h-0 flex-1 flex-col">
            {voiceSessionOpen && propertySlug ? (
              <VoiceSessionPanel
                propertySlug={propertySlug}
                onClose={() => setVoiceSessionOpen(false)}
              />
            ) : loading ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <Skeleton className="h-24 w-full max-w-xs rounded-2xl" />
              </div>
            ) : showThread && conversationId ? (
              <GuestChatThread
                conversationId={conversationId}
                propertySlug={propertySlug}
                propertyName={propertyName}
                messages={messages}
                isLoading={messagesLoading}
                threadSearch={threadSearch}
                searchInHeader
                sending={send.isPending}
                editing={edit.isPending}
                hasOlderMessages={!!hasNextPage}
                loadingOlder={isFetchingNextPage}
                onLoadOlder={() => void fetchNextPage()}
                onRetryFailed={retryFailedMessage}
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
                unsending={unsend.isPending}
                hasInquiryDates={Boolean(checkIn && checkOut)}
                inquiryCheckIn={displayCheckInDate || undefined}
                inquiryCheckOut={displayCheckOutDate || undefined}
                stayGuideUrl={stayGuideUrl}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                  <GuestChatFaqSuggestions
                    onPick={handlePickFaq}
                    disabled={sendingFirst || send.isPending}
                    hasInquiryDates={Boolean(checkIn && checkOut)}
                  />
                </div>
                <div className="border-border shrink-0 border-t px-5 py-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)]">
                  <div className="flex items-end gap-2">
                    {canComposeWithoutDates ? (
                      <>
                        <Textarea
                          value={composeDraft}
                          maxLength={CHAT_MESSAGE_MAX_CHARS}
                          onChange={(e) => setComposeDraft(e.target.value)}
                          placeholder="Message"
                          rows={1}
                          className="max-h-32 min-h-[44px] flex-1 resize-none py-3 text-base"
                          aria-label="Message to host"
                          disabled={sendingFirst}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendFirst();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] shrink-0 rounded-full"
                          disabled={!composeDraft.trim() || sendingFirst}
                          onClick={handleSendFirst}
                          aria-label="Send message"
                        >
                          {sendingFirst ? (
                            <Loader2 className="size-5 animate-spin" aria-hidden />
                          ) : (
                            <SendHorizontal className="size-5" aria-hidden />
                          )}
                        </Button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={openDatesModal}
                        className="border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground flex min-h-[44px] w-full items-center gap-2 rounded-md border px-3 text-base transition-colors"
                        aria-label="Select dates"
                      >
                        <CalendarDays className="size-5 shrink-0" aria-hidden />
                        Select Dates
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <BookingCalendarModal
        open={datesModalOpen}
        onOpenChange={setDatesModalOpen}
        propertySlug={listingSlug}
        propertyName={propertyName}
        checkIn={checkIn}
        checkOut={checkOut}
        onDatesChange={handleDatesSaved}
      />
    </>
  );
}
