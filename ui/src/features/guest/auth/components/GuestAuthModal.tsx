import { useCallback, useEffect, useState } from 'react';

import { ArrowLeft } from 'lucide-react';

import { AuthDivider } from '@/features/guest/auth/components/AuthDivider';
import { useGuestAuthActions } from '@/features/guest/auth/hooks/useGuestAuthActions';

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useCaptchaToken } from '@/components/security/useCaptchaToken';
import { Button } from '@/components/ui/button';
import { SpinnerIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type Step = 'email' | 'otp';

interface GuestAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oauthRedirectPath: string;
}

export function GuestAuthModal({ open, onOpenChange, oauthRedirectPath }: GuestAuthModalProps) {
  const { sendEmailOtp, verifyEmailOtp, signInWithGoogle } = useGuestAuthActions();
  const captcha = useCaptchaToken({ action: 'auth-email-otp' });
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const resetForm = useCallback(() => {
    setStep('email');
    setEmail('');
    setCode('');
    setError(null);
    setIsSending(false);
    setIsVerifying(false);
    setIsSigningInWithGoogle(false);
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const handleContinueEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setIsSending(true);
    const captchaToken = await captcha.ensureToken();
    const otpError = await sendEmailOtp(trimmed, captchaToken);
    captcha.reset();
    setIsSending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStep('otp');
  };

  const handleVerifyCode = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Enter the code from your email');
      return;
    }
    setError(null);
    setIsVerifying(true);
    const verifyError = await verifyEmailOtp(email, trimmedCode);
    setIsVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningInWithGoogle(true);
    const oauthError = await signInWithGoogle(oauthRedirectPath);
    if (oauthError) {
      setError(oauthError.message);
      setIsSigningInWithGoogle(false);
    }
  };

  const busy = isSending || isVerifying || isSigningInWithGoogle;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="gap-0 p-0 sm:max-w-[min(calc(100vw-1.5rem),26rem)]"
      >
        <ResponsiveModalHeader className="border-border/60 space-y-4 border-b px-4 pb-4 pt-5 text-center sm:px-6">
          <div className="from-primary to-primary/80 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-md">
            <span className="text-lg font-bold text-white">K</span>
          </div>
          <ResponsiveModalTitle className="text-center text-lg font-bold sm:text-xl">
            {step === 'email' ? 'Log in or sign up' : 'Confirm your email'}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {step === 'otp' && (
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground flex min-h-[44px] items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Back
            </button>
          )}

          {step === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="guest-auth-email" className="sr-only">
                Email
              </Label>
              <Input
                id="guest-auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                disabled={busy}
                className="h-12 rounded-xl text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleContinueEmail();
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-center text-sm">{email}</p>
              <Label htmlFor="guest-auth-code" className="sr-only">
                Verification code
              </Label>
              <Input
                id="guest-auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                disabled={busy}
                className="h-12 rounded-xl text-center text-base tracking-widest"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleVerifyCode();
                }}
              />
            </div>
          )}

          {/* Kept mounted on both steps so Resend (OTP step) still has a fresh single-use token. */}
          {captcha.widget}

          {error ? (
            <p className="text-destructive text-center text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="h-12 w-full rounded-xl text-base font-semibold"
            disabled={busy}
            onClick={() => void (step === 'email' ? handleContinueEmail() : handleVerifyCode())}
          >
            {isSending || isVerifying ? (
              <SpinnerIcon className="size-5" />
            ) : step === 'email' ? (
              'Continue'
            ) : (
              'Verify'
            )}
          </Button>

          {step === 'email' ? (
            <>
              <AuthDivider text="or" />
              <GoogleSignInButton
                onClick={() => void handleGoogleSignIn()}
                disabled={busy}
                loading={isSigningInWithGoogle}
              />
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleContinueEmail()}
              className={cn(
                'text-muted-foreground hover:text-foreground mx-auto flex min-h-[44px] items-center text-sm font-medium transition-colors',
                busy && 'pointer-events-none opacity-50'
              )}
            >
              Resend code
            </button>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
