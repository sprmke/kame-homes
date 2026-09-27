import { useCallback, useEffect, useState } from 'react';

import { OtpCodeInput } from '@/features/guest/auth/components/OtpCodeInput';

import {
  useSettingsVerification,
  type SettingsVerificationScope,
} from '@/features/dashboard/org/hooks/useSettingsVerification';

import { Button } from '@/components/ui/button';
import { SpinnerIcon } from '@/components/ui/icons';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { platformLegalSubject } from '@/lib/platformBranding';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: SettingsVerificationScope;
  patchFingerprint: string;
  onVerified: (verificationToken: string) => void;
  busy?: boolean;
};

export function SensitiveSettingsOtpDialog({
  open,
  onOpenChange,
  scope,
  patchFingerprint,
  onVerified,
  busy = false,
}: Props) {
  const { sendOtp, verifyOtp } = useSettingsVerification(scope);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [ownerEmailMasked, setOwnerEmailMasked] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpSent = Boolean(challengeId);

  const reset = useCallback(() => {
    setChallengeId(null);
    setOwnerEmailMasked('');
    setCode('');
    setError(null);
    setSending(false);
    setVerifying(false);
    setResendCooldown(0);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const dispatchOtp = useCallback(async () => {
    if (!patchFingerprint) {
      setError('Missing payment change fingerprint');
      return;
    }
    setSending(true);
    setError(null);
    setCode('');
    try {
      const result = await sendOtp(patchFingerprint);
      setChallengeId(result.challengeId);
      setOwnerEmailMasked(result.ownerEmailMasked);
      setResendCooldown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send verification code');
    } finally {
      setSending(false);
    }
  }, [patchFingerprint, sendOtp]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async (nextCode?: string) => {
    const trimmed = (nextCode ?? code).trim();
    if (!challengeId || trimmed.length < 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyOtp(challengeId, trimmed);
      onVerified(result.verificationToken);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const dialogBusy = busy || sending || verifying;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="max-w-[min(calc(100vw-1.5rem),32rem)] overflow-x-hidden sm:max-w-lg"
        showCloseButton={false}
      >
        <ResponsiveModalHeader className="min-w-0">
          <ResponsiveModalTitle>Verify payment changes</ResponsiveModalTitle>
          <ResponsiveModalDescription className="break-words">
            {otpSent && ownerEmailMasked
              ? `Enter the code sent to the org owner at ${ownerEmailMasked}.`
              : 'Send a verification code to the org owner, then enter it to save.'}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-0.5 py-1">
          {otpSent ? (
            <div className="space-y-3">
              <Label className="sr-only">Verification code</Label>
              <OtpCodeInput
                key={challengeId}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) setError(null);
                }}
                onComplete={(value) => void handleVerify(value)}
                onEnter={() => void handleVerify()}
                disabled={dialogBusy}
                error={Boolean(error)}
                autoFocus
                compact
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-destructive text-center text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <p className="text-muted-foreground text-xs leading-relaxed">
            By saving, you confirm payment details are accurate. {platformLegalSubject()} is not
            liable for losses from incorrect payment information.
          </p>
        </div>

        <ResponsiveModalFooter className="!flex-row flex-nowrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] shrink-0 px-3"
            disabled={dialogBusy}
            onClick={() => onOpenChange(false)}
          >
            Discard changes
          </Button>
          {otpSent ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] shrink-0 px-3"
                disabled={dialogBusy || resendCooldown > 0}
                onClick={() => void dispatchOtp()}
              >
                {sending ? (
                  <>
                    <SpinnerIcon className="size-4" aria-hidden />
                    Sending…
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend (${resendCooldown}s)`
                ) : (
                  'Resend code'
                )}
              </Button>
              <Button
                type="button"
                className={cn('min-h-[44px] shrink-0 px-3')}
                disabled={dialogBusy || code.length < 6}
                onClick={() => void handleVerify()}
              >
                {verifying || busy ? (
                  <>
                    <SpinnerIcon className="size-4" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Verify and save'
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="min-h-[44px] shrink-0 px-3"
              disabled={dialogBusy || !patchFingerprint}
              onClick={() => void dispatchOtp()}
            >
              {sending ? (
                <>
                  <SpinnerIcon className="size-4" aria-hidden />
                  Sending…
                </>
              ) : (
                'Send OTP'
              )}
            </Button>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
