import { useCallback, useEffect, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useGuestAuthActions } from '@/features/guest/auth/hooks/useGuestAuthActions';
import { hostGoogleOAuthRedirectTo, safeRedirect } from '@/features/guest/auth/lib/hostAuthPaths';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { resolvePostSignInPath } from '@/features/dashboard/org/lib/postSignInRouting';

import { supabase } from '@/lib/supabase/client';

type Options = {
  /** Pathname for OAuth callback (e.g. `/for-hosts/login`). */
  callbackPathname: string;
  /** Default redirect when `?redirect=` is absent. */
  defaultRedirect?: string;
};

export function useHostGoogleAuth({ callbackPathname, defaultRedirect = '/dashboard' }: Options) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get('redirect'), defaultRedirect);
  const { status } = useAdminSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (status !== 'admin') return;

    let cancelled = false;
    setIsResolving(true);

    void resolvePostSignInPath(redirect)
      .then((path) => {
        if (!cancelled) navigate(path, { replace: true });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useHostGoogleAuth] post-sign-in routing failed', err);
          setError('Could not load your workspace. Try again.');
          setIsResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, redirect, navigate]);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: hostGoogleOAuthRedirectTo(callbackPathname, redirect),
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setIsSigningIn(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setIsSigningIn(false);
    }
  }, [callbackPathname, redirect]);

  const { sendEmailOtp, verifyEmailOtp } = useGuestAuthActions();

  return {
    status,
    error,
    isSigningIn,
    isResolving,
    signInWithGoogle,
    sendEmailOtp,
    verifyEmailOtp,
    setError,
  };
}
