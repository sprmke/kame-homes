import { useCallback, useEffect, useMemo, useState } from 'react';

import { Loader2, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

import { CrossDeviceHandoffPanel } from './CrossDeviceHandoffPanel';
import { IdentityCaptureFlow } from './IdentityCaptureFlow';
import { useCreateIdentitySession, useIdentitySessionPolling } from '../hooks/useIdentitySession';
import {
  cancelIdentitySession,
  type CreatedIdentitySession,
  type IdentitySubjectKind,
  type IdentitySubmitResponse,
} from '../lib/identityApi';

export type IdentityVerificationFlowProps = {
  subjectKind: IdentitySubjectKind;
  organizationId?: string;
  bookingId?: string;
  guestSlot?: number | null;
  email?: string;
  propertySlug?: string;
  onComplete: (result: IdentitySubmitResponse) => void;
  onCancel?: () => void;
  /** Host flows: the captured document, so the existing upload path can keep working. */
  onDocumentCaptured?: (file: File) => void;
  className?: string;
};

/** A fine pointer means a mouse/trackpad — the only case where a QR handoff makes sense. */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(pointer: fine)').matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(pointer: fine)');
    const onChange = () => setFine(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return fine;
}

/**
 * Entry point shared by the guest booking form, the host onboarding and Get Verified.
 *
 * Desktop: create a session and show the QR handoff. Phone: run the capture inline, because
 * scanning a QR with the device displaying it is circular.
 */
export function IdentityVerificationFlow({
  subjectKind,
  organizationId,
  bookingId,
  guestSlot,
  email,
  propertySlug,
  onComplete,
  onCancel,
  onDocumentCaptured,
  className,
}: IdentityVerificationFlowProps) {
  const finePointer = useFinePointer();
  const createSession = useCreateIdentitySession();
  const [session, setSession] = useState<CreatedIdentitySession | null>(null);
  const [mode, setMode] = useState<'choose' | 'handoff' | 'inline'>('choose');
  const [completed, setCompleted] = useState<IdentitySubmitResponse | null>(null);

  const polling = useIdentitySessionPolling({
    token: mode === 'handoff' ? session?.token ?? null : null,
    sessionId: mode === 'handoff' ? session?.sessionId ?? null : null,
    enabled: mode === 'handoff',
  });

  const start = useCallback(
    async (target: 'handoff' | 'inline') => {
      setMode(target);
      try {
        const created = await createSession.mutateAsync({
          subjectKind,
          organizationId,
          bookingId,
          guestSlot: guestSlot ?? null,
          email,
          propertySlug,
          originDevice: target === 'inline' ? 'mobile' : 'desktop',
        });
        setSession(created);
        captureAppEvent('identity_session_started', {
          subject_kind: subjectKind,
          mode: target,
          guest_slot: guestSlot ?? null,
        });
      } catch {
        setMode('choose');
      }
    },
    [bookingId, createSession, email, guestSlot, organizationId, propertySlug, subjectKind]
  );

  // An inline capture reports its own result; a handoff resolves through polling.
  useEffect(() => {
    if (mode !== 'handoff' || completed) return;
    const view = polling.data;
    if (!view || view.status !== 'completed' || !view.verdict) return;
    if (!view.verificationId) return;
    const result: IdentitySubmitResponse = {
      sessionId: view.sessionId,
      verificationId: view.verificationId,
      status: 'completed',
      verdict: view.verdict,
      flags: view.flags ?? [],
      documentType: view.documentType,
      maskedName: view.maskedName,
    };
    setCompleted(result);
    onComplete(result);
  }, [completed, mode, onComplete, polling.data]);

  const cancel = useCallback(() => {
    if (session) void cancelIdentitySession(session.sessionId).catch(() => {});
    onCancel?.();
  }, [onCancel, session]);

  const heading = useMemo(
    () => (subjectKind === 'org_owner' ? 'Verify your identity' : 'Verify your ID'),
    [subjectKind]
  );

  if (completed) {
    return null;
  }

  if (mode === 'inline' && session) {
    return (
      <IdentityCaptureFlow
        token={session.token}
        subjectKind={subjectKind}
        onComplete={setCompleted}
        onCancel={cancel}
        onDocumentCaptured={onDocumentCaptured}
        className={className}
      />
    );
  }

  if (mode === 'handoff' && session) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="text-center">
          <p className="text-sm font-semibold">{heading}</p>
        </div>
        <CrossDeviceHandoffPanel
          verifyUrl={session.verifyUrl}
          expiresAt={session.expiresAt}
          status={polling.data?.status ?? 'pending'}
          onRestart={() => void start('handoff')}
        />
        <Button type="button" variant="ghost" className="w-full" onClick={cancel}>
          Cancel
        </Button>
      </div>
    );
  }

  if (mode === 'handoff' && !session) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden />
        <p className="text-muted-foreground text-sm">Preparing your link</p>
      </div>
    );
  }

  if (mode === 'inline' && !session) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden />
        <p className="text-muted-foreground text-sm">Starting</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-1 text-center">
        <p className="text-base font-semibold">{heading}</p>
        <p className="text-muted-foreground text-sm">
          {finePointer ? 'Use your phone camera for a clear capture.' : 'Use your camera.'}
        </p>
      </div>

      {createSession.isError && (
        <p className="text-destructive text-center text-sm">
          {createSession.error?.message || 'Could not start. Try again.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {finePointer && (
          <Button
            type="button"
            className="w-full"
            disabled={createSession.isPending}
            onClick={() => void start('handoff')}
          >
            <Smartphone className="mr-2 h-4 w-4" />
            Verify on your phone
          </Button>
        )}
        <Button
          type="button"
          variant={finePointer ? 'outline' : 'default'}
          className="w-full"
          disabled={createSession.isPending}
          onClick={() => void start('inline')}
        >
          {createSession.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {finePointer ? 'Use this device' : 'Start'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
