import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  RefreshCw,
  Reply,
  SendHorizontal,
  Sparkles,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { BookingCalendarModal } from '@/features/guest/marketing/properties/components/property-detail/BookingCalendarModal';

import { useBookingStayGuideLink } from '@/features/dashboard/bookings/hooks/useBookingStayGuideLink';
import { InboxInsertMenu } from '@/features/dashboard/inbox/components/InboxInsertMenu';
import {
  InboxMediaPreviewDialog,
  InboxMessageMediaTile,
} from '@/features/dashboard/inbox/components/InboxMediaPreviewDialog';
import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { useInboxMatchedBooking } from '@/features/dashboard/inbox/hooks/useInboxMatchedBooking';
import type { InboxChatAttachment } from '@/features/dashboard/inbox/lib/inboxChatAttachment';
import { readPropertyCheckInTimes } from '@/features/dashboard/inbox/lib/inboxCheckInPack';
import {
  isMessagingWindowOpen,
  messagingWindowLabel,
  platformLabel,
} from '@/features/dashboard/inbox/lib/inboxFormat';
import { readPropertyMapsUrl } from '@/features/dashboard/inbox/lib/inboxInsertContent';
import {
  inboxAttachmentPreviews,
  type InboxAttachmentPreview,
} from '@/features/dashboard/inbox/lib/inboxMessageAttachments';
import { readInboxPinnedSnippets } from '@/features/dashboard/inbox/lib/inboxPinnedSnippets';
import { applyInboxQuickReplyMerge } from '@/features/dashboard/inbox/lib/inboxQuickReplyMerge';
import { templatesForConversationPlatform } from '@/features/dashboard/inbox/lib/quickReplyGroups';
import {
  type InboxConversation,
  type InboxMessage,
  type InboxTemplate,
  canHostEditMessage,
  canHostUnsendMessage,
} from '@/features/dashboard/inbox/types/inbox';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { ChatComposerContextBar } from '@/components/chat/ChatComposerContextBar';
import {
  ChatMessageActionItem,
  ChatMessageActionsMenu,
} from '@/components/chat/ChatMessageActionsMenu';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatThreadSearchPanel, ChatThreadSearchTrigger } from '@/components/chat/ChatThreadSearch';
import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { CHAT_ATTACHMENT_ACCEPT, CHAT_MAX_ATTACHMENTS } from '@/lib/chat/chatAttachments';
import { isChatActionEligibilityError } from '@/lib/chat/chatMessageActions';
import {
  formatChatBubbleTime,
  isChatMessageUnsent,
  resolveOutboundDeliveryStatus,
  unsentMessageLabel,
} from '@/lib/chat/chatMessageFormat';
import { focusComposerInput, type ComposerFocusMode } from '@/lib/chat/focusComposerInput';
import { useChatThreadSearch } from '@/lib/chat/useChatThreadSearch';
import { useChatTyping } from '@/lib/chat/useChatTyping';
import { cn } from '@/lib/utils';
import { formatStayDateRange } from '@/utils/format/dates';

const MESSAGE_SKELETON_ROWS = [
  { outbound: false, widthClass: 'w-2/3' },
  { outbound: false, widthClass: 'w-2/5' },
  { outbound: true, widthClass: 'w-1/2' },
  { outbound: false, widthClass: 'w-3/4' },
  { outbound: true, widthClass: 'w-1/3' },
];

function InboxMessageBubbleSkeleton({
  outbound,
  widthClass,
}: {
  outbound: boolean;
  widthClass: string;
}) {
  return (
    <div
      className={cn('flex w-full flex-col gap-1', outbound ? 'items-end' : 'items-start')}
      aria-hidden
    >
      <Skeleton className={cn('h-11 max-w-[min(100%,28rem)] rounded-2xl', widthClass)} />
      <Skeleton className="h-2.5 w-10 rounded-full" />
    </div>
  );
}

type ComposerMode =
  | { kind: 'compose' }
  | { kind: 'reply'; messageId: string; preview: string }
  | { kind: 'edit'; messageId: string; preview: string };

