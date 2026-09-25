import { useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { AiStudioComposer } from '@/features/dashboard/marketing/components/ai-studio/AiStudioComposer';
import { AiStudioEmptyState } from '@/features/dashboard/marketing/components/ai-studio/AiStudioEmptyState';
import { AiStudioGeneratingStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage';
import { AiStudioResultsGrid } from '@/features/dashboard/marketing/components/ai-studio/AiStudioResultsGrid';
import { useGenerateMarketingMedia } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import {
  useMarketingGenerationReferences,
  useUploadMarketingGenerationReference,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationReferences';
import { useMarketingGenerations } from '@/features/dashboard/marketing/hooks/useMarketingGenerations';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  composerValuesFromJob,
  fileNameForGeneratedReference,
  type AiStudioComposerDraft,
} from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import { maxReferencesForTier } from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import { isGenerationInFlight } from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
import type {
  MarketingGenerationJob,
  MarketingGenerationReference,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { featureGateCopy } from '@/features/dashboard/plans/lib/featureGateCopy';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Button } from '@/components/ui/button';

const IMAGE_FEATURE = 'aiMarketingImageGeneration' as const;
const VIDEO_FEATURE = 'aiMarketingVideoGeneration' as const;

type Props = {
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
};

/**
 * Generate tab — results are the hero (gallery / generating stage). Composer is the
 * control rail. Plan gate covers the composer only so a downgraded org keeps past assets.
 */
export function AiStudioSection({ onPublish }: Props) {
  const { canGenerate, canGenerateVideo, canPublish } = useMarketingPermissions();
  const { allowed: imageAllowed, isLoading: imageGateLoading } = useFeatureGate(IMAGE_FEATURE);
  const { allowed: videoAllowed, isLoading: videoGateLoading } = useFeatureGate(VIDEO_FEATURE);
  const generate = useGenerateMarketingMedia();
  const generations = useMarketingGenerations();
  const libraryQuery = useMarketingGenerationReferences();
  const uploadReference = useUploadMarketingGenerationReference();

  const [draft, setDraft] = useState<AiStudioComposerDraft | null>(null);
  const [pendingReference, setPendingReference] = useState<{
    id: number;
    reference: MarketingGenerationReference;
  } | null>(null);
  const [usingAsPhotoJobId, setUsingAsPhotoJobId] = useState<string | null>(null);
  const [refiningJobId, setRefiningJobId] = useState<string | null>(null);
  const draftSeq = useRef(0);
  const photoSeq = useRef(0);

  const jobs = useMemo(
    () => generations.data?.pages.flatMap((page) => page.jobs) ?? [],
    [generations.data]
  );
  const allowPremiumImage = Boolean(generations.data?.pages[0]?.allowPremiumImage);
  const allowPremiumVideo = Boolean(generations.data?.pages[0]?.allowPremiumVideo);
  const library = libraryQuery.data ?? [];
  const videoPlanAllowed = videoGateLoading ? true : videoAllowed;

  const pendingMediaType = generate.variables?.mediaType ?? 'image';
  const hasInFlightJob = jobs.some((job) => isGenerationInFlight(job) && !job.outputUrl);
  const showPendingCard = generate.isPending && !hasInFlightJob;

  const scrollToComposer = () => {
    document.getElementById('ai-studio-composer')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleRetry = (job: MarketingGenerationJob) => {
    draftSeq.current += 1;
    setDraft({
      id: draftSeq.current,
      values: composerValuesFromJob(job, library, {
        allowPremium: job.mediaType === 'video' ? allowPremiumVideo : allowPremiumImage,
        allowHighResolution: videoPlanAllowed,
      }),
    });
    scrollToComposer();
  };

  /** Shared by Use photo and Refine — both need the completed output uploaded into
   *  the reference library before it can be attached to a new generation. */
  const uploadJobOutputAsReference = async (
    job: MarketingGenerationJob
  ): Promise<MarketingGenerationReference> => {
    if (!job.outputUrl) throw new Error('This generation has no output to reuse');
    const response = await fetch(job.outputUrl);
    if (!response.ok) throw new Error('Could not load the generated file');
    const blob = await response.blob();
    const file = new File([blob], fileNameForGeneratedReference(job), {
      type: blob.type || job.outputMimeType || 'image/jpeg',
    });
    return uploadReference.mutateAsync(file);
  };

  const handleUseAsPhoto = async (job: MarketingGenerationJob) => {
    if (!job.outputUrl || job.mediaType !== 'image') return;
    setUsingAsPhotoJobId(job.id);
    try {
      const reference = await uploadJobOutputAsReference(job);
      photoSeq.current += 1;
      setPendingReference({ id: photoSeq.current, reference });
      scrollToComposer();
    } catch (error) {
      toast.error((error as Error).message || 'Could not use that photo');
    } finally {
      setUsingAsPhotoJobId(null);
    }
  };

  /**
   * "Refine" — the closer of the two independent flows above to a reproducible
   * re-roll (Gemini's image endpoint has no `seed` parameter, so anchoring the next
   * generation to the exact output the host is refining, via the same inline-image
   * mechanism the reference-photo flow already uses, is the real available lever).
   * One action: restore the prompt/options into a fresh composer draft (same as
   * Retry) AND seed the completed image itself as a reference (same upload as Use
   * photo), so the host's next Generate is anchored to what they just got instead
   * of starting over from a bare prompt.
   */
  const handleRefine = async (job: MarketingGenerationJob) => {
    if (!job.outputUrl || job.mediaType !== 'image') return;
    setRefiningJobId(job.id);
    try {
      const reference = await uploadJobOutputAsReference(job);

      draftSeq.current += 1;
      const baseValues = composerValuesFromJob(job, library, {
        allowPremium: allowPremiumImage,
        allowHighResolution: videoPlanAllowed,
      });
      const cap = maxReferencesForTier(baseValues.qualityTier);
      setDraft({
        id: draftSeq.current,
        values: {
          ...baseValues,
          // Prefer the enhanced prompt the host actually got, when it ran — editing
          // from the fuller description is a better refine starting point than
          // re-typing the original shorthand. Falls back to the host's own prompt
          // when enhancement was off, skipped, or failed open (enhancedPrompt null).
          prompt: job.enhancedPrompt ?? job.prompt,
          references: [reference, ...baseValues.references].slice(0, cap),
        },
      });
      scrollToComposer();
    } catch (error) {
      toast.error((error as Error).message || 'Could not refine that generation');
    } finally {
      setRefiningJobId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4 lg:flex-row lg:gap-6 lg:overflow-hidden lg:p-6">
      <div className="lg:max-h-full lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto">
        <FloatingPanel
          padding="md"
          mobileOnly
          className="lg:border-border/60 lg:bg-card lg:rounded-2xl lg:border lg:p-5 lg:shadow-sm"
        >
          {imageGateLoading || imageAllowed ? (
            <>
              <AiStudioComposer
                onGenerate={(payload) => generate.mutate(payload)}
                isGenerating={generate.isPending}
                disabled={!canGenerate || imageGateLoading}
                canGenerateVideo={canGenerateVideo}
                videoAllowed={videoPlanAllowed}
                allowPremiumImage={allowPremiumImage}
                allowPremiumVideo={allowPremiumVideo}
                draft={draft}
                pendingReference={pendingReference}
              />
              {!canGenerate && (
                <p className="text-muted-foreground mt-3 text-xs">
                  You do not have permission to generate content for this property.
                </p>
              )}
            </>
          ) : (
            <AiStudioUpgradePrompt feature={IMAGE_FEATURE} />
          )}
        </FloatingPanel>
      </div>

      <div className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto">
        <AiStudioResultsGrid
          jobs={jobs}
          isLoading={generations.isLoading}
          hasNextPage={Boolean(generations.hasNextPage)}
          isFetchingNextPage={generations.isFetchingNextPage}
          onLoadMore={() => void generations.fetchNextPage()}
          canPublish={canPublish}
          canDelete={canGenerate}
          canGenerate={Boolean(canGenerate && (imageGateLoading || imageAllowed))}
          onPublish={onPublish}
          onRetry={handleRetry}
          onUseAsPhoto={(job) => void handleUseAsPhoto(job)}
          usingAsPhotoJobId={usingAsPhotoJobId}
          onRefine={(job) => void handleRefine(job)}
          refiningJobId={refiningJobId}
          pendingStage={
            showPendingCard ? (
              <AiStudioGeneratingStage variant="card" mediaType={pendingMediaType} />
            ) : null
          }
          emptyState={
            generate.isPending ? (
              <AiStudioGeneratingStage variant="hero" mediaType={pendingMediaType} />
            ) : (
              <AiStudioEmptyState />
            )
          }
        />
      </div>
    </div>
  );
}

function AiStudioUpgradePrompt({ feature }: { feature: typeof IMAGE_FEATURE }) {
  const { open: openUpgradeModal } = useUpgradeModal();
  const copy = featureGateCopy(feature);

  return (
    <div className="py-6 text-center">
      <p className="text-foreground text-sm font-semibold">{copy.title}</p>
      <p className="text-caption mx-auto mt-1 max-w-sm">
        <PlanGatedText text={copy.description} feature={feature} />
      </p>
      <Button className="mt-4 min-h-[44px]" onClick={() => openUpgradeModal(feature)}>
        {copy.ctaLabel}
      </Button>
    </div>
  );
}
