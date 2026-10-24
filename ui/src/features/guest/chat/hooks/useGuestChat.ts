import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GUEST_MESSAGES_QUERY_KEY } from '@/features/guest/account/lib/guestAccountApi';
import {
  editGuestChatMessage,
  fetchGuestChatMessages,
  fetchGuestWebChatResume,
  markGuestChatRead,
  sendGuestChatMessage,
  submitGuestChatAiFeedback,
  unsendGuestChatMessage,
  uploadGuestChatAttachment,
  startGuestWebChat,
  type GuestChatAttachment,
  type GuestChatMessage,
  type GuestChatResumeResult,
  type GuestChatStartResult,
} from '@/features/guest/chat/lib/guestChatApi';

import {
  markDirectionMessagesDeliveredInCache,
  markDirectionMessagesReadInCache,
  patchGuestChatReplyStatusInCache,
  patchSocialMessageInInfiniteCache,
  type SocialMessageRealtimeRow,
} from '@/lib/chat/chatMessageCache';
import { normalizeChatReplyStatus, type ChatReplyStatus } from '@/lib/chat/chatReplyStatus';
import { useChatReadReceiptSync } from '@/lib/chat/useChatReadReceiptSync';
import { supabase } from '@/lib/supabase/client';

export const GUEST_CHAT_START_KEY = 'guest-chat-start';
export const GUEST_CHAT_RESUME_KEY = 'guest-chat-resume';
export const GUEST_CHAT_MESSAGES_KEY = 'guest-chat-messages';

type MessagesPage = {
  messages: GuestChatMessage[];
  hasMore: boolean;
  replyStatus?: ChatReplyStatus;
};

type MessagesInfiniteData = {
  pages: MessagesPage[];
  pageParams: unknown[];
};

export type GuestChatSendInput = {
  text: string;
  replyToMessageId?: string;
  attachments?: GuestChatAttachment[];
};

function messagesQueryKey(conversationId: string) {
  return [GUEST_CHAT_MESSAGES_KEY, conversationId] as const;
}

function appendOptimisticMessage(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: GuestChatMessage
) {
  const key = messagesQueryKey(conversationId);
  const prev = qc.getQueryData<MessagesInfiniteData>(key);
  if (!prev?.pages?.length) return;

  const lastIndex = prev.pages.length - 1;
  const lastPage = prev.pages[lastIndex];
  if (!lastPage) return;

  qc.setQueryData<MessagesInfiniteData>(key, {
    ...prev,
    pages: [
      ...prev.pages.slice(0, lastIndex),
      { ...lastPage, messages: [...lastPage.messages, message] },
    ],
  });
}

function patchOptimisticMessage(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
  messageId: string,
  patch: Partial<GuestChatMessage>
) {
  const key = messagesQueryKey(conversationId);
  const prev = qc.getQueryData<MessagesInfiniteData>(key);
  if (!prev?.pages?.length) return;

  qc.setQueryData<MessagesInfiniteData>(key, {
    ...prev,
    pages: prev.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message
      ),
    })),
  });
}

function removeMessageFromCache(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
  messageId: string
) {
  const key = messagesQueryKey(conversationId);
  const prev = qc.getQueryData<MessagesInfiniteData>(key);
  if (!prev?.pages?.length) return;

  qc.setQueryData<MessagesInfiniteData>(key, {
    ...prev,
    pages: prev.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== messageId),
    })),
  });
}

function normalizeSendInput(input: GuestChatSendInput | string): GuestChatSendInput {
  if (typeof input === 'string') return { text: input };
  return input;
}

