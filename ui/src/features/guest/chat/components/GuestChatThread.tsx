import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Loader2, Paperclip, Pencil, Reply, SendHorizontal, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';

import { GuestChatFaqSuggestions } from '@/features/guest/chat/components/GuestChatFaqSuggestions';
import { GuestChatInsertMenu } from '@/features/guest/chat/components/GuestChatInsertMenu';
import { GuestChatResourceHub } from '@/features/guest/chat/components/GuestChatResourceHub';
import {
  canGuestEditMessage,
  canGuestUnsendMessage,
  type GuestChatAttachment,
  type GuestChatMessage,
} from '@/features/guest/chat/lib/guestChatApi';
import { BookingCalendarModal } from '@/features/guest/marketing/properties/components/property-detail/BookingCalendarModal';

import {
  InboxMediaPreviewDialog,
  InboxMessageMediaTile,
} from '@/features/dashboard/inbox/components/InboxMediaPreviewDialog';
import type { InboxAttachmentPreview } from '@/features/dashboard/inbox/lib/inboxMessageAttachments';

import { ChatComposerContextBar } from '@/components/chat/ChatComposerContextBar';
import {
  ChatMessageActionItem,
  ChatMessageActionsMenu,
} from '@/components/chat/ChatMessageActionsMenu';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatThreadSearchPanel } from '@/components/chat/ChatThreadSearch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_MAX_ATTACHMENTS,
  chatAttachmentPreviews,
} from '@/lib/chat/chatAttachments';
import { isChatActionEligibilityError } from '@/lib/chat/chatMessageActions';
import {
  formatChatBubbleTime,
  isChatMessageUnsent,
  resolveOutboundDeliveryStatus,
  unsentMessageLabel,
} from '@/lib/chat/chatMessageFormat';
import { focusComposerInput, type ComposerFocusMode } from '@/lib/chat/focusComposerInput';
import { CHAT_MESSAGE_MAX_CHARS } from '@/lib/chat/messageLimits';
import {
  useChatThreadSearch,
  type ChatThreadSearchController,
} from '@/lib/chat/useChatThreadSearch';
import { useChatTyping } from '@/lib/chat/useChatTyping';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

type ComposerMode =
  | { kind: 'compose' }
  | { kind: 'reply'; messageId: string; preview: string }
  | { kind: 'edit'; messageId: string; preview: string };

type SendOpts = {
  replyToMessageId?: string;
  attachments?: GuestChatAttachment[];
};

type Props = {
  className?: string;
  conversationId?: string | null;
  /** Enables the "Check availability" calendar link cards to open an in-place modal. */
  propertySlug?: string | null;
  propertyName?: string;
  messages: GuestChatMessage[];
  isLoading: boolean;
  onSend: (text: string, opts?: SendOpts) => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<GuestChatAttachment>;
  onEdit?: (messageId: string, text: string) => Promise<void>;
  onUnsend?: (messageId: string) => Promise<void>;
  onRetryFailed?: (messageId: string, text: string) => void;
  sending: boolean;
  uploadingAttachment?: boolean;
  editing?: boolean;
  unsending?: boolean;
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  /** When set, search UI is rendered in `GuestChatHeaderBar` instead of this thread. */
  threadSearch?: ChatThreadSearchController;
  searchInHeader?: boolean;
  /** FAQ starters when the thread has no messages yet. Default true. */
  faqSuggestions?: boolean;
  hasInquiryDates?: boolean;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
  /** Self-serve link strip when the thread has messages. Default true. */
  resourceHub?: boolean;
  stayGuideUrl?: string | null;
};

const ACCEPTED_FILE_TYPES = CHAT_ATTACHMENT_ACCEPT;

