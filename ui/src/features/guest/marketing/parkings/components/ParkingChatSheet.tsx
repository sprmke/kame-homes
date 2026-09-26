import dayjs from 'dayjs';
import { X } from 'lucide-react';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import {
  GuestChatHeaderBar,
  headerIconButtonClass,
} from '@/features/guest/chat/components/GuestChatHeaderBar';
import { GuestChatThread } from '@/features/guest/chat/components/GuestChatThread';
import {
  useGuestChatMessages,
  useGuestChatResume,
  useGuestChatStart,
} from '@/features/guest/chat/hooks/useGuestChat';

import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatThreadSearch } from '@/lib/chat/useChatThreadSearch';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkingSlug: string;
  parkingLabel: string;
  hostName: string;
  /** `MM-DD-YYYY`, matching `guest_submissions.parking_check_in/out_date`. */
  checkInDate: string;
  checkOutDate: string;
};

function toIsoDate(mmddyyyy: string): string {
  const parsed = dayjs(mmddyyyy, 'MM-DD-YYYY', true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

/**
 * Post-match parking chat (Phase 5) — reuses the guest-facing web chat infra
 * (`useGuestChat*`/`GuestChatThread`) that `ContactHostSheet` already uses for pre-booking
 * inquiries, minus the inquiry-specific bits (FAQ starters, date picker, voice session) that
 * don't apply once a booking is already confirmed.
 */
export function ParkingChatSheet({
  open,
  onOpenChange,
  parkingSlug,
  parkingLabel,
  hostName,
  checkInDate,
  checkOutDate,
}: Props) {
  const { status: guestAuthStatus } = useGuestAuth();
  const isAuthenticated = guestAuthStatus === 'authenticated';
  const isoCheckIn = toIsoDate(checkInDate);
  const isoCheckOut = toIsoDate(checkOutDate);

  const resumeQuery = useGuestChatResume({
    parkingSlug,
    enabled: open && isAuthenticated && !!parkingSlug,
  });
  const resumedConversationId =
    resumeQuery.data?.conversationId && !resumeQuery.isLoading
      ? resumeQuery.data.conversationId
      : null;

  const startQuery = useGuestChatStart({
    parkingSlug,
    checkInDate: isoCheckIn,
    checkOutDate: isoCheckOut,
    enabled:
      open && isAuthenticated && !!parkingSlug && !resumeQuery.isLoading && !resumedConversationId,
  });

  const conversationId = resumedConversationId ?? startQuery.data?.conversationId ?? null;

  const {
    messages,
    isLoading: messagesLoading,
    send,
    edit,
    unsend,
    uploadAttachment,
    retryFailedMessage,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGuestChatMessages(conversationId);

  const loading =
    isAuthenticated && (resumeQuery.isLoading || (!resumedConversationId && startQuery.isLoading));
  const threadSearch = useChatThreadSearch(messages);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        className="flex h-[min(90dvh,720px)] max-h-[min(92dvh,720px)] w-full max-w-[min(calc(100vw-1.5rem),32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0"
      >
        <ResponsiveModalHeader className="border-border shrink-0 gap-0 space-y-0 border-b px-5 py-4 text-left">
          <ResponsiveModalTitle className="sr-only">
            {hostName || 'Parking host'}
          </ResponsiveModalTitle>
          <GuestChatHeaderBar
            avatar={
              <div className="from-primary to-primary/80 ring-background flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ring-2">
                {(hostName || 'H').charAt(0)}
              </div>
            }
            title={hostName || 'Parking host'}
            subtitle={parkingLabel}
            threadSearch={threadSearch}
            searchEnabled={!messagesLoading && messages.length > 0}
            trailing={
              <ResponsiveModalClose asChild>
                <button type="button" className={headerIconButtonClass} aria-label="Close">
                  <X className="size-5" aria-hidden />
                </button>
              </ResponsiveModalClose>
            }
          />
        </ResponsiveModalHeader>

        <div className="bg-muted/20 flex min-h-0 flex-1 flex-col">
          {!isAuthenticated ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-muted-foreground text-sm">Sign in to chat with your host.</p>
            </div>
          ) : loading ? (
            <div
              className="flex flex-1 flex-col justify-end gap-3 p-4"
              role="status"
              aria-live="polite"
              aria-label="Loading messages"
            >
              <Skeleton className="h-14 w-2/3 rounded-2xl" aria-hidden />
              <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" aria-hidden />
              <Skeleton className="h-14 w-3/5 rounded-2xl" aria-hidden />
              <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" aria-hidden />
            </div>
          ) : (
            <GuestChatThread
              conversationId={conversationId}
              propertyName={parkingLabel}
              messages={messages}
              isLoading={messagesLoading}
              faqSuggestions={false}
              threadSearch={threadSearch}
              searchInHeader
              sending={send.isPending}
              editing={edit.isPending}
              unsending={unsend.isPending}
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
            />
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
