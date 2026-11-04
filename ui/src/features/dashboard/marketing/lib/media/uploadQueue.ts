/**
 * Upload queue for the media library: a framework-free store (so uploads survive the library
 * panel closing and are unit-testable) with bounded concurrency, cancel and retry.
 */

import { MarketingMediaApiError } from '@/features/dashboard/marketing/lib/media/marketingMediaApi';
import type {
  MarketingMediaAsset,
  MarketingMediaUsage,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import { PrepareError } from '@/features/dashboard/marketing/lib/media/prepareMarketingMedia';
import {
  isAbort,
  type UploadArgs,
  type UploadProgress,
  type UploadResult,
} from '@/features/dashboard/marketing/lib/media/uploadMarketingMedia';

export type UploadJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export type UploadJobError = {
  message: string;
  code?: string;
  /** Plan limit: offer the upgrade modal. */
  upgradeHook: boolean;
};

export type UploadJob = {
  id: string;
  propertyId: string;
  file: File;
  status: UploadJobStatus;
  stage: UploadProgress['stage'] | null;
  /** 0..1 within the current stage. */
  fraction: number;
  error: UploadJobError | null;
  asset: MarketingMediaAsset | null;
  deduped: boolean;
};

export type UploadQueueOptions = {
  concurrency?: number;
  run: (args: UploadArgs) => Promise<UploadResult>;
  getUsage: (propertyId: string, signal: AbortSignal) => Promise<MarketingMediaUsage>;
};

type Listener = () => void;
type SettledListener = (job: UploadJob) => void;

export function describeUploadError(error: unknown): UploadJobError {
  if (error instanceof MarketingMediaApiError) {
    return { message: error.message, code: error.code, upgradeHook: error.upgradeHook };
  }
  if (error instanceof PrepareError) {
    const upgrade = error.code === 'too_long' || error.code === 'too_large';
    return { message: error.message, code: error.code, upgradeHook: upgrade };
  }
  if (error instanceof Error && error.message) {
    return { message: 'Something went wrong while uploading. Try again.', upgradeHook: false };
  }
  return { message: 'Something went wrong while uploading. Try again.', upgradeHook: false };
}

export class UploadQueue {
  private jobs: UploadJob[] = [];
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<Listener>();
  private readonly settledListeners = new Set<SettledListener>();
  private readonly concurrency: number;
  private counter = 0;

  constructor(private readonly options: UploadQueueOptions) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
  }

  // useSyncExternalStore contract: stable snapshot identity until something changes.
  getSnapshot = (): UploadJob[] => this.jobs;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onSettled(listener: SettledListener): () => void {
    this.settledListeners.add(listener);
    return () => this.settledListeners.delete(listener);
  }

  enqueue(propertyId: string, files: File[]): string[] {
    const created = files.map<UploadJob>((file) => ({
      id: `upload-${(this.counter += 1)}`,
      propertyId,
      file,
      status: 'queued',
      stage: null,
      fraction: 0,
      error: null,
      asset: null,
      deduped: false,
    }));
    this.jobs = [...this.jobs, ...created];
    this.emit();
    this.pump();
    return created.map((job) => job.id);
  }

  cancel(id: string): void {
    const job = this.find(id);
    if (!job) return;
    if (job.status === 'running') {
      this.controllers.get(id)?.abort();
    } else if (job.status === 'queued') {
      this.patch(id, { status: 'cancelled' });
    }
  }

  cancelAll(propertyId?: string): void {
    for (const job of this.jobs) {
      if (propertyId && job.propertyId !== propertyId) continue;
      this.cancel(job.id);
    }
  }

  retry(id: string): void {
    const job = this.find(id);
    if (!job || (job.status !== 'error' && job.status !== 'cancelled')) return;
    this.patch(id, { status: 'queued', stage: null, fraction: 0, error: null });
    this.pump();
  }

  /** Drop finished, failed and cancelled rows (keeps queued and running). */
  clearFinished(propertyId?: string): void {
    this.jobs = this.jobs.filter(
      (job) =>
        (propertyId && job.propertyId !== propertyId) ||
        job.status === 'queued' ||
        job.status === 'running'
    );
    this.emit();
  }

  /** Remove one row (dismissing an error or a finished upload). */
  dismiss(id: string): void {
    const job = this.find(id);
    if (!job || job.status === 'running') return;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.emit();
  }

  private find(id: string): UploadJob | undefined {
    return this.jobs.find((job) => job.id === id);
  }

  private patch(id: string, patch: Partial<UploadJob>): void {
    this.jobs = this.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job));
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private pump(): void {
    const running = this.jobs.filter((job) => job.status === 'running').length;
    const slots = this.concurrency - running;
    if (slots <= 0) return;
    const next = this.jobs.filter((job) => job.status === 'queued').slice(0, slots);
    for (const job of next) {
      this.patch(job.id, { status: 'running', stage: 'preparing', fraction: 0, error: null });
      void this.execute(job.id);
    }
  }

  private async execute(id: string): Promise<void> {
    const job = this.find(id);
    if (!job) return;
    const controller = new AbortController();
    this.controllers.set(id, controller);
    try {
      const usage = await this.options.getUsage(job.propertyId, controller.signal);
      // Uploads ahead of this one (same property, still in flight) are not in the server's count
      // yet. Counting only earlier jobs keeps two parallel uploads from rejecting each other when
      // exactly one slot is left.
      const myIndex = this.jobs.findIndex((j) => j.id === id);
      const ahead = this.jobs.filter(
        (j, index) => index < myIndex && j.propertyId === job.propertyId && j.status === 'running'
      );
      const result = await this.options.run({
        propertyId: job.propertyId,
        file: job.file,
        usage,
        pending: { files: ahead.length, bytes: ahead.reduce((n, j) => n + j.file.size, 0) },
        signal: controller.signal,
        onProgress: (progress) => {
          if (this.find(id)?.status === 'running') {
            this.patch(id, { stage: progress.stage, fraction: progress.fraction });
          }
        },
      });
      this.patch(id, {
        status: 'done',
        stage: null,
        fraction: 1,
        asset: result.asset,
        deduped: result.deduped,
      });
    } catch (error) {
      if (isAbort(error) || controller.signal.aborted) {
        this.patch(id, { status: 'cancelled', stage: null, fraction: 0 });
      } else {
        this.patch(id, { status: 'error', stage: null, error: describeUploadError(error) });
      }
    } finally {
      this.controllers.delete(id);
      const settled = this.find(id);
      if (settled) for (const listener of this.settledListeners) listener(settled);
      this.pump();
    }
  }
}
