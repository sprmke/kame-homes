import { useEffect, useRef, useState, type ReactNode } from 'react';

import { motion } from 'framer-motion';

import { AssistantMessageCard } from '@/features/dashboard/ai-assistant/components/AssistantMessageCard';
import { AssistantSuggestionGroups } from '@/features/dashboard/ai-assistant/components/AssistantSuggestionGroups';
import { AssistantTurnProgress } from '@/features/dashboard/ai-assistant/components/AssistantTurnProgress';
import { TextBlock } from '@/features/dashboard/ai-assistant/components/blocks/TextBlock';
import { ChatMessageActions } from '@/features/dashboard/ai-assistant/components/ChatMessageActions';
import { UserMessageBubble } from '@/features/dashboard/ai-assistant/components/UserMessageBubble';
import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import {
  MESSAGE_ENTRANCE_RISE_PX,
  assistantMicro,
  messageEntranceDelay,
} from '@/features/dashboard/ai-assistant/lib/assistantMotion';
import { useAssistantSurface } from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import { assistantBubbleWidthClass } from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';
import { assistantBlocksToPlainText } from '@/features/dashboard/ai-assistant/lib/messagePlainText';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type Props = {
  /** Replaces the starter suggestions on an empty thread (AI mode briefing home). */
  emptyState?: ReactNode;
  className?: string;
};

/**
 * Shared message list for both assistant surfaces. Reads the session directly so behavior is
 * identical in the sheet and the full page; `surface` only changes density and width.
 */
export function ChatThread({ emptyState, className }: Props) {
  const session = useAiAssistantSession();
  const {
    conversationId,
    messages,
    pending,
    sending,
    sendStartedAtMs,
    turnProgress,
    streamingText,
    canRegenerate,
    feedback,
    readOnly,
    editingMessageId,
    questions,
    actions,
    regenerate,
    confirmAction,
    runQuickAction,
    setCanvasBlock,
    submitForm,
    pickSuggestion,
    rateMessage,
    setEditingMessageId,
    submitEdit,
  } = session;
  const { surface } = useAssistantSurface();
  const reducedMotion = usePrefersReducedMotion();
  const bottomRef = useRef<HTMLDivElement>(null);
  const full = surface === 'full';

  // Only messages that arrive after a thread is shown animate; loaded history appears at once.
  const seenIdsRef = useRef<{ conversationId: string | null; ids: Set<string> }>({
    conversationId,
    ids: new Set(messages.map((message) => message.id)),
  });
  if (seenIdsRef.current.conversationId !== conversationId && !sending) {
    seenIdsRef.current = { conversationId, ids: new Set(messages.map((message) => message.id)) };
  }
  const newIds = messages
    .map((message) => message.id)
    .filter((id) => !seenIdsRef.current.ids.has(id));
  useEffect(() => {
    for (const message of messages) seenIdsRef.current.ids.add(message.id);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages.length, sending, turnProgress?.steps.length, streamingText.length, reducedMotion]);

  // Screen readers hear the finished answer once, not every streamed chunk.
  const [announcement, setAnnouncement] = useState('');
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const lastAssistantId = lastAssistant?.id;
  useEffect(() => {
    if (sending || !lastAssistant || !newIds.includes(lastAssistant.id)) return;
    setAnnouncement(assistantBlocksToPlainText(lastAssistant.blocks).slice(0, 600));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce once per new reply
  }, [lastAssistantId, sending]);

  const lastMessageIndex = messages.length - 1;
  const busy = sending || pending;

  if (messages.length === 0 && !sending) {
    return (
      emptyState ?? (
        <AssistantSuggestionGroups
          questions={questions}
          actions={actions}
          onPick={(prompt) => pickSuggestion(prompt)}
          disabled={pending}
        />
      )
    );
  }

  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      aria-busy={sending}
      data-testid="assistant-thread"
    >
      <div
        className={cn('space-y-4', full ? 'mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6' : 'p-3')}
      >
        {messages.map((message, index) => {
          const newIndex = newIds.indexOf(message.id);
          const animate = newIndex >= 0 && !reducedMotion;
          const isUser = message.role === 'user';
          return (
            <motion.div
              key={message.id}
              initial={animate ? { opacity: 0, y: MESSAGE_ENTRANCE_RISE_PX } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...assistantMicro.enter,
                delay: animate ? messageEntranceDelay(newIndex, newIds.length) : 0,
              }}
              className={isUser ? 'flex justify-end' : 'flex justify-start'}
            >
              {isUser ? (
                <UserMessageBubble
                  message={message}
                  surface={surface}
                  canEdit={
                    !readOnly &&
                    !busy &&
                    Boolean(message.persisted) &&
                    !message.attachments?.length &&
                    Boolean(message.text?.trim())
                  }
                  editing={editingMessageId === message.id}
                  onStartEdit={() => setEditingMessageId(message.id)}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onSubmitEdit={(text) => submitEdit(message.id, text)}
                />
              ) : (
                <div
                  className={cn(
                    'group min-w-0',
                    full ? 'w-full' : assistantBubbleWidthClass(message.blocks)
                  )}
                >
                  <AssistantMessageCard
                    blocks={message.blocks}
                    unboxed={full}
                    onResolveAction={confirmAction}
                    onRunQuickAction={runQuickAction}
                    quickActionsDisabled={busy}
                    onOpenCanvas={setCanvasBlock}
                    onSubmitForm={submitForm}
                  />
                  <ChatMessageActions
                    copyText={assistantBlocksToPlainText(message.blocks)}
                    messageId={message.persisted ? message.id : null}
                    rating={feedback[message.id]}
                    onRate={rateMessage}
                    onRegenerate={
                      canRegenerate && index === lastMessageIndex ? regenerate : undefined
                    }
                    disabled={busy}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
        {sending ? (
          streamingText ? (
            <div className="flex justify-start">
              <div
                className={cn(
                  full
                    ? 'w-full'
                    : 'border-border/60 bg-card w-full max-w-[92%] rounded-2xl rounded-bl-md border p-3 shadow-sm'
                )}
              >
                <TextBlock text={streamingText} />
                <span
                  className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse align-text-bottom motion-reduce:animate-none"
                  aria-hidden
                />
              </div>
            </div>
          ) : (
            <AssistantTurnProgress live={turnProgress} startedAtMs={sendStartedAtMs ?? undefined} />
          )
        ) : null}
        <div ref={bottomRef} />
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
