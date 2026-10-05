import { useEffect, useMemo, useState } from 'react';

import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { ChevronLeft } from 'lucide-react';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import {
  GuestChatHeaderBar,
  GuestChatSearchPanelRow,
} from '@/features/guest/chat/components/GuestChatHeaderBar';
import { GuestChatThread } from '@/features/guest/chat/components/GuestChatThread';
import { PropertyChatEmbedPreview } from '@/features/guest/chat/components/PropertyChatEmbedPreview';
import { VoiceSessionPanel } from '@/features/guest/chat/components/voice/VoiceSessionPanel';
import { useGuestChatMessages, useGuestChatStart } from '@/features/guest/chat/hooks/useGuestChat';
import { isGuestEmbedPreview } from '@/features/guest/lib/guestEmbedPreview';
import {
  guestPropertyPath,
  guestPropertyPickDatesPath,
} from '@/features/guest/lib/guestPublicPaths';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { GuestStayContextBar } from '@/features/guest/property/components/GuestStayContextBar';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatThreadSearch } from '@/lib/chat/useChatThreadSearch';
import { cn } from '@/lib/utils';
import { parseGuestInquiryDateRange } from '@/utils/format/dates';

function parseInquiryDates(searchParams: URLSearchParams): {
  checkInDate: string;
  checkOutDate: string;
} | null {
  const checkInDate = searchParams.get('checkInDate')?.trim() ?? '';
  const checkOutDate = searchParams.get('checkOutDate')?.trim() ?? '';
  const range = parseGuestInquiryDateRange(checkInDate, checkOutDate);
  if (!range) return null;
  return { checkInDate, checkOutDate };
}

export function PropertyChatPage() {
  const { propertySlug = '' } = useParams<{ propertySlug: string }>();
  const [searchParams] = useSearchParams();
  const { status, requireGuestAuth } = useGuestAuth();

  const dates = useMemo(() => parseInquiryDates(searchParams), [searchParams]);
  const propertyPath = guestPropertyPath(propertySlug);
  const embedPreview = isGuestEmbedPreview(searchParams);

  useEffect(() => {
    if (embedPreview || status !== 'anonymous' || !dates) return;
    requireGuestAuth(() => undefined, {
      resume: {
        type: 'navigate',
        to: `${propertyPath}/messages?${searchParams.toString()}`,
      },
    });
  }, [embedPreview, status, dates, requireGuestAuth, propertyPath, searchParams]);

  if (!dates) {
    return <Navigate to={guestPropertyPickDatesPath(propertySlug, 'contactHost')} replace />;
  }

  if (embedPreview) {
    return (
      <PropertyChatEmbedPreview checkInDate={dates.checkInDate} checkOutDate={dates.checkOutDate} />
    );
  }

  if (status === 'loading' || status === 'anonymous') {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-[60vh] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <PropertyChatContent
      propertySlug={propertySlug}
      checkInDate={dates.checkInDate}
      checkOutDate={dates.checkOutDate}
      propertyPath={propertyPath}
    />
  );
}

function PropertyChatContent({
  propertySlug,
  checkInDate,
  checkOutDate,
  propertyPath,
}: {
  propertySlug: string;
  checkInDate: string;
  checkOutDate: string;
  propertyPath: string;
}) {
  const startQuery = useGuestChatStart({
    propertySlug,
    checkInDate,
    checkOutDate,
    enabled: true,
  });
  const [voiceSessionOpen, setVoiceSessionOpen] = useState(false);

  const conversationId = startQuery.data?.conversationId ?? null;
  const {
    messages,
    isLoading,
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

  const threadSearch = useChatThreadSearch(messages);

  if (startQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Link
          to={propertyPath}
          className="text-muted-foreground inline-flex min-h-[44px] items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </Link>
        <p className="text-destructive text-sm">{(startQuery.error as Error).message}</p>
      </div>
    );
  }

  const host = startQuery.data?.host;
  const propertyName = startQuery.data?.property?.name ?? 'Property';
  const hostLabel = host?.ownerName?.trim() || 'Host';
  const hostAvatar = host?.ownerAvatarUrl ?? null;

  const hostAvatarNode = (
    <div className="from-primary to-primary/80 relative size-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br">
      {hostAvatar ? (
        <Image
          src={hostAvatar}
          alt={hostLabel}
          width={36}
          height={36}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
          {hostLabel.charAt(0)}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'bg-card mx-auto flex w-full max-w-3xl flex-col overflow-hidden',
        /* Match MainLayout surface-card radius when flush (sm+ has no card padding). */
        'sm:rounded-3xl',
        /* Mobile: fill remaining viewport under the operational band + footer. */
        'h-[calc(100dvh-12.5rem)]',
        /* Tablet/desktop: roomy messaging pane — fits under the band without looking tiny. */
        'md:h-[min(44rem,calc(100dvh-16rem))]',
        'lg:h-[min(48rem,calc(100dvh-14rem))]',
        'xl:h-[min(52rem,calc(100dvh-12rem))]'
      )}
    >
      <div className="border-border shrink-0 border-b">
        <div className="px-3 py-2">
          {startQuery.isLoading ? (
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] shrink-0"
                asChild
              >
                <Link to={propertyPath} aria-label="Back to property">
                  <ChevronLeft className="size-5" />
                </Link>
              </Button>
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <GuestChatHeaderBar
              leading={
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  asChild
                >
                  <Link to={propertyPath} aria-label="Back to property">
                    <ChevronLeft className="size-5" />
                  </Link>
                </Button>
              }
              avatar={hostAvatarNode}
              title={hostLabel}
              subtitle={propertyName}
              replyStatus={replyStatus}
              threadSearch={threadSearch}
              searchEnabled={!!conversationId && !isLoading && messages.length > 0}
              onStartVoiceSession={
                startQuery.data?.voiceReceptionistEnabled
                  ? () => setVoiceSessionOpen(true)
                  : undefined
              }
            />
          )}
        </div>
        {!startQuery.isLoading ? <GuestChatSearchPanelRow threadSearch={threadSearch} /> : null}
        {!startQuery.isLoading ? (
          <div className="border-border border-t px-3 py-2">
            <GuestStayContextBar
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              width="full"
              density="compact"
            />
          </div>
        ) : null}
      </div>

      {startQuery.isLoading || !conversationId ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <Skeleton className="h-[50vh] w-full rounded-2xl" />
        </div>
      ) : voiceSessionOpen ? (
        <VoiceSessionPanel propertySlug={propertySlug} onClose={() => setVoiceSessionOpen(false)} />
      ) : (
        <GuestChatThread
          conversationId={conversationId}
          propertySlug={propertySlug}
          propertyName={propertyName}
          messages={messages}
          isLoading={isLoading}
          hasInquiryDates
          inquiryCheckIn={checkInDate}
          inquiryCheckOut={checkOutDate}
          stayGuideUrl={startQuery.data?.stayGuideUrl ?? null}
          tripPath={startQuery.data?.tripPath ?? null}
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
        />
      )}
    </div>
  );
}