type Props = {
  conversation: InboxConversation | null;
  messages: InboxMessage[];
  isLoading: boolean;
  canReply: boolean;
  templates: InboxTemplate[];
  /** Facebook/Instagram threads only — this property has no Page of its own, so
   *  replies here go through the organization's shared Meta connection (visible
   *  identically on every other property that also falls back to it). */
  usingOrgMeta?: boolean;
  onBack?: () => void;
  onSend: (
    text: string,
    opts?: {
      replyToMessageId?: string;
      useHumanAgentTag?: boolean;
      attachments?: InboxChatAttachment[];
    }
  ) => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<InboxChatAttachment>;
  onEdit?: (messageId: string, text: string) => Promise<void>;
  onUnsend?: (messageId: string) => Promise<void>;
  onSuggest: () => Promise<{ suggestion: string; flagged: boolean }>;
  sending: boolean;
  uploadingAttachment?: boolean;
  editing?: boolean;
  unsending?: boolean;
  suggesting: boolean;
  hasOlderMessages?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  loadError?: string | null;
  onRetryLoad?: () => void;
};

export function InboxConversationView({
  conversation,
  messages,
  isLoading,
  canReply,
  templates,
  usingOrgMeta = false,
  onBack,
  onSend,
  onUploadAttachment,
  onEdit,
  onUnsend,
  onSuggest,
  sending,
  uploadingAttachment = false,
  editing = false,
  unsending = false,
  suggesting,
  hasOlderMessages = false,
  loadingOlder = false,
  onLoadOlder,
  loadError = null,
  onRetryLoad,
}: Props) {
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<InboxChatAttachment[]>([]);
  const [composerMode, setComposerMode] = useState<ComposerMode>({ kind: 'compose' });
  const [draftFromAi, setDraftFromAi] = useState(false);
  const [draftAiFlagged, setDraftAiFlagged] = useState(false);
  const [useHumanAgentTag, setUseHumanAgentTag] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<InboxAttachmentPreview | null>(null);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const isMobileLayout = useIsBelowLg();
  const { canUse: canUseQuickReplies, isLoading: quickRepliesLoading } =
    useFeatureGate('quickReplies');
  const { open: openUpgradeModal } = useUpgradeModal();
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarCheckIn, setCalendarCheckIn] = useState<Date | null>(null);
  const [calendarCheckOut, setCalendarCheckOut] = useState<Date | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingComposerFocusRef = useRef<ComposerFocusMode | null>(null);
  const shouldSmoothScrollRef = useRef(false);
  const prevTailKeyRef = useRef('');
  const prevScrollHeightRef = useRef(0);
  const loadingOlderRef = useRef(loadingOlder);
  loadingOlderRef.current = loadingOlder;

  const orgContext = useOptionalOrgContext();
  const propertyIdParam = usePropertyIdParam();
  const propertyId = orgContext?.property.id ?? propertyIdParam;
  const mapsUrl = readPropertyMapsUrl(orgContext?.property.settings);
  const { checkInTime, checkOutTime } = readPropertyCheckInTimes(orgContext?.property.settings);
  const { booking: matchedBooking } = useInboxMatchedBooking(conversation);
  const stayGuideLink = useBookingStayGuideLink(matchedBooking);

  const quickReplyMergeContext = useMemo(() => {
    if (!conversation) return null;
    return {
      conversation,
      booking: matchedBooking,
      propertySlug: conversation.property_slug,
      mapsUrl,
      stayGuideUrl: stayGuideLink.url || undefined,
    };
  }, [conversation, matchedBooking, mapsUrl, stayGuideLink.url]);

  const visibleTemplates = useMemo(() => {
    if (!conversation) return [];
    return templatesForConversationPlatform(templates, conversation.platform);
  }, [templates, conversation?.platform]);

  const applyQuickReply = useCallback(
    (template: InboxTemplate) => {
      if (!conversation) return;
      if (!canUseQuickReplies) {
        if (!quickRepliesLoading) openUpgradeModal('quickReplies');
        return;
      }
      setDraft(
        applyInboxQuickReplyMerge(
          template.body_text,
          quickReplyMergeContext ?? {
            conversation,
            booking: matchedBooking,
          }
        )
      );
      setDraftFromAi(false);
    },
    [
      canUseQuickReplies,
      conversation,
      matchedBooking,
      openUpgradeModal,
      quickRepliesLoading,
      quickReplyMergeContext,
    ]
  );

  const pinnedSnippets = useMemo(
    () => readInboxPinnedSnippets(orgContext?.property.settings),
    [orgContext?.property.settings]
  );

  const isWeb = conversation?.platform === 'web';
  const showOrgMetaBadge =
    usingOrgMeta &&
    (conversation?.platform === 'facebook' || conversation?.platform === 'instagram');
  const { peerTyping, signalTyping } = useChatTyping(
    conversation?.id ?? null,
    'host',
    !!conversation && isWeb && canReply
  );
  const threadSearch = useChatThreadSearch(messages);

  const messageTailKey = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return '';
    return `${last.id}:${last.sent_at}:${last.body_text?.length ?? 0}`;
  }, [messages]);

  useEffect(() => {
    setDraft('');
    setPendingAttachments([]);
    threadSearch.close();
    setComposerMode({ kind: 'compose' });
    setDraftFromAi(false);
    setDraftAiFlagged(false);
    setUseHumanAgentTag(false);
    shouldSmoothScrollRef.current = false;
  }, [conversation?.id, threadSearch.close]);

  useEffect(() => {
    if (!threadSearch.open || !threadSearch.activeMatch) return;
    const root = scrollContainerRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-chat-message-id="${threadSearch.activeMatch.messageId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [threadSearch.open, threadSearch.activeMatch, threadSearch.activeIndex]);

  useLayoutEffect(() => {
    if (isLoading || !conversation || messages.length === 0) return;
    const node = scrollContainerRef.current;
    if (!node) return;

    const tailChanged = messageTailKey !== prevTailKeyRef.current;
    const hadTail = prevTailKeyRef.current.length > 0;
    prevTailKeyRef.current = messageTailKey;

    if (!tailChanged && hadTail) {
      const delta = node.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) node.scrollTop += delta;
      prevScrollHeightRef.current = node.scrollHeight;
      return;
    }

    const behavior = shouldSmoothScrollRef.current ? 'smooth' : 'auto';
    shouldSmoothScrollRef.current = true;
    node.scrollTo({ top: node.scrollHeight, behavior });
    prevScrollHeightRef.current = node.scrollHeight;
  }, [messageTailKey, conversation?.id, isLoading, conversation, messages.length]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !hasOlderMessages || !onLoadOlder || loadingOlder) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingOlderRef.current) {
          onLoadOlder();
        }
      },
      { root, rootMargin: '80px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlderMessages, loadingOlder, onLoadOlder, conversation?.id, messages.length]);

  const clearComposerMode = useCallback(() => {
    setComposerMode({ kind: 'compose' });
    setDraft('');
    setPendingAttachments([]);
    setDraftFromAi(false);
    setDraftAiFlagged(false);
  }, []);

  useEffect(() => {
    if (composerMode.kind !== 'edit') return;
    const target = messages.find((m) => m.id === composerMode.messageId);
    if (!target || !canHostEditMessage(target, messages)) {
      clearComposerMode();
    }
  }, [messages, composerMode, clearComposerMode]);

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

  if (!conversation) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <MessageSquare className="size-8 opacity-40" aria-hidden />
        <p className="text-sm">Select a conversation</p>
      </div>
    );
  }

  const name = conversation.participant_name?.trim() || 'Guest';
  const windowLabel = isWeb
    ? null
    : messagingWindowLabel(conversation.messaging_window_expires_at, conversation.last_inbound_at);
  const channelDisconnected = !isWeb && conversation.connection_status === 'disconnected';
  const humanAgentWindowOpen =
    !isWeb &&
    conversation.conversation_type === 'dm' &&
    (() => {
      if (!conversation.last_inbound_at) return false;
      const sentAt = new Date(conversation.last_inbound_at);
      if (Number.isNaN(sentAt.getTime())) return false;
      const expiresAt = new Date(sentAt);
      expiresAt.setDate(expiresAt.getDate() + 7);
      return expiresAt.getTime() > Date.now();
    })();
  const windowOpen =
    isWeb ||
    isMessagingWindowOpen(conversation.messaging_window_expires_at, conversation.last_inbound_at);
  const canUseHumanAgentTag =
    composerMode.kind !== 'edit' && humanAgentWindowOpen && !windowOpen && !channelDisconnected;
  const isBusy = sending || editing || unsending || uploadingAttachment;
  const canSend =
    (draft.trim().length > 0 || pendingAttachments.length > 0) &&
    !isBusy &&
    !channelDisconnected &&
    (composerMode.kind === 'edit' || windowOpen || useHumanAgentTag);

  const startReply = (message: InboxMessage) => {
    const preview = message.body_text?.trim() || '(attachment)';
    setComposerMode({ kind: 'reply', messageId: message.id, preview });
    setDraft('');
    setDraftFromAi(false);
    setDraftAiFlagged(false);
    setUseHumanAgentTag(false);
    pendingComposerFocusRef.current = 'reply';
  };

  const startEdit = (message: InboxMessage) => {
    if (!canHostEditMessage(message, messages)) return;
    const preview = message.body_text?.trim() || '';
    setComposerMode({ kind: 'edit', messageId: message.id, preview });
    setDraft(preview);
    setDraftFromAi(false);
    setDraftAiFlagged(false);
    setUseHumanAgentTag(false);
    pendingComposerFocusRef.current = 'edit';
  };

  const handleSend = async () => {
    const rawText = draft.trim();
    if (composerMode.kind !== 'edit' && !rawText && pendingAttachments.length === 0) return;
    const text =
      composerMode.kind !== 'edit' && quickReplyMergeContext
        ? applyInboxQuickReplyMerge(rawText, quickReplyMergeContext)
        : rawText;
    try {
      if (composerMode.kind === 'edit') {
        if (!onEdit || !text) return;
        await onEdit(composerMode.messageId, text);
      } else {
        await onSend(text, {
          replyToMessageId: composerMode.kind === 'reply' ? composerMode.messageId : undefined,
          useHumanAgentTag,
          attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
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

  const handleSuggest = async () => {
    try {
      const result = await onSuggest();
      setDraft(result.suggestion);
      setDraftFromAi(true);
      setDraftAiFlagged(result.flagged);
    } catch (e) {
      if (isAiQuotaError(e)) {
        handleAiMutationError(e);
        return;
      }
      toast.error((e as Error).message);
    }
  };

  const appendToDraft = (value: string) => {
    setDraft((prev) => `${prev}${prev.trim() ? '\n' : ''}${value}`);
    setDraftFromAi(false);
    setDraftAiFlagged(false);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="bg-muted/20 flex min-h-0 flex-1 flex-col">
      <InboxMediaPreviewDialog
        attachment={previewAttachment}
        open={!!previewAttachment}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      />

      {conversation.property_slug ? (
        <BookingCalendarModal
          open={calendarModalOpen}
          onOpenChange={setCalendarModalOpen}
          propertySlug={conversation.property_slug}
          propertyName={conversation.property_name ?? ''}
          checkIn={calendarCheckIn}
          checkOut={calendarCheckOut}
          onDatesChange={(checkIn, checkOut) => {
            setCalendarCheckIn(checkIn);
            setCalendarCheckOut(checkOut);
          }}
        />
      ) : null}

      <div className="border-border bg-card flex shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-4">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] lg:hidden"
            onClick={onBack}
            aria-label="Back to list"
          >
            <ArrowLeft className="size-5" />
          </Button>
        )}
        <PlatformLogo platform={conversation.platform} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
            <span>{platformLabel(conversation.platform)}</span>
            {showOrgMetaBadge ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="bg-muted text-muted-foreground cursor-help rounded px-1.5 py-0.5 text-[10px] font-medium">
                      Org Meta
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[min(90vw,18rem)] text-xs">
                    This property has no Facebook Page of its own, so replies use the
                    organization&rsquo;s shared Meta connection — the same one every other property
                    without its own Page sees.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {isWeb && conversation.inquiry_check_in && conversation.inquiry_check_out ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {formatStayDateRange(
                    conversation.inquiry_check_in,
                    conversation.inquiry_check_out
                  )}
                </span>
              </>
            ) : null}
            {windowLabel && conversation.conversation_type === 'dm' && (
              <>
                <span aria-hidden>·</span>
                <span className={windowOpen ? undefined : 'text-destructive font-medium'}>
                  {windowLabel}
                </span>
              </>
            )}
          </div>
        </div>
        {conversation.linked_post_url && (
          <a
            href={conversation.linked_post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex min-h-[44px] shrink-0 items-center self-center px-1 text-xs font-medium underline-offset-2 hover:underline"
          >
            View conversation
          </a>
        )}
        {messages.length > 0 ? (
          <ChatThreadSearchTrigger
            active={threadSearch.open}
            onClick={() => (threadSearch.open ? threadSearch.close() : threadSearch.openSearch())}
          />
        ) : null}
      </div>

      {threadSearch.open ? (
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
          'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5',
          !isLoading && messages.length === 0 && !loadError && 'flex flex-col'
        )}
      >
        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading messages">
            {MESSAGE_SKELETON_ROWS.map((row, i) => (
              <InboxMessageBubbleSkeleton
                key={i}
                outbound={row.outbound}
                widthClass={row.widthClass}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {loadError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {loadError ?? 'Could not load messages.'}
                </p>
                {onRetryLoad ? (
                  <Button type="button" variant="outline" size="sm" onClick={onRetryLoad}>
                    <RefreshCw className="mr-1.5 size-4" aria-hidden />
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div ref={topSentinelRef} className="h-px w-full shrink-0" aria-hidden />
            {hasOlderMessages && onLoadOlder && (
              <div className="flex justify-center">
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
            )}
            {messages.length > 0 ? (
              <ChatMessageList
                messages={messages}
                focusedMessageId={threadSearch.activeMessageId}
                getOutbound={(msg) => msg.direction === 'outbound'}
                renderMessage={(msg) => {
                  const outbound = msg.direction === 'outbound';
                  const isUnsent = isChatMessageUnsent(msg);
                  const attachments = isUnsent ? [] : inboxAttachmentPreviews(msg.attachments);
                  const hasText = !!msg.body_text?.trim();
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
                    !isUnsent && outbound && canHostEditMessage(msg, messages) && !!onEdit;
                  const showUnsend =
                    !isUnsent && outbound && canHostUnsendMessage(msg, messages) && !!onUnsend;
                  const showMessageMenu = canReply && !channelDisconnected;
                  const deliveryStatus =
                    !isUnsent && outbound ? resolveOutboundDeliveryStatus(msg) : null;

                  const messageActions = showMessageMenu ? (
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
                  ) : null;

                  const bubble =
                    isUnsent || hasText || (!hasText && !hasMedia) ? (
                      <ChatMessageBubble
                        bodyText={
                          isUnsent
                            ? unsentMessageLabel(outbound)
                            : hasText
                              ? msg.body_text
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
                        actions={messageActions}
                        onCalendarLinkClick={
                          conversation.property_slug ? () => setCalendarModalOpen(true) : undefined
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
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="text-muted-foreground/50 mb-3 size-8" aria-hidden />
                <p className="text-muted-foreground text-sm">No messages yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {canReply && (
        <div className="border-border bg-card shrink-0 border-t p-3 sm:p-4">
          {isWeb && peerTyping ? (
            <p className="text-muted-foreground mb-2 px-1 text-xs" aria-live="polite">
              Guest is typing…
            </p>
          ) : null}
          {channelDisconnected ? (
            <p className="text-muted-foreground mb-2 px-1 text-xs" aria-live="polite">
              This channel is disconnected — reconnect Meta to reply.
            </p>
          ) : null}
          {canUseHumanAgentTag ? (
            <label className="mb-2 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <Checkbox
                checked={useHumanAgentTag}
                onCheckedChange={(checked) => setUseHumanAgentTag(checked === true)}
                className="mt-0.5"
                aria-label="Send as a support follow-up"
              />
              <span className="min-w-0 text-xs">
                <span className="text-foreground block font-medium">
                  Reply window closed — send as a support follow-up
                </span>
                <span className="text-muted-foreground mt-0.5 block">
                  Non-promotional only. This uses Meta&apos;s 7-day `HUMAN_AGENT` tag.
                </span>
              </span>
            </label>
          ) : null}
          <div
            className={cn(
              'border-border/80 bg-background overflow-hidden rounded-xl border shadow-sm transition-shadow',
              'focus-within:border-primary/40 focus-within:ring-primary/10 focus-within:ring-2'
            )}
          >
            {composerMode.kind === 'reply' ? (
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
            ) : null}
            {draftFromAi && draft.trim().length > 0 && composerMode.kind === 'compose' && (
              <div className="border-border/60 flex items-center gap-1.5 border-b px-3.5 py-2 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                {draftAiFlagged ? 'AI declined to answer' : 'Suggested by AI'}
              </div>
            )}
            {pendingAttachments.length > 0 ? (
              <div className="border-border/60 flex flex-wrap gap-1.5 border-b px-3.5 py-2">
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
            <Textarea
              ref={composerInputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftFromAi(false);
                setDraftAiFlagged(false);
                if (isWeb) signalTyping();
              }}
              placeholder={
                channelDisconnected
                  ? 'Reconnect Meta to reply'
                  : windowOpen || useHumanAgentTag
                    ? 'Write a reply…'
                    : 'Reply window closed'
              }
              className="min-h-[72px] resize-none border-0 bg-transparent px-3.5 py-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={
                channelDisconnected ||
                (composerMode.kind !== 'edit' &&
                  !windowOpen &&
                  !useHumanAgentTag &&
                  conversation.conversation_type === 'dm')
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) void handleSend();
                }
              }}
            />
            <div className="border-border/60 flex items-center justify-between gap-2 border-t px-2 py-1.5">
              <TooltipProvider delayDuration={300}>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  {isWeb && onUploadAttachment && composerMode.kind !== 'edit' ? (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={CHAT_ATTACHMENT_ACCEPT}
                        className="sr-only"
                        onChange={(e) => void handleFileChange(e)}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground size-10 min-h-[44px] min-w-[44px]"
                            disabled={
                              channelDisconnected ||
                              isBusy ||
                              pendingAttachments.length >= CHAT_MAX_ATTACHMENTS
                            }
                            aria-label="Attach file"
                            onClick={handlePickFile}
                          >
                            {uploadingAttachment ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <Paperclip className="size-4" aria-hidden />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Attach</TooltipContent>
                      </Tooltip>
                    </>
                  ) : null}
                  {visibleTemplates.length > 0 &&
                    (isMobileLayout ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground size-10"
                              disabled={channelDisconnected}
                              aria-label="Insert quick reply"
                              aria-haspopup="dialog"
                              aria-expanded={quickReplyOpen}
                              onClick={() => setQuickReplyOpen(true)}
                            >
                              <Zap className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Quick reply</TooltipContent>
                        </Tooltip>
                        <MobileChoiceSheet
                          open={quickReplyOpen}
                          onOpenChange={setQuickReplyOpen}
                          title="Quick reply"
                        >
                          <div role="listbox" aria-label="Quick reply">
                            {visibleTemplates.map((template) => (
                              <MobileChoiceItem
                                key={template.id}
                                label={template.title}
                                onSelect={() => {
                                  applyQuickReply(template);
                                  setQuickReplyOpen(false);
                                }}
                              />
                            ))}
                          </div>
                        </MobileChoiceSheet>
                      </>
                    ) : (
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground size-10"
                                disabled={channelDisconnected}
                                aria-label="Insert quick reply"
                              >
                                <Zap className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">Quick reply</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent
                          align="start"
                          className="z-[110] max-w-[min(90vw,320px)]"
                        >
                          {visibleTemplates.map((template) => (
                            <DropdownMenuItem
                              key={template.id}
                              onClick={() => applyQuickReply(template)}
                            >
                              <span className="font-medium">{template.title}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ))}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                        disabled={suggesting || channelDisconnected}
                        aria-label="Suggest reply"
                        onClick={() => void handleSuggest()}
                      >
                        {suggesting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggest</TooltipContent>
                  </Tooltip>
                  {conversation.property_slug ? (
                    <InboxInsertMenu
                      conversation={conversation}
                      propertySlug={conversation.property_slug}
                      propertyId={propertyId}
                      mapsUrl={mapsUrl}
                      checkInTime={checkInTime}
                      checkOutTime={checkOutTime}
                      templates={visibleTemplates}
                      pinnedSnippets={pinnedSnippets}
                      mergeSnippet={
                        quickReplyMergeContext
                          ? (text) => applyInboxQuickReplyMerge(text, quickReplyMergeContext)
                          : undefined
                      }
                      disabled={channelDisconnected}
                      onInsertUrl={appendToDraft}
                      onInsertText={appendToDraft}
                    />
                  ) : null}
                </div>
              </TooltipProvider>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 min-h-[36px] gap-1.5 rounded-lg px-3"
                  disabled={!canSend}
                  onClick={() => void handleSend()}
                >
                  {sending || editing || unsending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Send
                      <SendHorizontal className="size-4" aria-hidden />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
