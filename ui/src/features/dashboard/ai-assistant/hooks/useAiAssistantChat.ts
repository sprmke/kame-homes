import { useCallback, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { aiAssistantConversationsQueryKey } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantConversations';
import {
  confirmAssistantAction,
  fetchAiAssistantConversationMessages,
  sendAssistantFeedback,
  type AiAssistantConversationSummary,
  type AiAssistantMessageRow,
  type AssistantFeedbackRating,
  type ChatAttachmentMeta,
  type ChatBlock,
  type PageContext,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import type { AssistantAiBlocker } from '@/features/dashboard/ai-assistant/lib/assistantAiOff';
import {
  aiBlockerFromError,
  buildTurnProgressFromStreamEvent,
  humanizeAssistantStreamError,
  isAbortError,
  isInterruptedStreamError,
  streamChatMessage,
  AssistantStreamAbortedError,
  AssistantStreamInterruptedError,
  type AssistantAppliedEffect,
  type AssistantStreamEvent,
  type StreamChatMessageResult,
  type TurnProgressLiveState,
} from '@/features/dashboard/ai-assistant/lib/assistantStream';
import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import type { ChatSendInput } from '@/features/dashboard/ai-assistant/lib/chatAttachments';
import {
  hostFacingUserMessageText,
  patchActionConfirmationStatus,
  patchDynamicFormStatus,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';
import { useOrgScopeKey, useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';

export type ChatThreadMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string | null;
  blocks: ChatBlock[];
  attachments?: ChatAttachmentMeta[];
  attachedContext?: AttachedContextItem[];
  /** True once `id` is the persisted row id (feedback, edit, copy link). */
  persisted?: boolean;
};

/** Text + pins of a turn the host stopped before it was saved — offered back to the composer. */
export type CancelledDraft = { text: string; attachedContext: AttachedContextItem[] };

/** Last turn that errored; `started` means the server already saved the user message. */
type FailedTurn = { payload: ChatSendInput; started: boolean; localUserId?: string };

const settingsQueryPrefix = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'ai-dashboard-assistant-settings'] as const;
const accessQueryPrefix = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'ai-dashboard-assistant-access'] as const;

function rowsToThread(rows: AiAssistantMessageRow[]): ChatThreadMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    text: row.role === 'user' ? hostFacingUserMessageText(row.content_text) : row.content_text,
    blocks: row.blocks,
    attachments: row.attachments,
    persisted: true,
  }));
}

