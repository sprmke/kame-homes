import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';

import { shouldPersistQuery } from '@/lib/pwa/offlineQueryAllowlist';
import { purgeOfflineState } from '@/lib/pwa/purgeOfflineState';
import { createQueryPersister } from '@/lib/pwa/queryPersister';
import { supabase } from '@/lib/supabase/client';

/** 24h — an offline operator sees data at most a day stale before it's dropped. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Persists the allowlisted slice of the query cache to IndexedDB, keyed per
 * signed-in identity so one viewer's cache is never restored into another's
 * session on a shared device. Clears everything on sign-out.
 *
 * Mount once, inside <QueryClientProvider>.
 */
export function PwaQueryPersistence() {
  const queryClient = useQueryClient();
  const [viewerKey, setViewerKey] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Resolve the current viewer and follow auth changes.
  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setViewerKey(data.session?.user?.id ? `user-${data.session.user.id}` : 'anon');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        queryClient.clear();
        void purgeOfflineState();
        setViewerKey('anon');
        return;
      }
      setViewerKey(session?.user?.id ? `user-${session.user.id}` : 'anon');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  // (Re)wire persistence whenever the viewer identity changes.
  useEffect(() => {
    if (!viewerKey) return;
    let cancelled = false;
    const persister = createQueryPersister(viewerKey);

    void persistQueryClientRestore({
      queryClient,
      persister,
      maxAge: MAX_AGE_MS,
      buster: __PWA_BUILD_ID__,
    }).finally(() => {
      if (cancelled) return;
      unsubscribeRef.current?.();
      unsubscribeRef.current = persistQueryClientSubscribe({
        queryClient,
        persister,
        buster: __PWA_BUILD_ID__,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      });
    });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [viewerKey, queryClient]);

  return null;
}
