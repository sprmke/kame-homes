import { useMemo } from 'react';

import { AiStudioComposer } from '@/features/dashboard/marketing/components/ai-studio/AiStudioComposer';
import { AiStudioEmptyState } from '@/features/dashboard/marketing/components/ai-studio/AiStudioEmptyState';
import { AiStudioGeneratingStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage';
import { AiStudioResultsGrid } from '@/features/dashboard/marketing/components/ai-studio/AiStudioResultsGrid';
import { useGenerateMarketingMedia } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import { useMarketingGenerations } from '@/features/dashboard/marketing/hooks/useMarketingGenerations';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { isGenerationInFlight } from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
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

  const jobs = useMemo(
    () => generations.data?.pages.flatMap((page) => page.jobs) ?? [],
    [generations.data]
  );

  const pendingMediaType = generate.variables?.mediaType ?? 'image';
  const hasInFlightJob = jobs.some((job) => isGenerationInFlight(job) && !job.outputUrl);
  const showPendingCard = generate.isPending && !hasInFlightJob;

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
                videoAllowed={videoGateLoading ? true : videoAllowed}
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
          onPublish={onPublish}
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
