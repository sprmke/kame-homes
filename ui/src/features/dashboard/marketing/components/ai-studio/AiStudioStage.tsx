import { useState } from 'react';

import { AlertTriangle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { AiStudioGeneratingStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage';
import type { AiPendingTurn } from '@/features/dashboard/marketing/components/ai-studio/AiStudioThread';
import {
  isVersionInFlight,
  versionAspect,
  type AiVersion,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import { generationErrorMessage } from '@/features/dashboard/marketing/lib/marketingGenerationProgress';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  version: AiVersion | null;
  /** A message on its way and nothing picked after it: the stage shows it coming. */
  pending: AiPendingTurn | null;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onRetry?: () => void;
  canRetry: boolean;
};

const REVEAL = 'transition-[filter,opacity] duration-500 ease-out motion-reduce:transition-none';

/**
 * The selected version, as large as the space allows, on a quiet backdrop. Its shape
 * is kept (story tall, landscape wide). Below: which version this is, with steppers.
 */
export function AiStudioStage({
  version,
  pending,
  total,
  onPrevious,
  onNext,
  onRetry,
  canRetry,
}: Props) {
  const aspect = pending ? pending.aspect : version ? versionAspect(version) : '1 / 1';
  const [w, h] = aspect.split('/').map((part) => Number(part.trim()) || 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Contain-fit with container units: the frame keeps its shape in any space. */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 [container-type:size] sm:p-6">
        <div
          className="bg-card relative overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-12px_rgba(0,0,0,0.25)]"
          style={{
            aspectRatio: `${w} / ${h}`,
            width: `min(100cqw, calc(100cqh * ${w} / ${h}))`,
          }}
        >
          {pending ? (
            <AiStudioGeneratingStage
              variant="fill"
              mediaType={pending.output === 'video' ? 'video' : 'image'}
              label={
                pending.output === 'post'
                  ? pending.count > 1
                    ? 'Designing posts'
                    : 'Changing post'
                  : undefined
              }
            />
          ) : version ? (
            <VersionMedia key={version.key} version={version} onRetry={onRetry} canRetry={canRetry} />
          ) : null}
        </div>
      </div>
      {version && !pending && total > 0 ? (
        <div className="flex items-center justify-center gap-1 pb-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 lg:size-9"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous version"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="text-muted-foreground min-w-[6.5rem] text-center text-xs font-medium tabular-nums">
            Version {version.number} of {total}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 lg:size-9"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next version"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function VersionMedia({
  version,
  onRetry,
  canRetry,
}: {
  version: AiVersion;
  onRetry?: () => void;
  canRetry: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (version.kind === 'post') {
    return version.post.previewUrl ? (
      <img
        src={version.post.previewUrl}
        alt={`Version ${version.number}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn('size-full object-contain', REVEAL, !loaded && 'opacity-0 blur-sm')}
      />
    ) : (
      <AiStudioGeneratingStage variant="fill" label="Rendering post" />
    );
  }

  const job = version.job;
  if (isVersionInFlight(version)) {
    return <AiStudioGeneratingStage variant="fill" mediaType={job.mediaType} job={job} />;
  }
  if (!job.outputUrl) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="bg-warning/15 text-warning flex size-10 items-center justify-center rounded-full">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <p className="text-foreground text-sm font-medium">Not made</p>
        <p className="text-muted-foreground max-w-xs text-xs">{generationErrorMessage(job)}</p>
        {canRetry && onRetry ? (
          <Button type="button" variant="outline" className="min-h-[44px] gap-2" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
        ) : null}
      </div>
    );
  }
  if (job.mediaType === 'video') {
    return (
      <video
        src={job.outputUrl}
        poster={job.referenceUrls[0]}
        controls
        playsInline
        className="size-full bg-black object-contain"
      />
    );
  }
  return (
    <img
      src={job.outputUrl}
      alt={`Version ${version.number}`}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      className={cn('size-full object-contain', REVEAL, !loaded && 'opacity-0 blur-sm')}
    />
  );
}
