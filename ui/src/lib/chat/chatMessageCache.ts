import type { ChatReplyStatus } from '@/lib/chat/chatReplyStatus';

import type { InfiniteData, QueryClient } from '@tanstack/react-query';

export type SocialMessageRealtimeRow = {
  id: string;
  conversation_id: string;
  read_at?: string | null;
  delivery_status?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  body_text?: string | null;
  attachments?: unknown;
};

type MessagesPage<T> = { messages: T[]; hasMore: boolean };

function patchFieldsFromRow(row: SocialMessageRealtimeRow): Partial<SocialMessageRealtimeRow> {
  return {
    read_at: row.read_at ?? null,
    delivery_status: row.delivery_status ?? null,
    edited_at: row.edited_at ?? null,
    deleted_at: row.deleted_at ?? null,
    body_text: row.body_text ?? null,
    attachments: row.attachments,
  };
}

/** Patch one message row inside a TanStack infinite messages cache. */
export function patchSocialMessageInInfiniteCache<T extends { id: string }>(
  qc: QueryClient,
  queryKey: readonly unknown[],
  row: SocialMessageRealtimeRow
): boolean {
  let patched = false;

  qc.setQueryData<InfiniteData<MessagesPage<T>>>(queryKey, (prev) => {
    if (!prev?.pages?.length) return prev;

    let touched = false;
    const pages = prev.pages.map((page) => {
      const messages = page.messages.map((message) => {
        if (message.id !== row.id) return message;
        touched = true;
        return { ...message, ...patchFieldsFromRow(row) };
      });
      return touched ? { ...page, messages } : page;
    });

    if (!touched) return prev;
    patched = true;
    return { ...prev, pages };
  });

  return patched;
}

type MessagesPageWithMeta<T> = { messages: T[]; hasMore: boolean; replyStatus?: ChatReplyStatus };

/** Patch conversation reply_status on the newest messages page in cache. */
export function patchGuestChatReplyStatusInCache<T>(
  qc: QueryClient,
  queryKey: readonly unknown[],
  replyStatus: ChatReplyStatus
): void {
  qc.setQueryData<InfiniteData<MessagesPageWithMeta<T>>>(queryKey, (prev) => {
    if (!prev?.pages?.length) return prev;

    const pages = [...prev.pages];
    const head = pages[0];
    if (!head) return prev;
    pages[0] = { ...head, replyStatus };

    return { ...prev, pages };
  });
}

/** Mark all messages in one direction as read (peer opened the thread). */
export function markDirectionMessagesReadInCache<
  T extends {
    id: string;
    direction?: string;
    read_at?: string | null;
    delivery_status?: string | null;
  },
>(
  qc: QueryClient,
  queryKey: readonly unknown[],
  direction: 'inbound' | 'outbound',
  readAt: string
): void {
  qc.setQueryData<InfiniteData<MessagesPage<T>>>(queryKey, (prev) => {
    if (!prev?.pages?.length) return prev;

    return {
      ...prev,
      pages: prev.pages.map((page) => ({
        ...page,
        messages: page.messages.map((message) => {
          if (message.direction !== direction) return message;
          if (message.read_at || message.delivery_status === 'read') return message;
          return { ...message, read_at: readAt, delivery_status: 'read' };
        }),
      })),
    };
  });
}

/** Mark undelivered messages in one direction as delivered (peer client received them). */
export function markDirectionMessagesDeliveredInCache<
  T extends {
    id: string;
    direction?: string;
    read_at?: string | null;
    delivery_status?: string | null;
  },
>(qc: QueryClient, queryKey: readonly unknown[], direction: 'inbound' | 'outbound'): void {
  qc.setQueryData<InfiniteData<MessagesPage<T>>>(queryKey, (prev) => {
    if (!prev?.pages?.length) return prev;

    return {
      ...prev,
      pages: prev.pages.map((page) => ({
        ...page,
        messages: page.messages.map((message) => {
          if (message.direction !== direction) return message;
          if (message.read_at || message.delivery_status === 'read') return message;
          if (message.delivery_status === 'delivered') return message;
          return { ...message, delivery_status: 'delivered' };
        }),
      })),
    };
  });
}
