import { useEffect, useMemo, useState } from 'react';

import { readE2EGuestSession } from '@/lib/e2e/guestSession';
import { supabase } from '@/lib/supabase/client';

import type { Session } from '@supabase/supabase-js';

export type GuestSessionStatus = 'loading' | 'anonymous' | 'authenticated';

export function useGuestSession() {
  const e2eSession = readE2EGuestSession();
  const [session, setSession] = useState<Session | null>(() => e2eSession);
  const [isLoading, setIsLoading] = useState(() => e2eSession === null);

  useEffect(() => {
    let cancelled = false;
    const mockedSession = readE2EGuestSession();

    if (mockedSession) {
      setSession(mockedSession);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useGuestSession] getSession failed', err);
        setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (readE2EGuestSession()) return;
      setSession(next);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const email = session?.user?.email?.toLowerCase() ?? null;

  const status: GuestSessionStatus = useMemo(() => {
    if (isLoading) return 'loading';
    if (!session) return 'anonymous';
    return 'authenticated';
  }, [isLoading, session]);

  return { status, session, email, isLoading };
}
