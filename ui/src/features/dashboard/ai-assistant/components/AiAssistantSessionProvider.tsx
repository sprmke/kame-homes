import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';

import { useAiAssistantAccess } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantAccess';
import { useAiAssistantChat } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantChat';
import { useAiDashboardAssistantSettings } from '@/features/dashboard/ai-assistant/hooks/useAiDashboardAssistantSettings';
import type {
  ChatBlock,
  ConfirmActionResponse,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  AiAssistantSessionContext,
  type AiAssistantSessionValue,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import { resolveAssistantAiOffReason } from '@/features/dashboard/ai-assistant/lib/assistantAiOff';
import {
  EMPTY_ASSISTANT_DRAFT,
  assistantDraftKey,
  readActiveConversationId,
  readAssistantDraft,
  writeActiveConversationId,
  writeAssistantDraft,
  type AssistantDraft,
} from '@/features/dashboard/ai-assistant/lib/assistantDraftStore';
import { buildAssistantPageContext } from '@/features/dashboard/ai-assistant/lib/assistantPageContext';
import { CHAT_SEARCH_PARAM } from '@/features/dashboard/ai-assistant/lib/assistantScope';
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_QUESTIONS,
  SUGGESTION_VISIBLE_COUNT,
  pickRandomSuggestions,
} from '@/features/dashboard/ai-assistant/lib/assistantSuggestions';
import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import type { ChatSendInput } from '@/features/dashboard/ai-assistant/lib/chatAttachments';
import {
  dynamicFormValuesToLines,
  patchActionConfirmationStatus,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';
import { useDashboardMode } from '@/features/dashboard/ai-assistant/lib/dashboardModeContext';
import { selectContextualSuggestions } from '@/features/dashboard/ai-assistant/lib/moduleSuggestions';
import { BOOKING_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBooking';
import {
  useOrgScopeKey,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

/**
 * Owns the assistant session for one admin shell (AdminLayout). The sheet and the full-page
 * workspace both read it, so switching modes keeps the thread, draft, pins and any in-flight
 * stream. Tenant switches remount the shell; the active thread is restored from `?chat=` or
 * sessionStorage.
 */
export function AiAssistantSessionProvider({ children }: { children: ReactNode }) {
  const propertyId = usePropertyIdParam();
  const parkingId = useParkingIdParam();
  const { bookingId } = useParams<{ bookingId?: string }>();
  const { orgSlug, orgId } = useOrgScopeKey();
  const orgKey = orgSlug ?? orgId ?? '';
  const { mode } = useDashboardMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const { open: openUpgradeModal } = useUpgradeModal();
  const queryClient = useQueryClient();

  const pageContext = useMemo(
    () => buildAssistantPageContext({ propertyId, parkingId, bookingId }),
    [propertyId, parkingId, bookingId]
  );
  const chat = useAiAssistantChat(pageContext);
  const {
    conversationId,
    messages,
    sending,
    pending,
    cancelledDraft,
    consumeCancelledDraft,
    loadConversation,
    startNewConversation,
    sendMessage,
    submitDynamicForm,
    regenerateLastTurn,
    editAndResend,
    resolveAction,
  } = chat;

  const { accessible } = useAiAssistantAccess(propertyId);
  const readOnly = !accessible;
  const { data: assistantSettings } = useAiDashboardAssistantSettings({ includeUsage: true });
  const aiOffReason = resolveAssistantAiOffReason(assistantSettings?.aiBlocker, chat.aiBlocker);
  const usageLabel =
    assistantSettings?.usage != null
      ? `${assistantSettings.usage.todayMessageCount}/${assistantSettings.dailyMessageLimit}`
      : null;

  // ── Composer draft (per conversation, sessionStorage) ─────────────────────────────────────
  const draftKey = assistantDraftKey(orgKey, conversationId);
  const [draftState, setDraftState] = useState<{ key: string; draft: AssistantDraft }>(() => ({
    key: draftKey,
    draft: readAssistantDraft(draftKey),
  }));
  const draft = draftState.key === draftKey ? draftState.draft : EMPTY_ASSISTANT_DRAFT;

  useEffect(() => {
    setDraftState((prev) =>
      prev.key === draftKey ? prev : { key: draftKey, draft: readAssistantDraft(draftKey) }
    );
  }, [draftKey]);

  useEffect(() => {
    writeAssistantDraft(draftState.key, draftState.draft);
  }, [draftState]);

  const setDraftText = useCallback(
    (text: string) =>
      setDraftState((prev) => ({
        key: draftKey,
        draft: { ...(prev.key === draftKey ? prev.draft : EMPTY_ASSISTANT_DRAFT), text },
      })),
    [draftKey]
  );
  const setDraftContext = useCallback(
    (context: AttachedContextItem[]) =>
      setDraftState((prev) => ({
        key: draftKey,
        draft: { ...(prev.key === draftKey ? prev.draft : EMPTY_ASSISTANT_DRAFT), context },
      })),
    [draftKey]
  );

  // Stop before the turn was saved: put the text back so the host can edit and resend.
  useEffect(() => {
    if (!cancelledDraft) return;
    setDraftState((prev) => {
      const current = prev.key === draftKey ? prev.draft : EMPTY_ASSISTANT_DRAFT;
      if (current.text.trim()) return prev;
      return {
        key: draftKey,
        draft: { text: cancelledDraft.text, context: cancelledDraft.attachedContext },
      };
    });
    consumeCancelledDraft();
  }, [cancelledDraft, consumeCancelledDraft, draftKey]);

  const [composerKey, setComposerKey] = useState(0);
  const [suggestionNonce, setSuggestionNonce] = useState(0);
  const [canvasBlock, setCanvasBlock] = useState<ChatBlock | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // ── Suggestions (contextual to pins, else a random starter pool) ──────────────────────────
  const pinnedModuleTypes = useMemo(
    () => Array.from(new Set(draft.context.map((item) => item.type))),
    [draft.context]
  );
  const questions = useMemo(() => {
    const contextual = selectContextualSuggestions(
      pinnedModuleTypes,
      'question',
      SUGGESTION_VISIBLE_COUNT
    );
    return contextual.length > 0
      ? contextual
      : pickRandomSuggestions(ASSISTANT_QUESTIONS, SUGGESTION_VISIBLE_COUNT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nonce reshuffles the random pool
  }, [pinnedModuleTypes, suggestionNonce]);
  const actions = useMemo(() => {
    const contextual = selectContextualSuggestions(
      pinnedModuleTypes,
      'action',
      SUGGESTION_VISIBLE_COUNT
    );
    return contextual.length > 0
      ? contextual
      : pickRandomSuggestions(ASSISTANT_ACTIONS, SUGGESTION_VISIBLE_COUNT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nonce reshuffles the random pool
  }, [pinnedModuleTypes, suggestionNonce]);

  // ── Thread restore + `?chat=` sync ────────────────────────────────────────────────────────
  const chatParam = searchParams.get(CHAT_SEARCH_PARAM);
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !orgKey) return;
    restoredRef.current = true;
    const initial = chatParam ?? readActiveConversationId(orgKey);
    if (initial) void loadConversation(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, [orgKey]);

  useEffect(() => {
    if (orgKey) writeActiveConversationId(orgKey, conversationId);
  }, [orgKey, conversationId]);

  // URL → state: Back / a shared link points at another thread.
  const lastChatParamRef = useRef(chatParam);
  useEffect(() => {
    if (chatParam === lastChatParamRef.current) return;
    lastChatParamRef.current = chatParam;
    if (!restoredRef.current || sending) return;
    if (chatParam && chatParam !== conversationId) void loadConversation(chatParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to URL changes only
  }, [chatParam]);

  // State → URL (AI mode only; Advanced mode keeps URLs clean).
  useEffect(() => {
    if (mode !== 'ai') return;
    if ((chatParam ?? null) === conversationId) return;
    lastChatParamRef.current = conversationId;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (conversationId) next.set(CHAT_SEARCH_PARAM, conversationId);
        else next.delete(CHAT_SEARCH_PARAM);
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chatParam read, not tracked
  }, [mode, conversationId]);

  // ── Actions (every one respects the plan gate the same way) ───────────────────────────────
  const blocked = useCallback(() => {
    if (!readOnly) return false;
    openUpgradeModal('aiDashboardAssistant');
    return true;
  }, [readOnly, openUpgradeModal]);

  const lastUserContext = useCallback(
    () => [...messages].reverse().find((message) => message.role === 'user')?.attachedContext,
    [messages]
  );

  const send = useCallback(
    (input: ChatSendInput) => {
      if (blocked() || sending || pending) return;
      setDraftState({ key: draftKey, draft: { ...EMPTY_ASSISTANT_DRAFT, context: draft.context } });
      setEditingMessageId(null);
      void sendMessage(input);
    },
    [blocked, sending, pending, draftKey, draft.context, sendMessage]
  );

  const pickSuggestion = useCallback(
    (prompt: string, attachedContext?: AttachedContextItem[]) => {
      if (blocked() || sending || pending) return;
      void sendMessage({ text: prompt, attachedContext: attachedContext ?? draft.context });
    },
    [blocked, sending, pending, sendMessage, draft.context]
  );

  const runQuickAction = useCallback(
    (action: { label: string; prompt: string }) => {
      if (blocked() || sending || pending) return;
      void sendMessage({
        // Model guidance stays host-readable (no tool names). Bubble + History store the chip label.
        text: action.prompt,
        displayText: action.label,
        attachedContext: draft.context.length > 0 ? draft.context : lastUserContext(),
      });
    },
    [blocked, sending, pending, sendMessage, draft.context, lastUserContext]
  );

  const submitForm = useCallback(
    (block: Extract<ChatBlock, { type: 'dynamic_form' }>, values: Record<string, string>) => {
      if (blocked() || sending || pending) return;
      const lines = dynamicFormValuesToLines(block.fields, values);
      void submitDynamicForm(block.formId, values, {
        text:
          lines.length > 0
            ? `Here are the details you asked for:\n${lines.join('\n')}`
            : 'Submitted.',
        displayText: lines.join('\n') || block.title || 'Submitted',
        attachedContext: draft.context.length > 0 ? draft.context : lastUserContext(),
      });
    },
    [blocked, sending, pending, submitDynamicForm, draft.context, lastUserContext]
  );

  const regenerate = useCallback(() => {
    if (blocked()) return;
    void regenerateLastTurn();
  }, [blocked, regenerateLastTurn]);

  const submitEdit = useCallback(
    (messageId: string, text: string) => {
      if (blocked()) return;
      setEditingMessageId(null);
      void editAndResend(messageId, text);
    },
    [blocked, editAndResend]
  );

  const editLastMessage = useCallback(() => {
    if (sending || pending || readOnly) return false;
    const last = [...messages]
      .reverse()
      .find((message) => message.role === 'user' && message.persisted);
    if (!last || last.attachments?.length) return false;
    setEditingMessageId(last.id);
    return true;
  }, [messages, pending, readOnly, sending]);

  const confirmAction = useCallback(
    async (actionId: string, confirm: boolean): Promise<ConfirmActionResponse | null> => {
      const result = await resolveAction(actionId, confirm);
      if (result?.status === 'executed') {
        // Live booking cards (and any open booking page) pick up the change.
        void queryClient.invalidateQueries({ queryKey: BOOKING_QUERY_KEY('').slice(0, 1) });
      }
      if (result && result.status !== 'pending') {
        const nextStatus = result.status;
        setCanvasBlock((current) =>
          current
            ? (patchActionConfirmationStatus(
                [current],
                actionId,
                nextStatus,
                result.ok === false ? result.error : undefined,
                result.ok !== false ? result.resultNote : undefined
              )[0] ?? current)
            : current
        );
      }
      return result;
    },
    [queryClient, resolveAction]
  );

  const resetSurfaceState = useCallback(() => {
    setComposerKey((n) => n + 1);
    setSuggestionNonce((n) => n + 1);
    setCanvasBlock(null);
    setEditingMessageId(null);
  }, []);

  const newChat = useCallback(() => {
    if (blocked()) return;
    startNewConversation();
    resetSurfaceState();
  }, [blocked, startNewConversation, resetSurfaceState]);

  const selectConversation = useCallback(
    (id: string) => {
      void loadConversation(id);
      resetSurfaceState();
    },
    [loadConversation, resetSurfaceState]
  );

  const onConversationDeleted = useCallback(
    (id: string) => {
      if (id !== conversationId) return;
      startNewConversation();
      resetSurfaceState();
    },
    [conversationId, startNewConversation, resetSurfaceState]
  );

  const value = useMemo<AiAssistantSessionValue>(
    () => ({
      ...chat,
      pageContext,
      readOnly,
      aiOffReason,
      usageLabel,
      draft,
      setDraftText,
      setDraftContext,
      composerKey,
      questions,
      actions,
      canvasBlock,
      setCanvasBlock,
      editingMessageId,
      setEditingMessageId,
      editLastMessage,
      send,
      pickSuggestion,
      runQuickAction,
      submitForm,
      regenerate,
      submitEdit,
      confirmAction,
      newChat,
      selectConversation,
      onConversationDeleted,
    }),
    [
      chat,
      pageContext,
      readOnly,
      aiOffReason,
      usageLabel,
      draft,
      setDraftText,
      setDraftContext,
      composerKey,
      questions,
      actions,
      canvasBlock,
      editingMessageId,
      editLastMessage,
      send,
      pickSuggestion,
      runQuickAction,
      submitForm,
      regenerate,
      submitEdit,
      confirmAction,
      newChat,
      selectConversation,
      onConversationDeleted,
    ]
  );

  return (
    <AiAssistantSessionContext.Provider value={value}>
      {children}
    </AiAssistantSessionContext.Provider>
  );
}
