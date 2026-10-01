import { useState } from 'react';

import {
  AlertTriangle,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Send,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AiStudioGeneratingStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage';
import { AiStudioVideoProgress } from '@/features/dashboard/marketing/components/ai-studio/AiStudioVideoProgress';
import { MarketingResetConfirmDialog } from '@/features/dashboard/marketing/components/shared/MarketingResetConfirmDialog';
import { useMarketingGenerationJob } from '@/features/dashboard/marketing/hooks/useMarketingGenerationJob';
import { useDeleteMarketingGeneration } from '@/features/dashboard/marketing/hooks/useMarketingGenerations';
import { splitGenerationPrompt } from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  META_REELS_SIZE_WARNING_BYTES,
  formatOutputSize,
  generationErrorMessage,
  generationStatusLabel,
  isGenerationInFlight,
} from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
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

const ACTION_BUTTON = 'min-h-11 sm:min-h-9';

/**
 * One generated photo or clip. The result is the hero; Publish and Download sit
 * under it, and the follow-ups (edit, reuse, delete) live in one overflow menu.
 */
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteGeneration = useDeleteMarketingGeneration();

  const inFlight = isGenerationInFlight(job);
  const failed = !job.outputUrl && !inFlight;
  const isImage = job.mediaType === 'image';
  const kind = isImage ? 'photo' : 'video';
  const { description, look } = splitGenerationPrompt(job.prompt);
  const busy = refining || usingAsPhoto;
  const oversizedForReels = !isImage && (job.outputBytes ?? 0) > META_REELS_SIZE_WARNING_BYTES;
  const canReuseImage = canGenerate && !inFlight && isImage && Boolean(job.outputUrl);

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
      toast.success('Description copied');
    } catch {
      toast.error('Could not copy the description');
    }
  };

  const reuseActions: ResponsiveOverflowAction[] = [
    {
      key: 'refine',
      label: 'Edit this photo',
      icon: <Wand2 className="size-4" aria-hidden />,
      disabled: !canReuseImage || !onRefine || busy,
      onSelect: () => onRefine?.(job),
    },
    {
      key: 'retry',
      label: 'Use these settings',
      icon: <RotateCcw className="size-4" aria-hidden />,
      disabled: !canGenerate || inFlight || failed || !onRetry,
      onSelect: () => onRetry?.(job),
    },
    {
      key: 'use-photo',
      label: 'Add to my photos',
      icon: <ImagePlus className="size-4" aria-hidden />,
      disabled: !canReuseImage || !onUseAsPhoto || busy,
      onSelect: () => onUseAsPhoto?.(job),
    },
    {
      key: 'copy',
      label: 'Copy improved description',
      icon: <Copy className="size-4" aria-hidden />,
      disabled: !job.promptEnhanced || !job.enhancedPrompt,
      onSelect: () => void handleCopyEnhancedPrompt(),
    },
  ];
  const deleteActions: ResponsiveOverflowAction[] = [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="size-4" aria-hidden />,
      destructive: true,
      disabled: !canDelete || inFlight || deleteGeneration.isPending,
      onSelect: () => setConfirmDelete(true),
    },
  ];

  return (
    <article className="border-border/70 bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm">
      <div className="bg-muted/40 relative flex aspect-square items-center justify-center overflow-hidden">
        {job.outputUrl && isImage && (
          <img
            src={job.outputUrl}
            alt={description}
            loading="lazy"
            className="size-full object-cover"
          />
        )}
        {job.outputUrl && !isImage && (
          <video src={job.outputUrl} controls playsInline className="size-full object-cover" />
        )}
        {!job.outputUrl && inFlight && !isImage && <AiStudioVideoProgress job={job} />}
        {!job.outputUrl && inFlight && isImage && (
          <AiStudioGeneratingStage
            variant="card"
            mediaType="image"
            className="absolute inset-0 rounded-none border-0"
          />
        )}
        {failed && (
          <div className="flex max-w-[16rem] flex-col items-center gap-2 p-4 text-center">
            <span className="bg-warning/15 text-warning flex size-9 items-center justify-center rounded-full">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
            <span className="text-foreground text-sm font-medium">Not generated</span>
            <span className="text-muted-foreground text-xs">{generationErrorMessage(job)}</span>
          </div>
        )}
        {busy && (
          <div
            role="status"
            className="bg-background/70 absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium backdrop-blur-[2px]"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {refining ? 'Opening in the form' : 'Adding to your photos'}
          </div>
        )}
        {job.outputUrl && (
          <span className="bg-background/90 text-foreground absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
            {job.aspectRatio}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <p className="text-foreground line-clamp-2 text-[13px] leading-snug" title={description}>
          {description}
        </p>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {look && (
            <span className="bg-muted text-foreground rounded-full px-2 py-0.5 font-medium">
              {look.title}
            </span>
          )}
          <span>{generationStatusLabel(job)}</span>
          {job.creditsConsumed != null && (
            <span className="tabular-nums">{job.creditsConsumed} credits</span>
          )}
          {formatOutputSize(job.outputBytes) && (
            <span className="tabular-nums">{formatOutputSize(job.outputBytes)}</span>
          )}
        </div>

        {oversizedForReels && (
          <p className="text-xs text-amber-700 dark:text-amber-500">Over 8 MB. Meta may reject this as a Reel.</p>
        )}

        <div className="mt-auto flex items-center gap-1.5 pt-0.5">
          {job.outputUrl && canPublish && (
            <Button
              size="sm"
              className={`${ACTION_BUTTON} flex-1`}
              disabled={publishing}
              onClick={() => void handlePublish()}
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Publish
            </Button>
          )}
          {job.outputUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className={
                canPublish ? `${ACTION_BUTTON} min-w-11 px-0 sm:min-w-9` : `${ACTION_BUTTON} flex-1`
              }
            >
              <a
                href={job.outputUrl}
                target="_blank"
                rel="noreferrer"
                download
                aria-label={`Download ${kind}`}
              >
                <Download className="size-4" aria-hidden />
                {!canPublish && 'Download'}
              </a>
            </Button>
          )}
          {failed && canGenerate && onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${ACTION_BUTTON} flex-1`}
              onClick={() => onRetry(job)}
            >
              <RotateCcw className="size-4" aria-hidden />
              Try again
            </Button>
          )}
          <div className={job.outputUrl || (failed && canGenerate) ? undefined : 'ml-auto'}>
            <ResponsiveOverflowMenu
              label={`More actions for this ${kind}`}
              sheetTitle={isImage ? 'Photo' : 'Video'}
              actionGroups={[reuseActions, deleteActions]}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`${ACTION_BUTTON} min-w-11 px-0 sm:min-w-9`}
                  aria-label={`More actions for this ${kind}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <MarketingResetConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete this ${kind}?`}
        description="It is removed from your gallery. Posts you already published stay up."
        confirmLabel="Delete"
        onConfirm={() => deleteGeneration.mutate(job.id)}
      />
    </article>
  );
}
