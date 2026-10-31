/**
 * mediaTelemetry — thin sink for image-optimization outcomes.
 *
 * There is no product analytics channel wired into this app yet. This module
 * exists so `imageOptimization` has one call site to emit to; point
 * `emitMediaOptimization` at a real channel (PostHog / a `log-*` edge function /
 * etc.) when one exists. Until then it only `console.debug`s in dev so the
 * behaviour is observable during manual testing.
 *
 * Never include PII or image bytes in an event.
 */

export type MediaOptimizationPath =
  | 'optimized'
  | 'skipped'
  | 'passthrough-decode-fail'
  | 'passthrough-larger'
  | 'passthrough-nonimage'
  | 'passthrough-animated'
  | 'passthrough-disabled'
  | 'aborted'
  | 'error';

export interface MediaOptimizationEvent {
  surface: string;
  preset: string;
  path: MediaOptimizationPath;
  inputBytes: number;
  outputBytes: number;
  ratio: number;
  inputMime: string;
  outputMime: string;
  inputWidth: number | null;
  inputHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  durationMs: number;
  errorName?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

type Sink = (event: MediaOptimizationEvent) => void;

let sink: Sink | null = null;

/** Register the real analytics sink (call once at app bootstrap when available). */
export function setMediaTelemetrySink(next: Sink | null): void {
  sink = next;
}

export function emitMediaOptimization(event: MediaOptimizationEvent): void {
  try {
    if (sink) {
      sink(event);
      return;
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(
        `[media] ${event.surface} ${event.preset} → ${event.path} ` +
          `${formatKb(event.inputBytes)}→${formatKb(event.outputBytes)} ` +
          `(${Math.round(event.ratio * 100)}%, ${Math.round(event.durationMs)}ms)`
      );
    }
  } catch {
    // telemetry must never break an upload
  }
}

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
