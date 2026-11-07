/**
 * Camera + auto-capture for the document step.
 *
 * getUserMedia → a downscaled sampling loop → quality gate → full-resolution capture after
 * three consecutive good frames. The manual shutter is always available.
 *
 * Every failure mode is a state, not a throw: `denied`, `not_found`, `unsupported`. The
 * caller shows the upload fallback instead of a dead end.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CAPTURE_QUALITY_THRESHOLDS,
  computeBlurVariance,
  computeEdgeDensity,
  computeGlareRatio,
  scoreCapture,
  toGrayscale,
  type CaptureQualityResult,
} from '../lib/captureQuality';

export type CameraState = 'idle' | 'starting' | 'ready' | 'error';
export type CameraErrorCode = 'denied' | 'not_found' | 'unsupported' | 'unknown';

const SAMPLE_WIDTH = 240;
const SAMPLE_HEIGHT = 180;
const SAMPLE_INTERVAL_MS = 160;
const REQUIRED_CONSECUTIVE_PASSES = 3;

export type UseDocumentAutoCaptureOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onAutoCapture: (file: File, quality: CaptureQualityResult) => void;
  enabled?: boolean;
  autoCapture?: boolean;
};

export type UseDocumentAutoCaptureResult = {
  state: CameraState;
  error: CameraErrorCode | null;
  quality: CaptureQualityResult | null;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<CaptureQualityResult | null>;
};

function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode the photo'));
          return;
        }
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  });
}

export function useDocumentAutoCapture({
  videoRef,
  onAutoCapture,
  enabled = true,
  autoCapture = true,
}: UseDocumentAutoCaptureOptions): UseDocumentAutoCaptureResult {
  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<CameraErrorCode | null>(null);
  const [quality, setQuality] = useState<CaptureQualityResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const passesRef = useRef(0);
  const capturedRef = useRef(false);
  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;

  const stopLoop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopLoop();
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('idle');
  }, [stopLoop, videoRef]);

  const capture = useCallback(async (): Promise<CaptureQualityResult | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Score the downscaled view, not the full frame: the thresholds are calibrated there.
    const sample = document.createElement('canvas');
    sample.width = SAMPLE_WIDTH;
    sample.height = SAMPLE_HEIGHT;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    let result: CaptureQualityResult | null = null;
    if (sampleContext) {
      sampleContext.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const { data } = sampleContext.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const gray = toGrayscale(data);
      result = scoreCapture({
        blurVariance: computeBlurVariance(gray, SAMPLE_WIDTH, SAMPLE_HEIGHT),
        glareRatio: computeGlareRatio(gray),
        edgeDensity: computeEdgeDensity(gray, SAMPLE_WIDTH, SAMPLE_HEIGHT),
      });
      setQuality(result);
    }

    const file = await canvasToJpegFile(canvas, `identity-${Date.now()}.jpg`);
    onAutoCaptureRef.current(file, result ?? { score: 0, acceptable: false, issues: ['no_document'] });
    return result;
  }, [videoRef]);

  const start = useCallback(async () => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('unsupported');
      return;
    }

    setState('starting');
    setError(null);
    passesRef.current = 0;
    capturedRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (firstError) {
      const name = (firstError as DOMException)?.name ?? '';
      if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (retryError) {
          setState('error');
          setError(mapCameraError(retryError));
          return;
        }
      } else {
        setState('error');
        setError(mapCameraError(firstError));
        return;
      }
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stop();
      return;
    }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch {
      // Autoplay can reject on iOS until a user gesture; the <video> is already muted
      // and inline, and the user tapped "Start", so a second play() on readyState wins.
      video.addEventListener('loadeddata', () => void video.play().catch(() => {}), { once: true });
    }

    setState('ready');

    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement('canvas');
      sampleCanvasRef.current.width = SAMPLE_WIDTH;
      sampleCanvasRef.current.height = SAMPLE_HEIGHT;
    }

    stopLoop();
    intervalRef.current = window.setInterval(() => {
      if (!video || video.videoWidth === 0 || capturedRef.current) return;
      const canvas = sampleCanvasRef.current;
      const context = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !context) return;

      context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const gray = toGrayscale(data);
      const result = scoreCapture({
        blurVariance: computeBlurVariance(gray, SAMPLE_WIDTH, SAMPLE_HEIGHT),
        glareRatio: computeGlareRatio(gray),
        edgeDensity: computeEdgeDensity(gray, SAMPLE_WIDTH, SAMPLE_HEIGHT),
      });
      setQuality(result);

      if (result.acceptable) {
        passesRef.current += 1;
        if (autoCapture && passesRef.current >= REQUIRED_CONSECUTIVE_PASSES && !capturedRef.current) {
          capturedRef.current = true;
          stopLoop();
          void capture();
        }
      } else {
        passesRef.current = 0;
      }
    }, SAMPLE_INTERVAL_MS);
  }, [autoCapture, capture, enabled, stop, stopLoop, videoRef]);

  useEffect(() => stop, [stop]);

  return { state, error, quality, start, stop, capture };
}

function mapCameraError(error: unknown): CameraErrorCode {
  const name = (error as DOMException)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'not_found';
  if (name === 'NotSupportedError' || name === 'NotReadableError') return 'unsupported';
  return 'unknown';
}

export { CAPTURE_QUALITY_THRESHOLDS };