export function useGuestChatResume(input: {
  propertySlug?: string;
  parkingSlug?: string;
  enabled: boolean;
}) {
  const slug = input.propertySlug?.trim() || input.parkingSlug?.trim() || '';
  return useQuery({
    queryKey: [GUEST_CHAT_RESUME_KEY, input.propertySlug ?? '', input.parkingSlug ?? ''],
    queryFn: () =>
      fetchGuestWebChatResume({
        propertySlug: input.propertySlug,
        parkingSlug: input.parkingSlug,
      }),
    enabled: input.enabled && !!slug,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useGuestChatStart(input: {
  propertySlug?: string;
  parkingSlug?: string;
  checkInDate: string;
  checkOutDate: string;
  enabled: boolean;
}) {
  const slug = input.propertySlug?.trim() || input.parkingSlug?.trim() || '';
  return useQuery({
    queryKey: [
      GUEST_CHAT_START_KEY,
      input.propertySlug ?? '',
      input.parkingSlug ?? '',
      input.checkInDate,
      input.checkOutDate,
    ],
    queryFn: () =>
      startGuestWebChat({
        propertySlug: input.propertySlug,
        parkingSlug: input.parkingSlug,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
      }),
    enabled: input.enabled && !!slug && !!input.checkInDate.trim() && !!input.checkOutDate.trim(),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useGuestChatMessages(conversationId: string | null) {
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: messagesQueryKey(conversationId ?? ''),
    queryFn: async ({ pageParam }) => {
      const result = await fetchGuestChatMessages(conversationId!, pageParam as string | undefined);
      return {
        messages: result.messages,
        hasMore: result.hasMore,
        replyStatus: pageParam ? undefined : result.replyStatus,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.messages.length > 0 ? last.messages[0]?.sent_at : undefined,
    enabled: !!conversationId,
  });

  const applyHostReadToCache = useCallback(
    (readAt: string) => {
      if (!conversationId) return;
      markDirectionMessagesReadInCache(qc, messagesQueryKey(conversationId), 'inbound', readAt);
    },
    [conversationId, qc]
  );

  const applyHostDeliveredToCache = useCallback(() => {
    if (!conversationId) return;
    markDirectionMessagesDeliveredInCache(qc, messagesQueryKey(conversationId), 'inbound');
  }, [conversationId, qc]);

  const { notifyPeerRead, notifyPeerDelivered } = useChatReadReceiptSync(
    conversationId,
    'guest',
    applyHostReadToCache,
    applyHostDeliveredToCache,
    !!conversationId
  );

  useGuestChatRealtime(conversationId, qc, notifyPeerDelivered);

  useEffect(() => {
    if (!conversationId || query.isLoading) return;
    void markGuestChatRead(conversationId).then(async () => {
      await notifyPeerRead();
      void qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY });
    });
  }, [conversationId, query.isLoading, qc, notifyPeerRead]);

  const [assistantTyping, setAssistantTyping] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<Record<string, 1 | -1>>({});
  const typingTimerRef = useRef<number | null>(null);

  const clearAssistantTyping = useCallback(() => {
    setAssistantTyping(false);
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const send = useMutation({
    mutationFn: (input: GuestChatSendInput | string) => {
      const { text, replyToMessageId, attachments } = normalizeSendInput(input);
      return sendGuestChatMessage(conversationId!, text, { replyToMessageId, attachments });
    },
    onMutate: async (input) => {
      if (!conversationId) return undefined;

      const { text, replyToMessageId, attachments } = normalizeSendInput(input);
      await qc.cancelQueries({ queryKey: messagesQueryKey(conversationId) });
      const prev = qc.getQueryData<MessagesInfiniteData>(messagesQueryKey(conversationId));
      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: GuestChatMessage = {
        id: optimisticId,
        conversation_id: conversationId,
        direction: 'inbound',
        body_text: text,
        attachments: attachments ?? [],
        sent_at: new Date().toISOString(),
        delivery_status: 'sending',
        is_ai_generated: false,
        reply_to_message_id: replyToMessageId ?? null,
      };

      appendOptimisticMessage(qc, conversationId, optimistic);
      patchGuestChatReplyStatusInCache(qc, messagesQueryKey(conversationId), 'pending');

      return { prev, optimisticId, text };
    },
    onError: (_error, _input, context) => {
      if (!conversationId || !context?.optimisticId) return;
      patchOptimisticMessage(qc, conversationId, context.optimisticId, {
        delivery_status: 'failed',
      });
    },
    onSuccess: (result) => {
      if (!conversationId) return;
      if (result.assistantWillReply) {
        setAssistantTyping(true);
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => setAssistantTyping(false), 12_000);
      }
      void qc.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      void qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY });
    },
  });

  const edit = useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) =>
      editGuestChatMessage(conversationId!, messageId, text),
    onSuccess: (message) => {
      if (!conversationId) return;
      patchOptimisticMessage(qc, conversationId, message.id, message);
      void qc.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      void qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY });
    },
  });

  const unsend = useMutation({
    mutationFn: (messageId: string) => unsendGuestChatMessage(conversationId!, messageId),
    onSuccess: (_, messageId) => {
      if (!conversationId) return;
      patchOptimisticMessage(qc, conversationId, messageId, {
        deleted_at: new Date().toISOString(),
        body_text: null,
        attachments: [],
        edited_at: null,
      });
      void qc.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      void qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY });
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => uploadGuestChatAttachment(conversationId!, file),
  });

  const retryFailedMessage = useCallback(
    (messageId: string, text: string) => {
      if (!conversationId || !text.trim()) return;
      removeMessageFromCache(qc, conversationId, messageId);
      send.mutate({ text: text.trim() });
    },
    [conversationId, qc, send]
  );

  const replyStatus = useMemo(() => {
    for (const page of query.data?.pages ?? []) {
      if (page.replyStatus) return normalizeChatReplyStatus(page.replyStatus);
    }
    return 'none' as ChatReplyStatus;
  }, [query.data]);

  const messages: GuestChatMessage[] = query.data?.pages.flatMap((page) => page.messages) ?? [];

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.direction === 'outbound' && last.is_ai_generated) {
      clearAssistantTyping();
    }
  }, [messages, clearAssistantTyping]);

  useEffect(() => () => clearAssistantTyping(), [clearAssistantTyping, conversationId]);

  const submitAiFeedback = useCallback(
    async (messageId: string, rating: 1 | -1) => {
      if (!conversationId) return;
      const prev = aiFeedback[messageId];
      const next = prev === rating ? 0 : rating;
      setAiFeedback((current) => {
        const copy = { ...current };
        if (next === 0) delete copy[messageId];
        else copy[messageId] = next;
        return copy;
      });
      try {
        await submitGuestChatAiFeedback({ conversationId, messageId, rating: next });
      } catch {
        setAiFeedback((current) => {
          const copy = { ...current };
          if (prev) copy[messageId] = prev;
          else delete copy[messageId];
          return copy;
        });
      }
    },
    [aiFeedback, conversationId]
  );

  return {
    ...query,
    messages,
    replyStatus,
    send,
    edit,
    unsend,
    uploadAttachment,
    retryFailedMessage,
    assistantTyping,
    aiFeedback,
    submitAiFeedback,
  };
}