export function GuestChatThread({
  className,
  conversationId = null,
  propertySlug = null,
  propertyName = '',
  messages,
  isLoading,
  onSend,
  onUploadAttachment,
  onEdit,
  onUnsend,
  onRetryFailed,
  sending,
  uploadingAttachment = false,
  editing = false,
  unsending = false,
  hasOlderMessages = false,
  loadingOlder = false,
  onLoadOlder,
  threadSearch: threadSearchProp,
  searchInHeader = false,
  faqSuggestions = true,
  hasInquiryDates = false,
  inquiryCheckIn = null,
  inquiryCheckOut = null,
  resourceHub = true,
  stayGuideUrl = null,
}: Props) {
  const [draft, setDraft] = useState('');
  const [pickingFaq, setPickingFaq] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<GuestChatAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<InboxAttachmentPreview | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>({ kind: 'compose' });
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarCheckIn, setCalendarCheckIn] = useState<Date | null>(null);
  const [calendarCheckOut, setCalendarCheckOut] = useState<Date | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingComposerFocusRef = useRef<ComposerFocusMode | null>(null);
  const shouldSmoothScrollRef = useRef(false);
  const prevTailKeyRef = useRef('');
  const prevScrollHeightRef = useRef(0);
  const loadingOlderRef = useRef(loadingOlder);
  loadingOlderRef.current = loadingOlder;

  const { peerTyping, signalTyping } = useChatTyping(conversationId, 'guest', !!conversationId);
  const internalSearch = useChatThreadSearch(messages);
  const threadSearch = threadSearchProp ?? internalSearch;
  const headerSearch = searchInHeader || !!threadSearchProp;

  const messageTailKey = messages[messages.length - 1]?.id ?? '';
  const isBusy = sending || editing || unsending || uploadingAttachment || pickingFaq;
  const canSend =
    composerMode.kind !== 'edit' &&
    (draft.trim().length > 0 || pendingAttachments.length > 0) &&
    !isBusy;

  useEffect(() => {
    setComposerMode({ kind: 'compose' });
    setDraft('');
    setPickingFaq(false);
    threadSearch.close();
    setPendingAttachments([]);
  }, [conversationId, threadSearch.close]);

  useEffect(() => {
    if (!threadSearch.open || !threadSearch.activeMatch) return;
    const root = scrollContainerRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-chat-message-id="${threadSearch.activeMatch.messageId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [threadSearch.open, threadSearch.activeMatch, threadSearch.activeIndex]);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoading) return;

    if (loadingOlder) {
      prevScrollHeightRef.current = el.scrollHeight;
      return;
    }

    const prevTail = prevTailKeyRef.current;
    const tailChanged = messageTailKey !== prevTail;
    prevTailKeyRef.current = messageTailKey;

    if (prevScrollHeightRef.current > 0 && tailChanged) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
      return;
    }

    if (tailChanged || shouldSmoothScrollRef.current) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: shouldSmoothScrollRef.current ? 'smooth' : 'auto',
      });
      shouldSmoothScrollRef.current = false;
    }
  }, [messages, isLoading, loadingOlder, messageTailKey]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const scrollRoot = scrollContainerRef.current;
    if (!sentinel || !hasOlderMessages || loadingOlder || !onLoadOlder) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingOlderRef.current) {
          onLoadOlder();
        }
      },
      { root: scrollRoot, rootMargin: '80px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlderMessages, loadingOlder, onLoadOlder, messages.length]);

  const clearComposerMode = () => {
    setComposerMode({ kind: 'compose' });
    setDraft('');
    setPendingAttachments([]);
  };

  const startReply = (message: GuestChatMessage) => {
    const preview = message.body_text?.trim() || '(attachment)';
    setComposerMode({ kind: 'reply', messageId: message.id, preview });
    setDraft('');
    setPendingAttachments([]);
    pendingComposerFocusRef.current = 'reply';
  };

  const startEdit = (message: GuestChatMessage) => {
    if (!canGuestEditMessage(message, messages)) return;
    const preview = message.body_text?.trim() || '';
    setComposerMode({ kind: 'edit', messageId: message.id, preview });
    setDraft(preview);
    setPendingAttachments([]);
    pendingComposerFocusRef.current = 'edit';
  };

  useEffect(() => {
    if (composerMode.kind !== 'edit') return;
    const target = messages.find((m) => m.id === composerMode.messageId);
    if (!target || !canGuestEditMessage(target, messages)) {
      clearComposerMode();
    }
  }, [messages, composerMode]);

  useLayoutEffect(() => {
    const mode = pendingComposerFocusRef.current;
    if (!mode || composerMode.kind !== mode) return;
    pendingComposerFocusRef.current = null;
    focusComposerInput(composerInputRef.current, mode);
  }, [composerMode]);

  const openPreview = (att: InboxAttachmentPreview) => {
    if (att.kind === 'image' || att.kind === 'video') {
      setPreviewAttachment(att);
      return;
    }
    window.open(att.url, '_blank', 'noopener,noreferrer');
  };

  const handlePickFile = () => {
    if (!onUploadAttachment || composerMode.kind === 'edit') return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUploadAttachment) return;
    if (pendingAttachments.length >= CHAT_MAX_ATTACHMENTS) {
      toast.error(`Up to ${CHAT_MAX_ATTACHMENTS} attachments per message`);
      return;
    }

    try {
      const attachment = await onUploadAttachment(file);
      setPendingAttachments((prev) =>
        prev.length >= CHAT_MAX_ATTACHMENTS ? prev : [...prev, attachment]
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const appendToDraft = (value: string) => {
    setDraft((prev) => `${prev}${prev.trim() ? '\n' : ''}${value}`);
  };

  const handleSend = async () => {
    const text = draft.trim();
    const attachments = pendingAttachments.length > 0 ? pendingAttachments : undefined;

    if (composerMode.kind === 'edit') {
      if (!text || isBusy || !onEdit) return;
    } else if (!text && !attachments?.length) {
      return;
    }
    if (isBusy) return;

    try {
      shouldSmoothScrollRef.current = true;

      if (composerMode.kind === 'edit') {
        if (!onEdit) return;
        await onEdit(composerMode.messageId, text);
      } else {
        await onSend(
          text,
          composerMode.kind === 'reply'
            ? { replyToMessageId: composerMode.messageId, attachments }
            : { attachments }
        );
      }

      if (composerMode.kind !== 'edit') {
        captureAppEvent('guest_message_sent', {
          source: 'composer',
          composer_mode: composerMode.kind,
          has_attachments: Boolean(attachments?.length),
        });
      }
      clearComposerMode();
    } catch (e) {
      const message = (e as Error).message;
      if (isChatActionEligibilityError(message)) {
        clearComposerMode();
        return;
      }
      toast.error(message);
    }
  };

  const handlePickFaq = (prompt: string) => {
    const text = prompt.trim();
    if (!text || isBusy || composerMode.kind !== 'compose') return;
    shouldSmoothScrollRef.current = true;
    setPickingFaq(true);
    void onSend(text)
      .then(() => {
        captureAppEvent('guest_message_sent', {
          source: 'faq_suggestion',
          composer_mode: 'compose',
          has_attachments: false,
        });
      })
      .catch((e) => {
        const message = (e as Error).message;
        if (isChatActionEligibilityError(message)) return;
        toast.error(message);
      })
      .finally(() => {
        setPickingFaq(false);
      });
  };

  const composerBar =
    composerMode.kind === 'reply' ? (
      <ChatComposerContextBar
        mode="reply"
        preview={composerMode.preview}
        onClear={clearComposerMode}
      />
    ) : composerMode.kind === 'edit' ? (
      <ChatComposerContextBar
        mode="edit"
        preview={composerMode.preview}
        onClear={clearComposerMode}
      />
    ) : null;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <InboxMediaPreviewDialog
        attachment={previewAttachment}
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      />

      {propertySlug ? (
        <BookingCalendarModal
          open={calendarModalOpen}
          onOpenChange={setCalendarModalOpen}
          propertySlug={propertySlug}
          propertyName={propertyName}
          checkIn={calendarCheckIn}
          checkOut={calendarCheckOut}
          onDatesChange={(checkIn, checkOut) => {
            setCalendarCheckIn(checkIn);
            setCalendarCheckOut(checkOut);
          }}
        />
      ) : null}

      {!headerSearch && threadSearch.open ? (
        <ChatThreadSearchPanel
          query={threadSearch.query}
          onQueryChange={threadSearch.setQuery}
          matchCount={threadSearch.matches.length}
          activeIndex={threadSearch.activeIndex}
          onPrev={threadSearch.goPrev}
          onNext={threadSearch.goNext}
          onClose={threadSearch.close}
        />
      ) : null}

      <div
        ref={scrollContainerRef}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain',
          !isLoading && faqSuggestions && messages.length === 0 ? 'flex flex-col' : 'px-3 py-2'
        )}
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-2/3 rounded-2xl" />
            ))}
          </div>
        ) : faqSuggestions && messages.length === 0 ? (
          <GuestChatFaqSuggestions
            onPick={handlePickFaq}
            disabled={isBusy}
            hasInquiryDates={hasInquiryDates}
            hasMessages={messages.length > 0}
          />
        ) : (
          <>
            <div ref={topSentinelRef} className="h-px w-full shrink-0" aria-hidden />
            {hasOlderMessages && onLoadOlder ? (
              <div className="mb-4 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-10 min-h-[44px]"
                  disabled={loadingOlder}
                  onClick={onLoadOlder}
                >
                  {loadingOlder ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    'Load earlier messages'
                  )}
                </Button>
              </div>
            ) : null}
            <ChatMessageList
              className="space-y-3"
              messages={messages}
              focusedMessageId={threadSearch.activeMessageId}
              getOutbound={(msg) => msg.direction === 'inbound'}
              renderMessage={(msg) => {
                const outbound = msg.direction === 'inbound';
                const isUnsent = isChatMessageUnsent(msg);
                const attachments = isUnsent ? [] : chatAttachmentPreviews(msg.attachments);
                const bodyText = msg.body_text ?? '';
                const hasText = !!bodyText.trim();
                const hasMedia = attachments.length > 0;
                const highlightQuery = threadSearch.open ? threadSearch.trimmedQuery : '';
                const activeHighlightRange =
                  threadSearch.activeMatch?.messageId === msg.id
                    ? {
                        start: threadSearch.activeMatch.start,
                        end: threadSearch.activeMatch.end,
                      }
                    : null;
                const showEdit =
                  !isUnsent && outbound && canGuestEditMessage(msg, messages) && !!onEdit;
                const showUnsend =
                  !isUnsent && outbound && canGuestUnsendMessage(msg, messages) && !!onUnsend;
                const deliveryStatus =
                  !isUnsent && outbound ? resolveOutboundDeliveryStatus(msg) : null;

                const messageActions = (
                  <ChatMessageActionsMenu outbound={outbound}>
                    <ChatMessageActionItem onSelect={() => startReply(msg)}>
                      <Reply className="size-3.5" aria-hidden />
                      Reply
                    </ChatMessageActionItem>
                    {showEdit ? (
                      <ChatMessageActionItem onSelect={() => startEdit(msg)}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </ChatMessageActionItem>
                    ) : null}
                    {showUnsend ? (
                      <ChatMessageActionItem
                        destructive
                        onSelect={() => {
                          void onUnsend?.(msg.id).catch((e) => {
                            const message = (e as Error).message;
                            if (isChatActionEligibilityError(message)) return;
                            toast.error(message);
                          });
                        }}
                      >
                        <Undo2 className="size-3.5" aria-hidden />
                        Unsend
                      </ChatMessageActionItem>
                    ) : null}
                  </ChatMessageActionsMenu>
                );

                const bubble =
                  isUnsent || hasText || (!hasText && !hasMedia) ? (
                    <ChatMessageBubble
                      bodyText={
                        isUnsent
                          ? unsentMessageLabel(outbound)
                          : hasText
                            ? bodyText
                            : '(attachment)'
                      }
                      outbound={outbound}
                      unsent={isUnsent}
                      sentAt={msg.sent_at}
                      deliveryStatus={deliveryStatus}
                      isAiGenerated={!isUnsent && msg.is_ai_generated}
                      edited={!isUnsent && Boolean(msg.edited_at)}
                      replyPreviewText={isUnsent ? null : msg.reply_preview_text}
                      highlightQuery={highlightQuery}
                      activeHighlightRange={activeHighlightRange}
                      onRetry={
                        !isUnsent && msg.delivery_status === 'failed' && onRetryFailed
                          ? () => onRetryFailed(msg.id, bodyText)
                          : undefined
                      }
                      actions={messageActions}
                      onCalendarLinkClick={
                        propertySlug ? () => setCalendarModalOpen(true) : undefined
                      }
                    />
                  ) : null;

                return (
                  <div
                    className={cn(
                      'flex w-full flex-col gap-1.5',
                      outbound ? 'items-end' : 'items-start'
                    )}
                  >
                    {bubble}
                    {hasMedia ? (
                      <div
                        className={cn(
                          'flex flex-col gap-1.5',
                          outbound ? 'items-end' : 'items-start'
                        )}
                      >
                        <div
                          className={cn(
                            'group/msg flex max-w-full items-center gap-0.5',
                            outbound ? 'flex-row-reverse' : 'flex-row'
                          )}
                        >
                          <div
                            className={cn(
                              'flex flex-col gap-1.5',
                              outbound ? 'items-end' : 'items-start'
                            )}
                          >
                            {attachments.map((att, i) => (
                              <InboxMessageMediaTile
                                key={`${msg.id}-att-${i}`}
                                attachment={att}
                                outbound={outbound}
                                onOpen={() => openPreview(att)}
                              />
                            ))}
                          </div>
                          {!hasText && !isUnsent ? messageActions : null}
                        </div>
                        {!hasText ? (
                          <time
                            className="text-muted-foreground px-1 text-[11px] tabular-nums"
                            dateTime={msg.sent_at}
                          >
                            {formatChatBubbleTime(msg.sent_at)}
                          </time>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
          </>
        )}
      </div>

      {resourceHub && propertySlug && messages.length > 0 && composerMode.kind !== 'edit' ? (
        <GuestChatResourceHub
          propertySlug={propertySlug}
          stayGuideUrl={stayGuideUrl}
          onCalendarLinkClick={() => setCalendarModalOpen(true)}
        />
      ) : null}

      <div className="border-border bg-card shrink-0 space-y-1.5 border-t px-3 py-2.5 pb-[max(env(safe-area-inset-bottom,0px),0.625rem)]">
        {peerTyping ? (
          <p className="text-muted-foreground text-xs" aria-live="polite">
            Host is typing…
          </p>
        ) : null}
        {composerBar}
        {pendingAttachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pendingAttachments.map((att, index) => (
              <div
                key={`${att.url}-${index}`}
                className="bg-muted flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs"
              >
                <span className="min-w-0 truncate">
                  {att.label ?? (att.kind === 'image' ? 'Image' : 'File')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 min-h-[32px] min-w-[32px] shrink-0"
                  aria-label="Remove attachment"
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-1.5">
          {propertySlug && composerMode.kind !== 'edit' ? (
            <GuestChatInsertMenu
              propertySlug={propertySlug}
              inquiryCheckIn={inquiryCheckIn}
              inquiryCheckOut={inquiryCheckOut}
              disabled={isBusy}
              onInsert={appendToDraft}
            />
          ) : null}
          {onUploadAttachment && composerMode.kind !== 'edit' ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="sr-only"
                onChange={(e) => void handleFileChange(e)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] shrink-0"
                disabled={isBusy || pendingAttachments.length >= CHAT_MAX_ATTACHMENTS}
                aria-label="Attach file"
                onClick={handlePickFile}
              >
                {uploadingAttachment ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Paperclip className="size-4" aria-hidden />
                )}
              </Button>
            </>
          ) : null}
          <Textarea
            ref={composerInputRef}
            value={draft}
            maxLength={CHAT_MESSAGE_MAX_CHARS}
            onChange={(e) => {
              setDraft(e.target.value);
              signalTyping();
            }}
            placeholder={composerMode.kind === 'edit' ? 'Edit message' : 'Message'}
            rows={1}
            className="bg-card max-h-28 min-h-[44px] flex-1 resize-none py-2.5 text-[15px] leading-snug sm:text-sm"
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend || (composerMode.kind === 'edit' && draft.trim())) {
                  void handleSend();
                }
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-full"
            disabled={composerMode.kind === 'edit' ? !draft.trim() || isBusy : !canSend}
            onClick={() => void handleSend()}
            aria-label={composerMode.kind === 'edit' ? 'Save edit' : 'Send message'}
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <SendHorizontal className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
