/**
 * Active liveness with two randomised challenges.
 *
 * Two, not six: a one-off guest abandons a ritual. Both challenges are deliberately
 * direction-agnostic ("turn your head to either side") because the preview is mirrored and
 * a wrong-direction prompt is worse than a coarser check.
 *
 * Honesty rules:
 *   * This runs on an untrusted device. The result is `clientside`, never "certified".
 *   * Every failure path becomes `unavailable`, which the flow treats as "skip" — a guest
 *     who cannot complete a visual challenge still finishes the capture.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LIVENESS_THRESHOLDS,
  detectVideo,
  loadFaceLandmarker,
  type FaceSample,
} from '../lib/faceLandmarker';

export type LivenessChallenge = 'blink' | 'turn_head' | 'open_mouth';
export type LivenessPhase =
  | 'idle'
  | 'loading'
  | 'running'
  | 'passed'
  | 'failed'
  | 'unavailable';

export type LivenessResult = {
  passed: boolean | null;
  challenges: string[];
  frameCount: number;
  elapsedMs: number;
  frame?: File | null;
};

export type UseLivenessChallengesResult = {
  phase: LivenessPhase;
  challenge: LivenessChallenge | null;
  stepIndex: number;
  stepCount: number;
  /** 0..1 progress within the current challenge. */
  progress: number;
  result: LivenessResult | null;
  /** Most recent still from the front camera, captured while the stream was alive. */
  lastFrameRef: React.MutableRefObject<File | null>;
  start: () => Promise<void>;
  /** Skip = no liveness signal. The flow proceeds and caps the verdict. */
  skip: () => LivenessResult;
  reset: () => void;
};

const CHALLENGE_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 28_000;
const POLL_INTERVAL_MS = 90;

function pickChallenges(): LivenessChallenge[] {
  const pool: LivenessChallenge[] = ['blink', 'turn_head', 'open_mouth'];
  // Shuffle then take two — a fixed order is trivially recordable.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, 2);
}

function challengeSatisfied(sample: FaceSample, challenge: LivenessChallenge): boolean {
  if (!sample.faceDetected) return false;
  if (challenge === 'blink') {
    return (
      sample.blinkLeft >= LIVENESS_THRESHOLDS.blinkClosed &&
      sample.blinkRight >= LIVENESS_THRESHOLDS.blinkClosed
    );
  }
  if (challenge === 'turn_head') {
    return sample.yawDegrees !== null && Math.abs(sample.yawDegrees) >= LIVENESS_THRESHOLDS.turnDegrees;
  }
  return sample.jawOpen >= LIVENESS_THRESHOLDS.jawOpen;
}

export function useLivenessChallenges(videoRef: React.RefObject<HTMLVideoElement | null>): UseLivenessChallengesResult {
  const [phase, setPhase] = useState<LivenessPhase>('idle');
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<LivenessResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const challengesRef = useRef<LivenessChallenge[]>([]);
  const startedAtRef = useRef(0);
  const challengeStartedAtRef = useRef(0);
  const framesRef = useRef<number>(0);
  const doneRef = useRef(false);
  const cancelledRef = useRef(false);
  const lastFrameRef = useRef<File | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      window.clearTimeout(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  /** Grab a still for the face-match step. Best-effort: never blocks or throws. */
  const captureFrame = useCallback((video: HTMLVideoElement) => {
    if (!video.videoWidth) return;
    const canvas = (frameCanvasRef.current ??= document.createElement('canvas'));
    const width = 480;
    const height = Math.round((video.videoHeight / video.videoWidth) * width) || 360;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) lastFrameRef.current = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      },
      'image/jpeg',
      0.9
    );
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const finish = useCallback(
    (passed: boolean | null, reason: 'complete' | 'timeout' | 'error') => {
      if (doneRef.current) return;
      doneRef.current = true;
      cleanup();
      const outcome: LivenessResult = {
        passed,
        challenges: challengesRef.current,
        frameCount: framesRef.current,
        elapsedMs: Date.now() - startedAtRef.current,
      };
      setResult(outcome);
      setPhase(reason === 'error' || passed === null ? 'unavailable' : passed ? 'passed' : 'failed');
    },
    [cleanup]
  );

  const skip = useCallback((): LivenessResult => {
    const outcome: LivenessResult = {
      passed: null,
      challenges: challengesRef.current,
      frameCount: 0,
      elapsedMs: 0,
    };
    setResult(outcome);
    setPhase('unavailable');
    return outcome;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    cleanup();
    doneRef.current = false;
    framesRef.current = 0;
    challengesRef.current = [];
    setPhase('idle');
    setChallenge(null);
    setStepIndex(0);
    setProgress(0);
    setResult(null);
  }, [cleanup]);

  const start = useCallback(async () => {
    if (phase === 'loading' || phase === 'running') return;
    cancelledRef.current = false;
    doneRef.current = false;
    framesRef.current = 0;
    setResult(null);
    setProgress(0);
    setStepIndex(0);
    setPhase('loading');

    const challenges = pickChallenges();
    challengesRef.current = challenges;
    setChallenge(challenges[0] ?? null);

    let landmarker;
    try {
      landmarker = await loadFaceLandmarker();
    } catch {
      finish(null, 'error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      finish(null, 'error');
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      finish(null, 'error');
      return;
    }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch {
      finish(null, 'error');
      return;
    }

    startedAtRef.current = Date.now();
    challengeStartedAtRef.current = Date.now();
    setPhase('running');

    let index = 0;

    const tick = () => {
      if (cancelledRef.current || doneRef.current) return;
      const elapsedTotal = Date.now() - startedAtRef.current;
      if (elapsedTotal > TOTAL_TIMEOUT_MS) {
        finish(false, 'timeout');
        return;
      }
      if (Date.now() - challengeStartedAtRef.current > CHALLENGE_TIMEOUT_MS) {
        finish(false, 'timeout');
        return;
      }
      if (video.readyState < 2) {
        rafRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }

      const current = challenges[index];
      if (!current) {
        finish(true, 'complete');
        return;
      }

      let sample: FaceSample | null = null;
      try {
        sample = detectVideo(landmarker, video, performance.now());
        framesRef.current += 1;
        if (framesRef.current % 6 === 0) captureFrame(video);
      } catch {
        finish(null, 'error');
        return;
      }

      if (sample && challengeSatisfied(sample, current)) {
        index += 1;
        challengeStartedAtRef.current = Date.now();
        setStepIndex(index);
        setProgress(0);
        setChallenge(challenges[index] ?? null);
        if (index >= challenges.length) {
          finish(true, 'complete');
          return;
        }
      } else {
        const remaining = Math.max(
          0,
          1 - (Date.now() - challengeStartedAtRef.current) / CHALLENGE_TIMEOUT_MS
        );
        setProgress(1 - remaining);
      }

      rafRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    rafRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
  }, [captureFrame, finish, phase, videoRef]);

  return {
    phase,
    challenge,
    stepIndex,
    stepCount: challengesRef.current.length || 2,
    progress,
    result,
    lastFrameRef,
    start,
    skip,
    reset,
  };
}

export const LIVENESS_CHALLENGE_COPY: Record<LivenessChallenge, string> = {
  blink: 'Blink once',
  turn_head: 'Turn your head to either side',
  open_mouth: 'Open your mouth',
};