function useGuestChatRealtime(
  conversationId: string | null,
  qc: ReturnType<typeof useQueryClient>,
  onPeerMessageReceived?: () => void
) {
  const onPeerMessageReceivedRef = useRef(onPeerMessageReceived);
  onPeerMessageReceivedRef.current = onPeerMessageReceived;

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async (accessToken: string) => {
      await supabase.realtime.setAuth(accessToken);

      const invalidate = () => {
        void qc.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
        void qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY });
      };

      const patchFromUpdate = (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as SocialMessageRealtimeRow;
        if (!row?.id || row.conversation_id !== conversationId) return;
        const patched = patchSocialMessageInInfiniteCache<GuestChatMessage>(
          qc,
          messagesQueryKey(conversationId),
          row
        );
        if (!patched) invalidate();
      };

      const applyHostReadFromConversation = (payload: {
        new: Record<string, unknown>;
        old: Record<string, unknown>;
      }) => {
        const row = payload.new as {
          host_last_read_at?: string | null;
          reply_status?: string | null;
        };
        const prev = payload.old as {
          host_last_read_at?: string | null;
          reply_status?: string | null;
        };
        const readAt = row.host_last_read_at?.trim();
        if (readAt && readAt !== prev.host_last_read_at) {
          markDirectionMessagesReadInCache(qc, messagesQueryKey(conversationId), 'inbound', readAt);
        }
        const nextStatus = row.reply_status?.trim();
        if (nextStatus && nextStatus !== prev.reply_status) {
          patchGuestChatReplyStatusInCache(
            qc,
            messagesQueryKey(conversationId),
            normalizeChatReplyStatus(nextStatus)
          );
          void qc.invalidateQueries({ queryKey: GUEST_MESSAGES_QUERY_KEY });
        }
      };

      channel = supabase
        .channel(`guest-chat-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'social_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as { direction?: string };
            if (row.direction === 'outbound') {
              patchGuestChatReplyStatusInCache(qc, messagesQueryKey(conversationId), 'replied');
              void onPeerMessageReceivedRef.current?.();
            } else if (row.direction === 'inbound') {
              patchGuestChatReplyStatusInCache(qc, messagesQueryKey(conversationId), 'pending');
            }
            invalidate();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'social_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          patchFromUpdate
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'social_conversations',
            filter: `id=eq.${conversationId}`,
          },
          applyHostReadFromConversation
        )
        .subscribe();
    };

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      await setup(token);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token || cancelled) return;
      void supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);
}

export type { GuestChatStartResult, GuestChatResumeResult, GuestChatMessage };
