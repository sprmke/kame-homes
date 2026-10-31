/**
 * optimizeQueue — a process-wide concurrency limiter for `optimizeImage`.
 *
 * Selecting 9 gallery photos at once must not spin up 9 simultaneous decode +
 * encode jobs (memory + CPU spike, especially on mobile). Every optimization in
 * the app goes through `runOptimize`, which caps parallelism to 2 on
 * memory-constrained / low-core devices and 3 otherwise.
 */

import {
  optimizeImage,
  type OptimizeOptions,
  type OptimizeResult,
} from '@/lib/media/imageOptimization';
import type { OptimizePreset } from '@/lib/media/imageOptimizationPlan';

function pickConcurrency(): number {
  if (typeof navigator === 'undefined') return 2;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if ((typeof mem === 'number' && mem <= 4) || (typeof cores === 'number' && cores <= 4)) {
    return 2;
  }
  return 3;
}

const MAX_CONCURRENT = pickConcurrency();

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

export async function runOptimize(
  file: File,
  preset: OptimizePreset,
  options: OptimizeOptions
): Promise<OptimizeResult> {
  await acquire();
  try {
    return await optimizeImage(file, preset, options);
  } finally {
    release();
  }
}

/** Test/diagnostic helper. */
export function getOptimizeConcurrency(): number {
  return MAX_CONCURRENT;
}
