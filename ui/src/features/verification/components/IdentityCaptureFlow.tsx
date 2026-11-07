import { useCallback, useRef, useState } from 'react';

import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

import { VerificationResultBadge } from './VerificationResultBadge';
import { IDENTITY_METHODS, type IdentityCaptureMethod } from '../lib/documentTypes';
import {
  submitIdentitySession,
  uploadIdentityCapture,
  type IdentitySubmitResponse,
} from '../lib/identityApi';
import { DocumentCaptureStep } from './steps/DocumentCaptureStep';
import { LivenessCheckStep } from './steps/LivenessCheckStep';
import { QrScanStep } from './steps/QrScanStep';

import type { LivenessResult } from '../hooks/useLivenessChallenges';
import type { CaptureQualityResult } from '../lib/captureQuality';

type Step = 'consent' | 'method' | 'qr' | 'front' | 'back' | 'liveness' | 'submitting' | 'done';

type IdentityCaptureFlowProps = {
  token: string;
  subjectKind: 'guest' | 'org_owner';
  onComplete: (result: IdentitySubmitResponse) => void;
  onCancel?: () => void;
  /**
   * Host flows need the captured document itself, because the existing org verification
   * upload still expects a file. Booking flows ignore it.
   */
  onDocumentCaptured?: (file: File) => void;
  className?: string;
};

/**
 * The phone-side capture flow. Every step has a back path, and nothing blocks submit
 * except a missing document.
 */
export function IdentityCaptureFlow({
  token,
  subjectKind,
  onComplete,
  onCancel,
  onDocumentCaptured,
  className,
}: IdentityCaptureFlowProps) {
  const [step, setStep] = useState<Step>('consent');
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<IdentityCaptureMethod | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<CaptureQualityResult | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [result, setResult] = useState<IdentitySubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const totalSteps = method === 'document' ? 4 : 3;
  const stepIndex =
    step === 'consent' ? 0 : step === 'method' ? 1 : step === 'qr' ? 2 : step === 'front' ? 2 : step === 'back' ? 3 : 4;

  const submit = useCallback(
    async (livenessResult: LivenessResult | null, selfie: File | null) => {
      if (!frontFile || submittingRef.current) return;
      submittingRef.current = true;
      setStep('submitting');
      setError(null);
      try {
        const front = await uploadIdentityCapture(token, 'document_front', frontFile);
        let back: { path: string } | null = null;
        if (backFile) back = await uploadIdentityCapture(token, 'document_back', backFile);
        let selfieUpload: { path: string } | null = null;
        if (selfie) selfieUpload = await uploadIdentityCapture(token, 'selfie', selfie);

        const response = await submitIdentitySession(token, {
          consentAccepted: true,
          documentFrontPath: front.path,
          documentBackPath: back?.path ?? null,
          selfiePath: selfieUpload?.path ?? null,
          philsysQr: qrPayload,
          documentTypeHint: method === 'passport' ? 'passport' : null,
          liveness: livenessResult
            ? {
                passed: livenessResult.passed,
                challenges: livenessResult.challenges,
                frameCount: livenessResult.frameCount,
                elapsedMs: livenessResult.elapsedMs,
              }
            : null,
          quality: { score: quality?.score },
        });

        setResult(response);
        setStep('done');
        captureAppEvent('identity_session_completed', {
          subject_kind: subjectKind,
          verdict: response.verdict,
        });
        onComplete(response);
      } catch (submitError) {
        submittingRef.current = false;
        setError((submitError as Error).message);
        setStep('liveness');
      }
    },
    [
      backFile,
      frontFile,
      method,
      onComplete,
      qrPayload,
      quality?.score,
      subjectKind,
      token,
    ]
  );

  const finishLiveness = (livenessResult: LivenessResult) => {
    void submit(livenessResult, livenessResult.frame ?? null);
  };

  const skipLiveness = () => {
    void submit(null, null);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {step !== 'done' && step !== 'submitting' && (
        <Progress
          value={Math.round((stepIndex / totalSteps) * 100)}
          className="h-1"
          aria-label="Verification progress"
        />
      )}

      {step === 'consent' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Check your identity</p>
              <p className="text-muted-foreground text-sm">
                We read your ID to confirm it is genuine and belongs to you.
              </p>
            </div>
          </div>

          <ul className="text-muted-foreground space-y-1 text-xs">
            <li>Photos are stored privately and deleted after 7 days.</li>
            <li>Only the verification result and your name are kept.</li>
            <li>The host sees that you are verified, not your ID number.</li>
          </ul>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consent}
              onCheckedChange={(value) => setConsent(value === true)}
              className="mt-0.5"
            />
            <span>I agree to this check.</span>
          </label>

          <div className="flex gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="button" className="flex-1" disabled={!consent} onClick={() => setStep('method')}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'method' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">What do you want to use?</p>
          <div className="flex flex-col gap-2">
            {IDENTITY_METHODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setMethod(option.value);
                  setStep(option.value === 'philsys_qr' ? 'qr' : 'front');
                }}
                className="hover:bg-muted focus-visible:ring-ring flex min-h-[52px] flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="text-sm font-medium">{option.label}</span>
                {option.hint && <span className="text-muted-foreground text-xs">{option.hint}</span>}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" onClick={() => setStep('consent')}>
            Back
          </Button>
        </div>
      )}

      {step === 'qr' && (
        <div className="space-y-3">
          <QrScanStep
            onScanned={(payload) => {
              setQrPayload(payload);
              setStep('front');
            }}
            onUseUpload={(file) => {
              setFrontFile(file);
              setStep(method === 'document' ? 'back' : 'liveness');
            }}
          />
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('method')}>
            Back
          </Button>
        </div>
      )}

      {step === 'front' && (
        <div className="space-y-3">
          <DocumentCaptureStep
            side="front"
            onCaptured={(file, captureQuality) => {
              setFrontFile(file);
              setQuality(captureQuality);
              onDocumentCaptured?.(file);
            }}
            onUseUpload={(file) => {
              setFrontFile(file);
              setQuality(null);
              onDocumentCaptured?.(file);
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(qrPayload ? 'qr' : 'method')}>
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!frontFile}
              onClick={() => setStep(method === 'document' ? 'back' : 'liveness')}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'back' && (
        <div className="space-y-3">
          <DocumentCaptureStep
            side="back"
            onCaptured={(file) => setBackFile(file)}
            onUseUpload={(file) => setBackFile(file)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep('front')}>
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!backFile}
              onClick={() => setStep('liveness')}
            >
              Continue
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('liveness')}>
            Skip this side
          </Button>
        </div>
      )}

      {step === 'liveness' && (
        <div className="space-y-3">
          {error && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <LivenessCheckStep onComplete={finishLiveness} onSkip={skipLiveness} />
        </div>
      )}

      {step === 'submitting' && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="text-primary h-7 w-7 animate-spin" aria-hidden />
          <p className="text-sm font-medium">Checking your ID</p>
          <p className="text-muted-foreground text-xs">This takes a few seconds.</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden />
          <p className="text-base font-semibold">Done</p>
          <VerificationResultBadge verdict={result.verdict} flags={result.flags} />
          {result.maskedName && <p className="text-muted-foreground text-sm">{result.maskedName}</p>}
          <p className="text-muted-foreground text-xs">You can close this page.</p>
        </div>
      )}
    </div>
  );
}
