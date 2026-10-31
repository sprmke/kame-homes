import { useCallback, useEffect, useRef } from 'react';

import type { ChatTypingRole } from '@/lib/chat/useChatTyping';
import { supabase } from '@/lib/supabase/client';

type ReadReceiptPayload = {
  role: ChatTypingRole;
  readAt?: string;
};

type DeliveredPayload = {
  role: ChatTypingRole;
};

const BROADCAST_RETRY_MS = 250;
const BROADCAST_MAX_RETRIES = 8;

/**
 * When one party marks the thread read (or receives a message), notify the other via
 * Broadcast so their sent-message ticks refresh without closing the thread.
 */
export function useChatReadReceiptSync(
  conversationId: string | null,
  role: ChatTypingRole,
  onPeerRead: (readAt: string) => void,
  onPeerDelivered: () => void,
  enabled = true
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const pendingReadRef = useRef(false);
  const pendingDeliveredRef = useRef(false);
  const onPeerReadRef = useRef(onPeerRead);
  const onPeerDeliveredRef = useRef(onPeerDelivered);
  const roleRef = useRef(role);
  roleRef.current = role;
  onPeerReadRef.current = onPeerRead;
  onPeerDeliveredRef.current = onPeerDelivered;

  const sendBroadcast = useCallback(
    async (event: 'read' | 'delivered', payload: ReadReceiptPayload | DeliveredPayload) => {
      const channel = channelRef.current;
      if (!channel || !subscribedRef.current) return false;

      await channel.send({
        type: 'broadcast',
        event,
        payload,
      });
      return true;
    },
    []
  );

  const flushPending = useCallback(async () => {
    if (pendingReadRef.current) {
      const sent = await sendBroadcast('read', {
        role: roleRef.current,
        readAt: new Date().toISOString(),
      });
      if (sent) pendingReadRef.current = false;
    }
    if (pendingDeliveredRef.current) {
      const sent = await sendBroadcast('delivered', { role: roleRef.current });
      if (sent) pendingDeliveredRef.current = false;
    }
  }, [sendBroadcast]);

  const queueBroadcast = useCallback(
    async (event: 'read' | 'delivered') => {
      if (event === 'read') pendingReadRef.current = true;
      else pendingDeliveredRef.current = true;

      for (let attempt = 0; attempt < BROADCAST_MAX_RETRIES; attempt += 1) {
        if (!pendingReadRef.current && !pendingDeliveredRef.current) return;
        await flushPending();
        if (!pendingReadRef.current && !pendingDeliveredRef.current) return;
        await new Promise((resolve) => window.setTimeout(resolve, BROADCAST_RETRY_MS));
      }
    },
    [flushPending]
  );

  useEffect(() => {
    if (!conversationId || !enabled) return;

    let cancelled = false;
    subscribedRef.current = false;
    pendingReadRef.current = false;
    pendingDeliveredRef.current = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      await supabase.realtime.setAuth(token);

      const channel = supabase.channel(`chat-sync:${conversationId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'read' }, ({ payload }) => {
          const event = payload as ReadReceiptPayload;
          if (event.role === roleRef.current) return;
          onPeerReadRef.current(event.readAt ?? new Date().toISOString());
        })
        .on('broadcast', { event: 'delivered' }, ({ payload }) => {
          const event = payload as DeliveredPayload;
          if (event.role === roleRef.current) return;
          onPeerDeliveredRef.current();
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return;
          subscribedRef.current = true;
          void flushPending();
        });

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      subscribedRef.current = false;
      pendingReadRef.current = false;
      pendingDeliveredRef.current = false;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [conversationId, enabled, flushPending]);

  const notifyPeerRead = useCallback(async () => {
    await queueBroadcast('read');
  }, [queueBroadcast]);

  const notifyPeerDelivered = useCallback(async () => {
    await queueBroadcast('delivered');
  }, [queueBroadcast]);

  return { notifyPeerRead, notifyPeerDelivered };
}
