import { useState } from 'react';

import {
  Copy,
  Download,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  AlertTriangle,
  ImagePlus,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { AiStudioGeneratingStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage';
import { AiStudioVideoProgress } from '@/features/dashboard/marketing/components/ai-studio/AiStudioVideoProgress';
import { useMarketingGenerationJob } from '@/features/dashboard/marketing/hooks/useMarketingGenerationJob';
import { useDeleteMarketingGeneration } from '@/features/dashboard/marketing/hooks/useMarketingGenerations';
import {
  META_REELS_SIZE_WARNING_BYTES,
  formatOutputSize,
  generationErrorMessage,
  generationStatusLabel,
  isGenerationInFlight,
} from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Button } from '@/components/ui/button';

type Props = {
  job: MarketingGenerationJob;
  canPublish: boolean;
  canDelete: boolean;
  canGenerate?: boolean;
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
  onRetry?: (job: MarketingGenerationJob) => void;
  onUseAsPhoto?: (job: MarketingGenerationJob) => void;
  usingAsPhoto?: boolean;
  onRefine?: (job: MarketingGenerationJob) => void;
  refining?: boolean;
};

export function AiStudioJobCard({
  job: initialJob,
  canPublish,
  canDelete,
  canGenerate = false,
  onPublish,
  onRetry,
  onUseAsPhoto,
  usingAsPhoto = false,
  onRefine,
  refining = false,
}: Props) {
  const live = useMarketingGenerationJob(isGenerationInFlight(initialJob) ? initialJob.id : null);
  const job = live.data ?? initialJob;

  const [publishing, setPublishing] = useState(false);
  const deleteGeneration = useDeleteMarketingGeneration();

  const inFlight = isGenerationInFlight(job);
  const oversizedForReels =
    job.mediaType === 'video' && (job.outputBytes ?? 0) > META_REELS_SIZE_WARNING_BYTES;
  const showRetry = canGenerate && !inFlight && Boolean(onRetry);
  const showUseAsPhoto =
    canGenerate &&
    !inFlight &&
    job.mediaType === 'image' &&
    Boolean(job.outputUrl) &&
    Boolean(onUseAsPhoto);
  const showRefine =
    canGenerate &&
    !inFlight &&
    job.mediaType === 'image' &&
    Boolean(job.outputUrl) &&
    Boolean(onRefine);

  const handlePublish = async () => {
    if (!job.outputUrl) return;
    setPublishing(true);
    try {
      const response = await fetch(job.outputUrl);
      if (!response.ok) throw new Error('Could not load the generated file');
      onPublish({ blob: await response.blob(), mediaType: job.mediaType });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyEnhancedPrompt = async () => {
    if (!job.enhancedPrompt) return;
    try {
      await navigator.clipboard.writeText(job.enhancedPrompt);
      toast.success('Prompt copied');
    } catch {
      toast.error('Could not copy the prompt');
    }
  };

  return (
    <div className="border-border/70 bg-card overflow-hidden rounded-2xl border shadow-sm">
      <div className="bg-muted/40 relative flex aspect-square items-center justify-center overflow-hidden">
        {job.outputUrl && job.mediaType === 'image' && (
          <img
            src={job.outputUrl}
            alt={job.prompt}
            loading="lazy"
            className="size-full object-cover"
          />
        )}
        {job.outputUrl && job.mediaType === 'video' && (
          <video src={job.outputUrl} controls playsInline className="size-full object-cover" />
        )}
        {!job.outputUrl && inFlight && job.mediaType === 'video' && (
          <AiStudioVideoProgress job={job} />
        )}
        {!job.outputUrl && inFlight && job.mediaType === 'image' && (
          <AiStudioGeneratingStage
            variant="card"
            mediaType="image"
            className="absolute inset-0 rounded-none border-0"
          />
        )}
        {!job.outputUrl && !inFlight && (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-4 text-center">
            <AlertTriangle className="size-5" />
            <span className="text-xs">{generationErrorMessage(job)}</span>
          </div>
        )}

        {job.outputUrl && (
          <span className="bg-background/90 text-foreground absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium">
            {job.aspectRatio}
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <p className="text-foreground line-clamp-2 text-xs">{job.prompt}</p>

        {job.promptEnhanced && job.enhancedPrompt && (
          <EnhancedPromptDisclosure
            enhancedPrompt={job.enhancedPrompt}
            onCopy={() => void handleCopyEnhancedPrompt()}
          />
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span>{generationStatusLabel(job)}</span>
          {job.creditsConsumed != null && <span>{job.creditsConsumed} credits</span>}
          {formatOutputSize(job.outputBytes) && <span>{formatOutputSize(job.outputBytes)}</span>}
        </div>

        {oversizedForReels && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Over 8 MB. Meta may reject this as a Reel.
          </p>
        )}

        {job.outputUrl && (
          <div className="flex flex-wrap gap-1.5">
            <Button asChild variant="outline" size="sm" className="min-h-[44px] flex-1">
              <a href={job.outputUrl} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Download
              </a>
            </Button>
            {canPublish && (
              <Button
                size="sm"
                className="min-h-[44px] flex-1"
                disabled={publishing}
                onClick={() => void handlePublish()}
              >
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Publish
              </Button>
            )}
          </div>
        )}

        {(showRetry || showUseAsPhoto || showRefine) && (
          <div className="flex flex-wrap gap-1.5">
            {showRefine && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] flex-1"
                disabled={refining}
                onClick={() => onRefine?.(job)}
              >
                {refining ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Refine
              </Button>
            )}
            {showRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] flex-1"
                onClick={() => onRetry?.(job)}
              >
                <RotateCcw className="size-4" />
                Retry
              </Button>
            )}
            {showUseAsPhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] flex-1"
                disabled={usingAsPhoto}
                onClick={() => onUseAsPhoto?.(job)}
              >
                {usingAsPhoto ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                Use photo
              </Button>
            )}
          </div>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground min-h-[44px] w-full"
            disabled={deleteGeneration.isPending || inFlight}
            onClick={() => deleteGeneration.mutate(job.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Phase 6d transparency — shows the full scene description that actually reached
 * the image model when enhancement ran, so the host can see what changed and copy
 * it as a starting point. Collapsed by default: most hosts never need to look, and
 * a card-sized prompt block would dominate the layout otherwise.
 */
function EnhancedPromptDisclosure({
  enhancedPrompt,
  onCopy,
}: {
  enhancedPrompt: string;
  onCopy: () => void;
}) {
  return (
    <details className="group">
      <summary className="text-muted-foreground hover:text-foreground flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[11px] font-medium">
        <Sparkles className="size-3" />
        Enhanced prompt
      </summary>
      <div className="border-border/60 mt-1.5 space-y-1.5 rounded-lg border p-2">
        <p className="text-muted-foreground text-[11px] leading-relaxed">{enhancedPrompt}</p>
        <button
          type="button"
          onClick={onCopy}
          className="text-primary hover:text-primary/80 flex min-h-[44px] items-center gap-1 text-[11px] font-medium"
        >
          <Copy className="size-3" />
          Copy
        </button>
      </div>
    </details>
  );
}
