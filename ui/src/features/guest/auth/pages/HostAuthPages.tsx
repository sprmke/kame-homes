import { AuthPageContent } from '@/features/guest/auth/components';
import { HostAuthResolving } from '@/features/guest/auth/components/HostAuthResolving';
import { AUTH_PAGE_CONFIG } from '@/features/guest/auth/config/auth-page-config';
import { useHostGoogleAuth } from '@/features/guest/auth/hooks/useHostGoogleAuth';
import { HOST_LOGIN_PATH, HOST_REGISTER_PATH } from '@/features/guest/auth/lib/hostAuthPaths';

import { appPageTitle, usePageTitle } from '@/lib/pageTitle';

export function HostLoginPage() {
  usePageTitle(appPageTitle('Sign In'));
  const hostAuth = useHostGoogleAuth({
    callbackPathname: HOST_LOGIN_PATH,
    defaultRedirect: '/dashboard',
  });

  if (hostAuth.status === 'admin' && hostAuth.isResolving) {
    return <HostAuthResolving />;
  }

  return (
    <AuthPageContent
      config={AUTH_PAGE_CONFIG.host}
      mode="login"
      actions={{
        sendEmailOtp: hostAuth.sendEmailOtp,
        verifyEmailOtp: hostAuth.verifyEmailOtp,
        signInWithGoogle: hostAuth.signInWithGoogle,
        googleLoading: hostAuth.isSigningIn,
        bannerError: hostAuth.error,
      }}
    />
  );
}

export function HostRegisterPage() {
  usePageTitle(appPageTitle('Register'));
  const hostAuth = useHostGoogleAuth({
    callbackPathname: HOST_REGISTER_PATH,
    defaultRedirect: '/onboarding',
  });

  if (hostAuth.status === 'admin' && hostAuth.isResolving) {
    return <HostAuthResolving />;
  }

  return (
    <AuthPageContent
      config={AUTH_PAGE_CONFIG.host}
      mode="register"
      actions={{
        sendEmailOtp: hostAuth.sendEmailOtp,
        verifyEmailOtp: hostAuth.verifyEmailOtp,
        signInWithGoogle: hostAuth.signInWithGoogle,
        googleLoading: hostAuth.isSigningIn,
        bannerError: hostAuth.error,
      }}
    />
  );
}
