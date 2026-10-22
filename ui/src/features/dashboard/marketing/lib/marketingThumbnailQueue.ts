import { whenMarketingRendersAllowed } from '@/features/dashboard/marketing/lib/marketingRenderGate';

let globalRenderLock: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` after acquiring the single global heavy-render slot shared by
 * every marketing thumbnail render path (Konva/Polotno, Remotion, html-to-image
 * captures are all expensive). Multiple independent call sites — e.g. a
 * background "pre-warm other categories" effect and the visible template
 * grid's own render queue — must never run these concurrently, or they
 * contend for the main thread/GPU and each stalls the other, which reads as
 * "thumbnails aren't rendering" even though both are technically working.
 */
export function withGlobalRenderSlot<T>(task: () => Promise<T>): Promise<T> {
  // Never start a heavy render while the host is dragging, typing or playing video.
  const gated = () => whenMarketingRendersAllowed().then(task);
  const run = globalRenderLock.then(gated, gated);
  globalRenderLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current === undefined) continue;
      await withGlobalRenderSlot(() => worker(current));
    }
  });

  await Promise.all(runners);
}
