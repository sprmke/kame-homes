import { describe, expect, it, vi } from 'vitest';

import { MarketingMediaApiError } from '@/features/dashboard/marketing/lib/media/marketingMediaApi';
import type { MarketingMediaAsset } from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import { PrepareError } from '@/features/dashboard/marketing/lib/media/prepareMarketingMedia';
import {
  describeUploadError,
  UploadQueue,
} from '@/features/dashboard/marketing/lib/media/uploadQueue';
import { DEFAULT_PLAN_FEATURES } from '@/features/dashboard/plans/lib/planFeatures';

const usage = {
  usedBytes: 0,
  files: 0,
  uploadsToday: 0,
  limits: DEFAULT_PLAN_FEATURES.marketingMediaLibrary,
};
const asset = (id: string): MarketingMediaAsset => ({
  id,
  kind: 'image',
  source: 'upload',
  fileName: id,
  mimeType: 'image/png',
  url: `https://x/${id}`,
  posterUrl: null,
  sizeBytes: 1,
  width: 1,
  height: 1,
  durationMs: null,
  peaks: null,
  createdAt: '2026-11-01T00:00:00Z',
});
const f = (name: string) => new File([new Uint8Array(10)], name, { type: 'image/png' });

/** A runner whose promises the test settles by hand. */
function controllable() {
  const calls: Array<{
    file: File;
    resolve: (a: MarketingMediaAsset) => void;
    reject: (e: unknown) => void;
    signal: AbortSignal;
    args: any;
  }> = [];
  const run = vi.fn(
    (args: any) =>
      new Promise<any>((resolve, reject) => {
        calls.push({
          file: args.file,
          args,
          signal: args.signal,
          resolve: (a) => resolve({ asset: a, deduped: false }),
          reject,
        });
        args.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      })
  );
  return { run, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('UploadQueue', () => {
  it('runs at most N uploads at once and starts the next when one finishes', async () => {
    const { run, calls } = controllable();
    const q = new UploadQueue({ concurrency: 2, run, getUsage: async () => usage });
    q.enqueue('p', [f('a'), f('b'), f('c')]);
    await tick();
    expect(calls.map((c) => c.file.name)).toEqual(['a', 'b']);
    expect(q.getSnapshot().map((j) => j.status)).toEqual(['running', 'running', 'queued']);
    calls[0]!.resolve(asset('a'));
    await tick();
    expect(calls.map((c) => c.file.name)).toEqual(['a', 'b', 'c']);
    expect(q.getSnapshot()[0]).toMatchObject({ status: 'done', fraction: 1 });
    expect(q.getSnapshot()[0]!.asset?.id).toBe('a');
  });

  it('tells each job about the uploads ahead of it for the local limit check', async () => {
    const { run, calls } = controllable();
    const q = new UploadQueue({ concurrency: 2, run, getUsage: async () => usage });
    q.enqueue('p', [f('a'), f('b')]);
    await tick();
    expect(calls[0]!.args.pending).toEqual({ files: 0, bytes: 0 });
    expect(calls[1]!.args.pending).toEqual({ files: 1, bytes: 10 });
  });

  it('records progress only while running and emits stable snapshots', async () => {
    const { run, calls } = controllable();
    const q = new UploadQueue({ run, getUsage: async () => usage });
    const listener = vi.fn();
    q.subscribe(listener);
    const first = q.getSnapshot();
    q.enqueue('p', [f('a')]);
    await tick();
    expect(q.getSnapshot()).not.toBe(first);
    const stable = q.getSnapshot();
    expect(q.getSnapshot()).toBe(stable);
    calls[0]!.args.onProgress({ stage: 'uploading', fraction: 0.4 });
    expect(q.getSnapshot()[0]).toMatchObject({ stage: 'uploading', fraction: 0.4 });
    expect(listener).toHaveBeenCalled();
  });

  it('cancels queued jobs immediately and running jobs through the abort signal', async () => {
    const { run, calls } = controllable();
    const q = new UploadQueue({ concurrency: 1, run, getUsage: async () => usage });
    const [a, b] = q.enqueue('p', [f('a'), f('b')]);
    await tick();
    q.cancel(b!);
    expect(q.getSnapshot()[1]!.status).toBe('cancelled');
    q.cancel(a!);
    await tick();
    expect(calls[0]!.signal.aborted).toBe(true);
    expect(q.getSnapshot()[0]).toMatchObject({ status: 'cancelled', fraction: 0 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps failed jobs, explains plan limits, and can retry', async () => {
    const { run, calls } = controllable();
    const q = new UploadQueue({ run, getUsage: async () => usage });
    const settled = vi.fn();
    q.onSettled(settled);
    const [id] = q.enqueue('p', [f('a')]);
    await tick();
    calls[0]!.reject(
      new MarketingMediaApiError(
        "You've used all 100 MB of media storage. Delete files or upgrade.",
        403,
        'storage_full',
        true
      )
    );
    await tick();
    expect(q.getSnapshot()[0]).toMatchObject({
      status: 'error',
      error: { code: 'storage_full', upgradeHook: true },
    });
    expect(settled).toHaveBeenCalledTimes(1);

    q.retry(id!);
    await tick();
    expect(q.getSnapshot()[0]).toMatchObject({ status: 'running', error: null });
    calls[1]!.resolve(asset('a'));
    await tick();
    expect(q.getSnapshot()[0]!.status).toBe('done');
    q.retry(id!); // finished jobs cannot be retried
    expect(q.getSnapshot()[0]!.status).toBe('done');
  });

  it('a failing usage lookup fails only that job and does not stall the queue', async () => {
    const { run, calls } = controllable();
    let n = 0;
    const q = new UploadQueue({
      concurrency: 1,
      run,
      getUsage: async () => {
        n += 1;
        if (n === 1) throw new Error('offline');
        return usage;
      },
    });
    q.enqueue('p', [f('a'), f('b')]);
    await tick();
    await tick();
    expect(q.getSnapshot()[0]!.status).toBe('error');
    expect(calls.map((c) => c.file.name)).toEqual(['b']);
  });

  it('clears and dismisses only finished rows, and scopes by property', async () => {
    const { run, calls } = controllable();
    const q = new UploadQueue({ concurrency: 1, run, getUsage: async () => usage });
    q.enqueue('p1', [f('a')]);
    q.enqueue('p2', [f('b')]);
    await tick();
    calls[0]!.resolve(asset('a'));
    await tick();
    q.clearFinished('p2');
    expect(q.getSnapshot()).toHaveLength(2);
    q.clearFinished('p1');
    expect(q.getSnapshot().map((j) => j.file.name)).toEqual(['b']);
    q.dismiss(q.getSnapshot()[0]!.id); // running: ignored
    expect(q.getSnapshot()).toHaveLength(1);
    q.cancelAll('p2');
    await tick();
    q.dismiss(q.getSnapshot()[0]!.id);
    expect(q.getSnapshot()).toHaveLength(0);
  });
});

describe('describeUploadError', () => {
  it('maps API, prepare and unknown errors to host-safe messages', () => {
    expect(
      describeUploadError(new MarketingMediaApiError('Too big', 403, 'file_too_large', true))
    ).toEqual({
      message: 'Too big',
      code: 'file_too_large',
      upgradeHook: true,
    });
    expect(describeUploadError(new PrepareError('too_long', 'Too long')).upgradeHook).toBe(true);
    expect(describeUploadError(new PrepareError('unreadable', 'Bad file')).upgradeHook).toBe(false);
    expect(describeUploadError(new Error('boom: stack trace at /secret/path'))).toEqual({
      message: 'Something went wrong while uploading. Try again.',
      upgradeHook: false,
    });
    expect(describeUploadError('x').upgradeHook).toBe(false);
  });
});
