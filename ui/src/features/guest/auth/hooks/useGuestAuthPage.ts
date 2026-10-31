import { useCallback, useEffect, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { useGuestAuthActions } from '@/features/guest/auth/hooks/useGuestAuthActions';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';
import { safeRedirect } from '@/features/guest/auth/lib/guestAuthPaths';

type Options = {
  /** Default redirect when `?redirect=` is absent. */
  defaultRedirect?: string;
};

/** Drives the standalone `/for-guests/login` and `/for-guests/register` pages. */
export function useGuestAuthPage({ defaultRedirect = '/' }: Options = {}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get('redirect'), defaultRedirect);
  const { status } = useGuestSession();
  const { sendEmailOtp, verifyEmailOtp, signInWithGoogle } = useGuestAuthActions();
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(redirect, { replace: true });
    }
  }, [status, redirect, navigate]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsSigningInWithGoogle(true);
    setError(null);
    const oauthError = await signInWithGoogle(redirect);
    if (oauthError) {
      setError(oauthError.message);
      setIsSigningInWithGoogle(false);
    }
  }, [signInWithGoogle, redirect]);

  return {
    status,
    error,
    googleLoading: isSigningInWithGoogle,
    sendEmailOtp,
    verifyEmailOtp,
    signInWithGoogle: handleGoogleSignIn,
  };
}
