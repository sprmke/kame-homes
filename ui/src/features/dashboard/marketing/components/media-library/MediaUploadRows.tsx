import { AlertCircle, Check, RotateCcw, X } from 'lucide-react';

import type { UploadJob } from '@/features/dashboard/marketing/lib/media/uploadQueue';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const STAGE_LABEL: Record<string, string> = {
  preparing: 'Preparing',
  hashing: 'Checking',
  reserving: 'Checking',
  uploading: 'Uploading',
  finishing: 'Finishing',
};

function statusText(job: UploadJob): string {
  switch (job.status) {
    case 'queued':
      return 'Waiting';
    case 'running':
      return STAGE_LABEL[job.stage ?? 'preparing'] ?? 'Working';
    case 'done':
      return job.deduped ? 'Already in your library' : 'Added';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return job.error?.message ?? 'Upload failed';
  }
}

type RowProps = {
  job: UploadJob;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  onUpgrade: () => void;
};

function UploadRow({ job, onCancel, onRetry, onDismiss, onUpgrade }: RowProps) {
  const busy = job.status === 'running' || job.status === 'queued';
  const percent = Math.round(job.fraction * 100);
  return (
    <li
      className={cn(
        'border-border flex items-center gap-2 rounded-lg border px-2.5 py-2',
        job.status === 'error' && 'border-red-500/40 bg-red-500/5'
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[13px] font-medium">{job.file.name}</p>
        {job.status === 'running' ? (
          <Progress value={percent} className="h-1" aria-label={`Uploading ${job.file.name}`} />
        ) : null}
        <p
          className={cn(
            'text-muted-foreground flex items-center gap-1 text-xs',
            job.status === 'error' && 'text-red-600'
          )}
          role={job.status === 'error' ? 'alert' : undefined}
        >
          {job.status === 'done' ? <Check className="size-3" aria-hidden /> : null}
          {job.status === 'error' ? <AlertCircle className="size-3 shrink-0" aria-hidden /> : null}
          <span className="truncate">
            {statusText(job)}
            {job.status === 'running' && job.stage === 'uploading' ? ` ${percent}%` : ''}
          </span>
        </p>
      </div>

      {job.status === 'error' && job.error?.upgradeHook ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={onUpgrade}
        >
          Upgrade
        </Button>
      ) : null}
      {job.status === 'error' || job.status === 'cancelled' ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11 shrink-0 lg:size-8"
          aria-label={`Retry ${job.file.name}`}
          onClick={() => onRetry(job.id)}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-11 shrink-0 lg:size-8"
        aria-label={busy ? `Cancel ${job.file.name}` : `Dismiss ${job.file.name}`}
        onClick={() => (busy ? onCancel(job.id) : onDismiss(job.id))}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

export function MediaUploadRows({
  jobs,
  ...handlers
}: { jobs: UploadJob[] } & Omit<RowProps, 'job'>) {
  if (jobs.length === 0) return null;
  return (
    <ul className="space-y-1.5" aria-label="Uploads">
      {jobs.map((job) => (
        <UploadRow key={job.id} job={job} {...handlers} />
      ))}
    </ul>
  );
}
