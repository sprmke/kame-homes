import { useEffect } from 'react';

import { supabase } from '@/lib/supabase/client';

import { setSentryTenantScope, setSentryUser } from './scope';

/**
 * Ties Sentry to the signed-in Supabase user, mirroring `PostHogIdentitySync`.
 *
 * `user.id` only. No email, no name, no IP — Sentry is for "which account hit this", and a
 * pseudonymous uuid answers that without turning the error tracker into a customer database
 * (plan D10).
 *
 * Sign-out clears both the user and the tenant tags: a shared browser must not attribute the
 * next person's crash to the previous account.
 */
export function SentryIdentitySync() {
  useEffect(() => {
    const apply = (user: { id: string } | null | undefined) => {
      if (!user?.id) {
        setSentryUser(null);
        setSentryTenantScope({});
        return;
      }
      setSentryUser({ id: user.id });
    };

    void supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return null;
}