export function useAiAssistantChat(pageContext: PageContext) {
  const orgSlug = useOrgSlugParam();
  const { orgId } = useOrgScopeKey();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<AiAssistantConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [feedback, setFeedbackState] = useState<Record<string, AssistantFeedbackRating>>({});
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStartedAtMs, setSendStartedAtMs] = useState<number | null>(null);
  const [turnProgress, setTurnProgress] = useState<TurnProgressLiveState | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [partialCancelEffects, setPartialCancelEffects] = useState<AssistantAppliedEffect[] | null>(
    null
  );
  const [upgradeHook, setUpgradeHook] = useState(false);
  /** AI switch the last turn hit. Org / property blocks show the Settings card instead of an error. */
  const [aiBlocker, setAiBlocker] = useState<AssistantAiBlocker | null>(null);
  const [cancelledDraft, setCancelledDraft] = useState<CancelledDraft | null>(null);
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);

  const invalidateUsage = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: settingsQueryPrefix(orgSlug, orgId) });
  }, [queryClient, orgSlug, orgId]);

  const handleAiBlocked = useCallback(
    (blocker: AssistantAiBlocker) => {
      setAiBlocker(blocker);
      void queryClient.invalidateQueries({ queryKey: settingsQueryPrefix(orgSlug, orgId) });
      void queryClient.invalidateQueries({ queryKey: accessQueryPrefix(orgSlug, orgId) });
    },
    [queryClient, orgSlug, orgId]
  );

  const invalidateConversations = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: aiAssistantConversationsQueryKey(orgSlug, orgId),
    });
  }, [queryClient, orgSlug, orgId]);

  const resetTurnState = useCallback(() => {
    setSending(false);
    setSendStartedAtMs(null);
    setTurnProgress(null);
    setStreamingText('');
  }, []);

  const loadConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      abortRef.current = null;
      resetTurnState();
      setPending(true);
      setError(null);
      setCancelledDraft(null);
      setFailedTurn(null);
      setPartialCancelEffects(null);
      try {
        const res = await fetchAiAssistantConversationMessages(id);
        setConversationId(id);
        setConversation(res.conversation);
        setMessages(rowsToThread(res.messages));
        setFeedbackState(res.feedback ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setPending(false);
      }
    },
    [resetTurnState]
  );

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConversationId(null);
    setConversation(null);
    setMessages([]);
    setFeedbackState({});
    setError(null);
    setUpgradeHook(false);
    resetTurnState();
    setPartialCancelEffects(null);
    setCancelledDraft(null);
    setFailedTurn(null);
    setPending(false);
  }, [resetTurnState]);

  const cancelTurn = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runTurn = useCallback(
    async (
      payload: ChatSendInput,
      options?: {
        skipUserBubble?: boolean;
        regenerate?: boolean;
        editMessageId?: string;
      }
    ) => {
      const text = (payload.text ?? '').trim();
      const displayText = (payload.displayText ?? text).trim();
      const attachments = payload.attachments ?? [];
      if (!orgSlug || (!text && attachments.length === 0)) return;
      if (options?.regenerate && !conversationId) return;

      setPending(true);
      setSending(true);
      setSendStartedAtMs(Date.now());
      setTurnProgress(null);
      setStreamingText('');
      setError(null);
      setPartialCancelEffects(null);
      setUpgradeHook(false);
      setAiBlocker(null);
      setCancelledDraft(null);
      setFailedTurn(null);
      let turnStarted = false;

      const attachedContext = payload.attachedContext ?? [];
      let localUserId: string | undefined;
      if (!options?.skipUserBubble) {
        localUserId = `local-${Date.now()}`;
        const userMessage: ChatThreadMessage = {
          id: localUserId,
          role: 'user',
          text: displayText || null,
          blocks: displayText ? [{ type: 'text', text: displayText }] : [],
          attachments: attachments.map(({ name, mimeType }) => ({ name, mimeType })),
          attachedContext: attachedContext.length > 0 ? attachedContext : undefined,
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const applySuccessfulTurn = (res: StreamChatMessageResult) => {
        const isNewConversation = res.conversationId !== conversationId;
        setConversationId(res.conversationId);
        setUpgradeHook(Boolean(res.upgradeHook));
        setMessages((prev) => [
          ...prev.map((msg) =>
            msg.id === localUserId && res.userMessageId
              ? { ...msg, id: res.userMessageId, persisted: true }
              : msg
          ),
          {
            id: res.messageId ?? `assistant-${Date.now()}`,
            role: 'assistant',
            text: null,
            blocks: res.blocks,
            persisted: Boolean(res.messageId),
          },
        ]);
        invalidateUsage();
        // New threads get a title server-side; recency order changes on every turn.
        invalidateConversations();
        if (isNewConversation) setConversation(null);
      };

      const streamHandlers = {
        signal: controller.signal,
        onEvent: (event: AssistantStreamEvent) => {
          if (event.type === 'turn_started' && event.conversationId) {
            turnStarted = true;
            setConversationId(event.conversationId);
            return;
          }
          if (event.type === 'text_start') {
            setStreamingText('');
            return;
          }
          if (event.type === 'text_chunk') {
            setStreamingText((prev) => prev + event.delta);
            return;
          }
          setTurnProgress((prev) => buildTurnProgressFromStreamEvent(prev, event));
        },
      };

      try {
        const res = await streamChatMessage(
          {
            orgSlug,
            conversationId,
            pageContext,
            attachedContext: attachedContext.length > 0 ? attachedContext : undefined,
            message: text,
            displayMessage: displayText || undefined,
            attachments: attachments.length > 0 ? attachments : undefined,
            regenerate: options?.regenerate === true,
            editMessageId: options?.editMessageId,
          },
          streamHandlers
        );
        applySuccessfulTurn(res);
      } catch (err) {
        if (isAbortError(err)) {
          const appliedEffects =
            err instanceof AssistantStreamAbortedError ? (err.appliedEffects ?? []) : [];
          if (appliedEffects.length > 0) setPartialCancelEffects(appliedEffects);
          // Nothing was applied: the server dropped the user row, so hand the text back.
          if (appliedEffects.length === 0 && !options?.regenerate && displayText) {
            setCancelledDraft({ text: displayText, attachedContext });
          }
          const reloadId =
            conversationId ??
            (err instanceof AssistantStreamInterruptedError ? err.conversationId : null);
          if (reloadId) {
            try {
              const res = await fetchAiAssistantConversationMessages(reloadId);
              setMessages(rowsToThread(res.messages));
              setFeedbackState(res.feedback ?? {});
            } catch {
              if (localUserId) {
                setMessages((prev) => prev.filter((msg) => msg.id !== localUserId));
              }
            }
          } else if (localUserId) {
            setMessages((prev) => prev.filter((msg) => msg.id !== localUserId));
          }
          return;
        }

        // Local `functions serve` hot-reload (and similar) cuts SSE mid-flight —
        // recover once via regenerate so the host doesn't see a raw "network error".
        const retryConversationId =
          (err instanceof AssistantStreamInterruptedError ? err.conversationId : null) ||
          conversationId;
        const canAutoRetry =
          isInterruptedStreamError(err) &&
          Boolean(retryConversationId) &&
          options?.regenerate !== true &&
          attachments.length === 0 &&
          !controller.signal.aborted;

        if (canAutoRetry && retryConversationId) {
          try {
            setTurnProgress(null);
            setStreamingText('');
            // Brief pause so local functions serve can finish hot-reloading.
            await new Promise<void>((resolve) => setTimeout(resolve, 1200));
            if (controller.signal.aborted) return;
            const retry = await streamChatMessage(
              {
                orgSlug,
                conversationId: retryConversationId,
                pageContext,
                attachedContext: attachedContext.length > 0 ? attachedContext : undefined,
                message: text,
                regenerate: true,
              },
              streamHandlers
            );
            applySuccessfulTurn(retry);
            return;
          } catch (retryErr) {
            if (isAbortError(retryErr)) return;
            setFailedTurn({ payload, started: true, localUserId });
            const retryBlocker = aiBlockerFromError(retryErr);
            if (retryBlocker) handleAiBlocked(retryBlocker);
            if (retryBlocker && retryBlocker !== 'platform') return;
            setError(humanizeAssistantStreamError(retryErr));
            if (retryErr instanceof Error && 'upgradeHook' in retryErr && retryErr.upgradeHook) {
              setUpgradeHook(true);
            }
            return;
          }
        }

        const isUpgradeHook = err instanceof Error && 'upgradeHook' in err && err.upgradeHook;
        if (!isUpgradeHook && !options?.regenerate && !options?.editMessageId) {
          setFailedTurn({ payload, started: turnStarted, localUserId });
        }
        const blocker = aiBlockerFromError(err);
        if (blocker) handleAiBlocked(blocker);
        if (blocker && blocker !== 'platform') return;
        setError(humanizeAssistantStreamError(err));
        if (isUpgradeHook) setUpgradeHook(true);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        resetTurnState();
        setPending(false);
      }
    },
    [
      orgSlug,
      conversationId,
      pageContext,
      invalidateUsage,
      invalidateConversations,
      resetTurnState,
      handleAiBlocked,
    ]
  );

  const sendMessage = useCallback(
    async (input: string | ChatSendInput) => {
      const payload: ChatSendInput = typeof input === 'string' ? { text: input } : input;
      await runTurn(payload);
    },
    [runTurn]
  );

  /** Marks an in-thread dynamic_form as submitted (read-only recap), then sends the filled values as the next turn. */
  const submitDynamicForm = useCallback(
    async (formId: string, values: Record<string, string>, payload: ChatSendInput) => {
      setMessages((prev) =>
        prev.map((msg) => ({ ...msg, blocks: patchDynamicFormStatus(msg.blocks, formId, values) }))
      );
      await runTurn(payload);
    },
    [runTurn]
  );

  const regenerateLastTurn = useCallback(async () => {
    if (sending || pending) return;
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex < 0) return;
    const userMsg = messages[lastUserIndex];
    if (userMsg.attachments?.length) {
      setError('Regenerate is not available for messages with attachments.');
      return;
    }
    if (!(userMsg.text ?? '').trim()) {
      setError('Regenerate is not available for empty messages.');
      return;
    }
    setMessages((prev) => prev.slice(0, lastUserIndex + 1));
    await runTurn(
      {
        text: userMsg.text ?? '',
        attachedContext: userMsg.attachedContext,
      },
      { skipUserBubble: true, regenerate: true }
    );
  }, [messages, runTurn, sending, pending]);

  /** Edit & resend: drop `messageId` and everything after it, then send the new text. */
  const editAndResend = useCallback(
    async (messageId: string, nextText: string) => {
      if (sending || pending) return;
      const index = messages.findIndex((msg) => msg.id === messageId);
      const target = messages[index];
      if (index < 0 || !target || target.role !== 'user' || !target.persisted) return;
      if (!nextText.trim()) return;
      setMessages((prev) => prev.slice(0, index));
      await runTurn(
        { text: nextText, attachedContext: target.attachedContext },
        { editMessageId: messageId }
      );
    },
    [messages, pending, runTurn, sending]
  );

  const resolveAction = useCallback(async (actionId: string, confirm: boolean) => {
    setPending(true);
    try {
      const result = await confirmAssistantAction({ actionId, confirm });
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          blocks:
            result.status === 'pending'
              ? msg.blocks
              : patchActionConfirmationStatus(
                  msg.blocks,
                  actionId,
                  result.status,
                  result.ok === false ? result.error : undefined,
                  result.ok !== false ? result.resultNote : undefined
                ),
        }))
      );
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve action');
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  /** Thumbs up / down; tapping the active rating again clears it. Optimistic with rollback. */
  const rateMessage = useCallback(
    async (messageId: string, rating: AssistantFeedbackRating) => {
      const previous = feedback[messageId];
      const next = previous === rating ? 0 : rating;
      setFeedbackState((prev) => {
        const copy = { ...prev };
        if (next === 0) delete copy[messageId];
        else copy[messageId] = next;
        return copy;
      });
      try {
        await sendAssistantFeedback({ messageId, rating: next });
      } catch {
        setFeedbackState((prev) => {
          const copy = { ...prev };
          if (previous) copy[messageId] = previous;
          else delete copy[messageId];
          return copy;
        });
        throw new Error('Could not save feedback');
      }
    },
    [feedback]
  );

  const consumeCancelledDraft = useCallback(() => setCancelledDraft(null), []);

  /** Retry after an error: regenerate when the user row was saved, else resend it fresh. */
  const retryFailedTurn = useCallback(async () => {
    if (!failedTurn || sending || pending) return;
    const { payload, started, localUserId } = failedTurn;
    setFailedTurn(null);
    if (started && conversationId) {
      setMessages((prev) => {
        const index = prev.findIndex((msg) => msg.id === localUserId);
        return index >= 0 ? prev.slice(0, index + 1) : prev;
      });
      await runTurn(payload, { skipUserBubble: true, regenerate: true });
      return;
    }
    setMessages((prev) => prev.filter((msg) => msg.id !== localUserId));
    await runTurn(payload);
  }, [conversationId, failedTurn, pending, runTurn, sending]);

  const canRegenerate = (() => {
    if (sending || pending || messages.length < 2) return false;
    if (messages[messages.length - 1]?.role !== 'assistant') return false;
    for (let i = messages.length - 2; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') {
        return !messages[i].attachments?.length && Boolean((messages[i].text ?? '').trim());
      }
    }
    return false;
  })();

  return {
    conversationId,
    conversation,
    messages,
    feedback,
    pending,
    sending,
    sendStartedAtMs,
    turnProgress,
    streamingText,
    error,
    partialCancelEffects,
    upgradeHook,
    aiBlocker,
    canRegenerate,
    cancelledDraft,
    canRetry: failedTurn != null && !sending && !pending,
    retryFailedTurn,
    sendMessage,
    submitDynamicForm,
    cancelTurn,
    regenerateLastTurn,
    editAndResend,
    resolveAction,
    rateMessage,
    loadConversation,
    startNewConversation,
    consumeCancelledDraft,
  };
}

export type AiAssistantChatState = ReturnType<typeof useAiAssistantChat>;
