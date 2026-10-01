import { useMemo, useRef, useState } from 'react';

import { Clapperboard, ImageIcon, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';

import { AiPostPanel } from '@/features/dashboard/marketing/components/ai-studio/AiPostPanel';
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
  MarketingGenerationMediaType,
  MarketingGenerationReference,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { SegmentedControl } from '@/components/ui/sliding-tabs';

type Props = {
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
  /** AI Post "Edit": open the saved poster in the Design tab. */
  onOpenInDesign: (templateId: string) => void;
};

type GenerateMode = 'post' | MarketingGenerationMediaType;

const MODE_OPTIONS = [
  { value: 'post' as const, label: 'AI Post', icon: LayoutTemplate },
  { value: 'image' as const, label: 'Photo', icon: ImageIcon },
  { value: 'video' as const, label: 'Video', icon: Clapperboard },
];

/**
 * Generate tab. One switch picks what to make: a finished post from listing photos,
 * a new photo, or a short video. Photo and Video share the composer (left rail on
 * `lg+`) and a gallery filtered to that media type. The plan gate lives on Generate
 * only, so a downgraded org keeps past output.
 */
export function AiStudioSection({ onPublish, onOpenInDesign }: Props) {
  const propertyId = usePropertyIdParam();
  const { allowed: postAllowed, isLoading: postGateLoading } =
    useFeatureGate('aiMarketingGeneration');
  const { canGenerateImage, canGenerateVideo, canPublish } = useMarketingPermissions();
  const canGenerate = canGenerateImage || canGenerateVideo;
  const { allowed: imageAllowed, isLoading: imageGateLoading } = useFeatureGate(
    'aiMarketingImageGeneration'
  );
  const { allowed: videoAllowed, isLoading: videoGateLoading } = useFeatureGate(
    'aiMarketingVideoGeneration'
  );

  // AI Post is the default when the plan includes it (Business+). Pro hosts land on
  // Photo, and a video-only role lands on Video instead of a form it cannot submit.
  const [chosenMode, setChosenMode] = useState<GenerateMode | null>(null);
  const defaultMode: GenerateMode =
    postGateLoading || postAllowed
      ? 'post'
      : !canGenerateImage && canGenerateVideo
        ? 'video'
        : 'image';
  const mode = chosenMode ?? defaultMode;
  const mediaType: MarketingGenerationMediaType = mode === 'video' ? 'video' : 'image';

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

  const allJobs = useMemo(
    () => generations.data?.pages.flatMap((page) => page.jobs) ?? [],
    [generations.data]
  );
  const jobs = useMemo(
    () => allJobs.filter((job) => job.mediaType === mediaType),
    [allJobs, mediaType]
  );
  const allowPremiumImage = Boolean(generations.data?.pages[0]?.allowPremiumImage);
  const allowPremiumVideo = Boolean(generations.data?.pages[0]?.allowPremiumVideo);
  const library = libraryQuery.data ?? [];
  const videoPlanAllowed = videoGateLoading ? true : videoAllowed;

  const pendingMediaType = generate.variables?.mediaType ?? mediaType;
  const pendingHere = generate.isPending && pendingMediaType === mediaType;
  const hasInFlightJob = jobs.some((job) => isGenerationInFlight(job) && !job.outputUrl);
  const showPendingCard = pendingHere && !hasInFlightJob;

  const canGenerateHere = mediaType === 'video' ? canGenerateVideo : canGenerateImage;
  const gateLoading = mediaType === 'video' ? videoGateLoading : imageGateLoading;
  const planAllowed = mediaType === 'video' ? videoPlanAllowed : imageAllowed;

  const changeMode = (next: GenerateMode) => {
    setChosenMode(next);
    // A remounted composer must not replay an old Retry / Use photo.
    if (next === 'post') {
      setDraft(null);
      setPendingReference(null);
    }
  };

  const focusComposer = () => {
    document.getElementById('ai-studio-composer')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleRetry = (job: MarketingGenerationJob) => {
    draftSeq.current += 1;
    setChosenMode(job.mediaType);
    setDraft({
      id: draftSeq.current,
      values: composerValuesFromJob(job, library, {
        allowPremium: job.mediaType === 'video' ? allowPremiumVideo : allowPremiumImage,
        allowHighResolution: videoPlanAllowed,
      }),
    });
    focusComposer();
  };

  /** Shared by Add to my photos and Edit this photo: both need the output in the
   *  reference library before it can be attached to a new generation. */
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
      toast.success('Added to Your photos');
      focusComposer();
    } catch (error) {
      toast.error((error as Error).message || 'Could not add that photo');
    } finally {
      setUsingAsPhotoJobId(null);
    }
  };

  /**
   * "Edit this photo" — Gemini's image endpoint has no seed, so the real lever for a
   * controlled change is anchoring the next run to this exact output. Restores the
   * host's description, look and settings, and attaches the image itself as the
   * first photo, so the host only types what should change.
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
      setChosenMode('image');
      setDraft({
        id: draftSeq.current,
        values: {
          ...baseValues,
          references: [reference, ...baseValues.references].slice(0, cap),
        },
      });
      focusComposer();
    } catch (error) {
      toast.error((error as Error).message || 'Could not open that photo');
    } finally {
      setRefiningJobId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4 lg:overflow-hidden lg:p-6">
      <SegmentedControl
        value={mode}
        onChange={changeMode}
        options={MODE_OPTIONS}
        aria-label="What to generate"
        className="w-full sm:w-auto sm:self-start"
        listClassName="w-full sm:w-auto"
        equalSegments
      />
      {mode === 'post' ? (
        <AiPostPanel
          // Remount per property: posters (and their Edit target) never carry across.
          key={propertyId ?? 'property'}
          onOpenInDesign={onOpenInDesign}
          onPublish={onPublish}
          canPublish={canPublish}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6 lg:overflow-hidden">
          <div className="lg:max-h-full lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto">
            <FloatingPanel
              padding="md"
              mobileOnly
              className="lg:border-border/60 lg:bg-card lg:rounded-2xl lg:border lg:p-5 lg:shadow-sm"
            >
              {!canGenerateHere && (
                <p className="bg-muted/60 text-muted-foreground mb-4 rounded-lg px-3 py-2 text-xs">
                  You do not have permission to generate{' '}
                  {mediaType === 'video' ? 'videos' : 'photos'} for this property.
                </p>
              )}
              <AiStudioComposer
                mediaType={mediaType}
                onGenerate={(payload) => generate.mutate(payload)}
                isGenerating={generate.isPending}
                disabled={!canGenerateHere || gateLoading}
                planAllowed={planAllowed}
                allowPremium={mediaType === 'video' ? allowPremiumVideo : allowPremiumImage}
                allowHighResolution={videoPlanAllowed}
                draft={draft}
                pendingReference={pendingReference}
              />
            </FloatingPanel>
          </div>

          <section
            aria-labelledby="ai-studio-gallery-title"
            className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto"
          >
            <h2 id="ai-studio-gallery-title" className="text-section-title mb-3">
              {mediaType === 'video' ? 'Your videos' : 'Your photos'}
            </h2>
            <AiStudioResultsGrid
              jobs={jobs}
              isLoading={generations.isLoading}
              hasNextPage={Boolean(generations.hasNextPage)}
              isFetchingNextPage={generations.isFetchingNextPage}
              onLoadMore={() => void generations.fetchNextPage()}
              canPublish={canPublish}
              canDelete={canGenerate}
              canGenerate={canGenerateHere}
              onPublish={onPublish}
              onRetry={handleRetry}
              onUseAsPhoto={(job) => void handleUseAsPhoto(job)}
              usingAsPhotoJobId={usingAsPhotoJobId}
              onRefine={(job) => void handleRefine(job)}
              refiningJobId={refiningJobId}
              pendingStage={
                showPendingCard ? (
                  <AiStudioGeneratingStage variant="card" mediaType={mediaType} />
                ) : null
              }
              emptyState={
                pendingHere ? (
                  <AiStudioGeneratingStage variant="hero" mediaType={mediaType} />
                ) : (
                  <AiStudioEmptyState kind={mediaType} />
                )
              }
            />
          </section>
        </div>
      )}
    </div>
  );
}
