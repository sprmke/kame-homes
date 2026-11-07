import { useEffect, useRef } from 'react';

import { Check, Loader2, ScanFace } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import {
  LIVENESS_CHALLENGE_COPY,
  useLivenessChallenges,
  type LivenessResult,
} from '../../hooks/useLivenessChallenges';

type LivenessCheckStepProps = {
  onComplete: (result: LivenessResult) => void;
  onSkip: () => void;
};

/**
 * Optional active liveness. Two challenges, a hard timeout, and a visible "I can't do this"
 * escape hatch. A guest who cannot complete a visual challenge still finishes the capture;
 * the verdict simply cannot reach `verified` without it.
 */
export function LivenessCheckStep({ onComplete, onSkip }: LivenessCheckStepProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reportedRef = useRef(false);
  const liveness = useLivenessChallenges(videoRef);

  const start = liveness.start;
  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    if (reportedRef.current) return;
    if (liveness.phase !== 'passed') return;
    reportedRef.current = true;
    onComplete({
      ...(liveness.result ?? {
        passed: true,
        challenges: [],
        frameCount: 0,
        elapsedMs: 0,
      }),
      frame: liveness.lastFrameRef.current,
    });
  }, [liveness.phase, liveness.lastFrameRef, liveness.result, onComplete]);

  const unavailable = liveness.phase === 'unavailable' || liveness.phase === 'failed';
  const prompt = liveness.challenge ? LIVENESS_CHALLENGE_COPY[liveness.challenge] : 'Hold still';

  return (
    <div className="space-y-4">
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-2xl">
        <video
          ref={videoRef}
          className="h-full w-full scale-x-[-1] object-cover"
          playsInline
          muted
          aria-label="Front camera preview"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[66%] w-[58%] rounded-[50%] border-2 border-white/80" />
        </div>

        {(liveness.phase === 'loading' || liveness.phase === 'idle') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-xs text-white">Starting</span>
          </div>
        )}
      </div>

      {unavailable ? (
        <div className="space-y-3 text-center">
          <p className="text-sm">We could not run the face check on this device.</p>
          <Button type="button" className="w-full" onClick={onSkip}>
            Continue
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2 text-center" aria-live="polite">
            <p className="text-base font-semibold">{prompt}</p>
            <Progress value={Math.round(liveness.progress * 100)} className="h-1.5" />
            <p className="text-muted-foreground text-xs">
              Step {Math.min(liveness.stepIndex + 1, liveness.stepCount)} of {liveness.stepCount}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: liveness.stepCount }).map((_, index) => (
              <span
                key={index}
                className={
                  index < liveness.stepIndex
                    ? 'flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white'
                    : 'border-border flex h-6 w-6 items-center justify-center rounded-full border'
                }
                aria-hidden
              >
                {index < liveness.stepIndex ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
            ))}
          </div>

          <Button type="button" variant="ghost" className="w-full" onClick={onSkip}>
            <ScanFace className="mr-2 h-4 w-4" />
            I can&apos;t do this
          </Button>
        </>
      )}
    </div>
  );
}
