import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import { AlertCircle, ArrowLeft } from 'lucide-react';

import type { AuthPageConfig } from '@/features/guest/auth/config/auth-page-config';

import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useCaptchaToken } from '@/components/security/useCaptchaToken';
import { Button } from '@/components/ui/button';
import { SpinnerIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { AuthDivider } from './AuthDivider';
import { OtpCodeInput } from './OtpCodeInput';

import type { AuthError } from '@supabase/supabase-js';

type Step = 'email' | 'otp';

const RESEND_COOLDOWN_SECONDS = 30;

export interface AuthPageActions {
  sendEmailOtp: (email: string, captchaToken?: string) => Promise<AuthError | null>;
  verifyEmailOtp: (email: string, code: string) => Promise<AuthError | null>;
  signInWithGoogle: () => void | Promise<void>;
  googleLoading?: boolean;
  /** Top-of-page banner error, e.g. an OAuth redirect failure surfaced on return. */
  bannerError?: string | null;
}

interface AuthPageContentProps {
  config: AuthPageConfig;
  mode: 'login' | 'register';
  actions: AuthPageActions;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthPageContent({ config, mode, actions }: AuthPageContentProps) {
  const c = mode === 'login' ? config.login : config.register;
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const captcha = useCaptchaToken({ action: 'auth-email-otp' });

  const busy = isSending || isVerifying || Boolean(actions.googleLoading);

  useEffect(() => {
    if (step !== 'otp' || resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleContinueEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setIsSending(true);
    const captchaToken = await captcha.ensureToken();
    const otpError = await actions.sendEmailOtp(trimmed, captchaToken);
    captcha.reset();
    setIsSending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setCode('');
    setStep('otp');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleVerifyCode = async (codeOverride?: string) => {
    if (isVerifying) return;
    const trimmedCode = (codeOverride ?? code).trim();
    if (!trimmedCode) {
      setError('Enter the code from your email');
      return;
    }
    setError(null);
    setIsVerifying(true);
    const verifyError = await actions.verifyEmailOtp(email.trim(), trimmedCode);
    setIsVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSending) return;
    setError(null);
    setIsSending(true);
    const captchaToken = await captcha.ensureToken();
    const otpError = await actions.sendEmailOtp(email.trim(), captchaToken);
    captcha.reset();
    setIsSending(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="animate-in fade-in-50 duration-500">
      {step === 'otp' ? (
        <button
          type="button"
          onClick={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
          className="text-muted-foreground hover:text-foreground mb-6 flex min-h-[44px] items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          Back
        </button>
      ) : null}

      <div className={cn(step === 'otp' ? 'mb-6 text-center' : 'mb-8')}>
        {step === 'email' && mode === 'login' ? (
          <div className="bg-primary/10 text-primary mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <span>{config.login.badge}</span>
          </div>
        ) : null}

        {step === 'otp' ? (
          <>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Enter your code</h1>
            <p className="text-muted-foreground mt-2">
              We sent a code to <span className="text-foreground font-medium">{email}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{c.title}</h1>
            <p className="text-muted-foreground mt-2">{c.subtitle}</p>
          </>
        )}
      </div>

      {actions.bannerError ? (
        <div className="border-destructive/20 bg-destructive/5 text-destructive mb-4 flex items-start gap-2.5 rounded-xl border p-3.5">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-[13px] leading-snug">{actions.bannerError}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {step === 'email' ? (
          <div className="space-y-2">
            <Label htmlFor="auth-email" className="sr-only">
              Email
            </Label>
            <Input
              id="auth-email"
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
          <OtpCodeInput
            value={code}
            onChange={setCode}
            onComplete={(value) => void handleVerifyCode(value)}
            onEnter={() => void handleVerifyCode()}
            disabled={busy}
            error={Boolean(error)}
          />
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
              onClick={() => void actions.signInWithGoogle()}
              disabled={busy}
              loading={actions.googleLoading}
            />
          </>
        ) : (
          <button
            type="button"
            disabled={busy || resendCooldown > 0}
            onClick={() => void handleResend()}
            className="text-muted-foreground hover:text-foreground mx-auto flex min-h-[44px] items-center text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>
        )}
      </div>

      {step === 'email' ? (
        mode === 'login' ? (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link
              to={config.login.registerHref}
              className="text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              Create one now
            </Link>
          </p>
        ) : (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            Already have an account?{' '}
            <Link
              to={config.register.loginHref}
              className="text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        )
      ) : null}
    </div>
  );
}
