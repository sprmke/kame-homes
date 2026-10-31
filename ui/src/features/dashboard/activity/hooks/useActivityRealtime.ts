import { useEffect } from 'react';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { ACTIVITY_LOG_KEY } from '@/features/dashboard/activity/hooks/useActivityLog';

import { supabase } from '@/lib/supabase/client';

const INVALIDATE_DEBOUNCE_MS = 600;

let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleActivityInvalidate(qc: QueryClient) {
  if (invalidateTimer) clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    invalidateTimer = null;
    void qc.invalidateQueries({ queryKey: [ACTIVITY_LOG_KEY] });
  }, INVALIDATE_DEBOUNCE_MS);
}

/**
 * One private Realtime Broadcast channel per org — mount once (NotificationsProvider),
 * never per-page. The DB trigger `activity_log_broadcast` pushes a minimal
 * ids-only signal on `activity:org:<orgId>`; on receipt we debounce-invalidate the
 * activity feed queries so any mounted <ActivityLogPanel> / <EntityActivityHistory>
 * refetches through `list-activity-log` (which still enforces scoped visibility).
 * No row content arrives over the wire.
 */
export function useActivityRealtime(orgId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      await supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`activity:org:${orgId}`, { config: { private: true } })
        .on('broadcast', { event: 'activity' }, () => {
          scheduleActivityInvalidate(qc);
        })
        .subscribe();

      if (cancelled && channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
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
  }, [orgId, qc]);
}
