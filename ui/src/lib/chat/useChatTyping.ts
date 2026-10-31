import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

export type ChatTypingRole = 'guest' | 'host';

type TypingPayload = {
  userId: string;
  role: ChatTypingRole;
  typing: boolean;
};

export function useChatTyping(conversationId: string | null, role: ChatTypingRole, enabled = true) {
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const peerTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId || !enabled) return;

    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id;
      if (!token || !userId || cancelled) return;

      userIdRef.current = userId;
      await supabase.realtime.setAuth(token);

      const channel = supabase.channel(`chat-typing:${conversationId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const event = payload as TypingPayload;
          if (event.role === role || event.userId === userId) return;
          setPeerTyping(Boolean(event.typing));
          if (peerTimerRef.current) window.clearTimeout(peerTimerRef.current);
          if (event.typing) {
            peerTimerRef.current = window.setTimeout(() => setPeerTyping(false), 4000);
          }
        })
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (peerTimerRef.current) window.clearTimeout(peerTimerRef.current);
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setPeerTyping(false);
    };
  }, [conversationId, enabled, role]);

  const broadcastTyping = useCallback(
    (typing: boolean) => {
      const channel = channelRef.current;
      const userId = userIdRef.current;
      if (!channel || !userId) return;
      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, role, typing } satisfies TypingPayload,
      });
    },
    [role]
  );

  const signalTyping = useCallback(() => {
    broadcastTyping(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => broadcastTyping(false), 2500);
  }, [broadcastTyping]);

  return { peerTyping, signalTyping };
}
