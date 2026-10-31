import { useEffect, useRef } from 'react';

import { useLocation } from 'react-router-dom';

import { captureAppEvent } from '@/lib/posthog/capture';
import { isPostHogEnabled, posthog } from '@/lib/posthog/client';
import { setAnalyticsSignedIn } from '@/lib/posthog/context';
import { supabase } from '@/lib/supabase/client';

function authMethodFromUser(user: { app_metadata?: Record<string, unknown> }): string {
  const provider = user.app_metadata?.provider;
  if (typeof provider === 'string' && provider.trim()) return provider.trim();
  return 'unknown';
}

function isGuestAccountPath(pathname: string): boolean {
  return pathname.startsWith('/account');
}

function isSuperAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

/**
 * Ties PostHog to the signed-in Supabase user. Guests on /account omit email on the person
 * profile. Mount once near the app root.
 */
export function PostHogIdentitySync() {
  const identifiedUserId = useRef<string | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isPostHogEnabled) return;

    const identifySessionUser = (user: { id: string; email?: string } | null | undefined) => {
      setAnalyticsSignedIn(Boolean(user));

      if (!user) {
        if (identifiedUserId.current) {
          posthog.reset();
          identifiedUserId.current = null;
        }
        return;
      }

      if (identifiedUserId.current === user.id) return;

      if (identifiedUserId.current) posthog.reset();

      const guestPersona = isGuestAccountPath(pathname);
      const traits: Record<string, string> = {};
      if (!guestPersona && user.email) traits.email = user.email;
      if (isSuperAdminPath(pathname)) traits.persona = 'super_admin';
      else if (guestPersona) traits.persona = 'guest';
      else if (pathname.startsWith('/org')) traits.persona = 'host';

      posthog.identify(user.id, traits);
      identifiedUserId.current = user.id;
    };

    void supabase.auth.getSession().then(({ data }) => {
      identifySessionUser(data.session?.user);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        captureAppEvent('auth_signed_out');
        posthog.reset();
        identifiedUserId.current = null;
        setAnalyticsSignedIn(false);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        captureAppEvent('auth_signed_in', { method: authMethodFromUser(session.user) });
      }

      identifySessionUser(session?.user);
    });

    return () => subscription.subscription.unsubscribe();
  }, [pathname]);

  return null;
}
