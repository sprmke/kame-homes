import { useEffect, useMemo, useState } from 'react';

import {
  clearLegacyOrgRenewalSessionStorage,
  clearOrgRenewalAutoShownForUser,
} from '@/features/dashboard/org/lib/listingContractRenewalSession';

import { clearE2EAdminSession, readE2EAdminSession } from '@/lib/e2e/adminSession';
import { supabase } from '@/lib/supabase/client';

import type { Session } from '@supabase/supabase-js';

export type AdminSessionState = {
  status: 'loading' | 'signed-out' | 'not-admin' | 'admin';
  session: Session | null;
  email: string | null;
  name: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

/** Module cache so nested RequireAdmin mounts do not replay the full-screen loader. */
let hydratedSession: Session | null | undefined;

/** Any Google-authenticated user (org owner model — no client allow-list). */
export function useAdminSession(): AdminSessionState {
  const e2eSession = readE2EAdminSession();
  const [session, setSession] = useState<Session | null>(() => {
    if (hydratedSession !== undefined) return hydratedSession;
    return e2eSession;
  });
  const [isLoading, setIsLoading] = useState(
    () => hydratedSession === undefined && e2eSession === null
  );

  useEffect(() => {
    let cancelled = false;
    const mockedSession = readE2EAdminSession();

    if (mockedSession) {
      hydratedSession = mockedSession;
      setSession(mockedSession);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (hydratedSession !== undefined) {
      setSession(hydratedSession);
      setIsLoading(false);
    } else {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (cancelled) return;
          hydratedSession = data.session;
          setSession(data.session);
          setIsLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('[useAdminSession] getSession failed', err);
          hydratedSession = null;
          setIsLoading(false);
        });
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      hydratedSession = next;
      setSession(next);
      setIsLoading(false);
      if (event === 'SIGNED_OUT') {
        clearLegacyOrgRenewalSessionStorage();
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const email = session?.user?.email?.toLowerCase() ?? null;
  const name = (session?.user?.user_metadata?.full_name as string | undefined)?.trim() || null;
  const status: AdminSessionState['status'] = useMemo(() => {
    if (isLoading) return 'loading';
    if (!session) return 'signed-out';
    return 'admin';
  }, [isLoading, session]);

  return {
    status,
    session,
    email,
    name,
    isLoading,
    signOut: async () => {
      const userId = hydratedSession?.user?.id;
      if (userId) {
        clearOrgRenewalAutoShownForUser(userId);
      }
      clearLegacyOrgRenewalSessionStorage();
      if (readE2EAdminSession()) {
        hydratedSession = null;
        clearE2EAdminSession();
        return;
      }
      await supabase.auth.signOut();
    },
  };
}
