import { useEffect, useMemo, useState } from 'react';

import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { AiStudioAspectPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioAspectPicker';
import { AiStudioOptionsBar } from '@/features/dashboard/marketing/components/ai-studio/AiStudioOptionsBar';
import { AiStudioReferenceUploader } from '@/features/dashboard/marketing/components/ai-studio/AiStudioReferenceUploader';
import { AiStudioVideoOptionsBar } from '@/features/dashboard/marketing/components/ai-studio/AiStudioVideoOptionsBar';
import type { GenerateMarketingMediaPayload } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import type { AiStudioComposerDraft } from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import {
  IMAGE_PROMPT_STARTERS,
  IMAGE_SIZE_LABELS,
  VIDEO_DURATION_LABELS,
  VIDEO_MAX_REFERENCES,
  VIDEO_PROMPT_STARTERS,
  imageTierOptions,
  maxReferencesForTier,
  videoTierOptions,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_TIER,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
  MAX_IMAGE_PROMPT_CHARS,
  MAX_VIDEO_PROMPT_CHARS,
  estimateGenerationCredits,
  type ImageSize,
  type VideoDuration,
  type VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type {
  MarketingGenerationMediaType,
  MarketingGenerationReference,
  MarketingGenerationTier,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Props = {
  onGenerate: (payload: GenerateMarketingMediaPayload) => void;
  isGenerating: boolean;
  disabled?: boolean;
  canGenerateVideo: boolean;
  videoAllowed: boolean;
  allowPremiumImage?: boolean;
  allowPremiumVideo?: boolean;
  draft?: AiStudioComposerDraft | null;
  pendingReference?: { id: number; reference: MarketingGenerationReference } | null;
};

/**
 * Host path (Ideogram / Canva Magic pattern):
 * media → prompt → photos drop zone → shape chips → Generate.
 * Quality / size / length stay under Advanced.
 */
export function AiStudioComposer({
  onGenerate,
  isGenerating,
  disabled,
  canGenerateVideo,
  videoAllowed,
  allowPremiumImage = false,
  allowPremiumVideo = false,
  draft,
  pendingReference,
}: Props) {
  const { open: openUpgradeModal } = useUpgradeModal();
  const [mediaType, setMediaType] = useState<MarketingGenerationMediaType>('image');
  const [prompt, setPrompt] = useState('');
  const [tier, setTier] = useState<MarketingGenerationTier>(DEFAULT_TIER);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_IMAGE_ASPECT_RATIO);
  const [imageSize, setImageSize] = useState<ImageSize>(DEFAULT_IMAGE_SIZE);
  const [resolution, setResolution] = useState<VideoResolution>(DEFAULT_VIDEO_RESOLUTION);
  const [durationSeconds, setDurationSeconds] = useState<VideoDuration>(DEFAULT_VIDEO_DURATION);
  const [references, setReferences] = useState<MarketingGenerationReference[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const videoPermissionBlocked = !canGenerateVideo;
  const videoPlanBlocked = !videoAllowed;
  const isVideo = mediaType === 'video';
  const allowPremium = isVideo ? allowPremiumVideo : allowPremiumImage;
  const maxReferences = isVideo ? VIDEO_MAX_REFERENCES : maxReferencesForTier(tier);
  const maxPromptChars = isVideo ? MAX_VIDEO_PROMPT_CHARS : MAX_IMAGE_PROMPT_CHARS;
  const promptStarters = isVideo ? VIDEO_PROMPT_STARTERS : IMAGE_PROMPT_STARTERS;
  const promptPlaceholder = isVideo
    ? 'Slow pan across the living room at golden hour'
    : 'Balcony at golden hour with the skyline behind it';
  const qualityOptions = isVideo ? videoTierOptions(allowPremium) : imageTierOptions(allowPremium);

  const draftId = draft?.id;
  useEffect(() => {
    if (!draft) return;
    const values = draft.values;
    setMediaType(values.mediaType);
    setPrompt(values.prompt);
    setTier(values.qualityTier);
    setAspectRatio(values.aspectRatio);
    setImageSize(values.imageSize);
    setResolution(values.resolution);
    setDurationSeconds(values.durationSeconds);
    setReferences(values.references);
    setAdvancedOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft.id is the apply key
  }, [draftId]);

  const pendingReferenceId = pendingReference?.id;
  useEffect(() => {
    if (pendingReferenceId == null || !pendingReference) return;
    const incoming = pendingReference.reference;
    const cap = isVideo ? VIDEO_MAX_REFERENCES : maxReferencesForTier(tier);
    let blocked = false;
    setReferences((current) => {
      if (current.some((row) => row.id === incoming.id)) return current;
      if (current.length >= cap) {
        blocked = true;
        return current;
      }
      return [...current, incoming];
    });
    if (blocked) toast.error('Remove a photo first');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingReference.id is the apply key
  }, [pendingReferenceId]);

  useEffect(() => {
    if (!allowPremium && tier === 'premium') setTier(DEFAULT_TIER);
  }, [allowPremium, tier]);

  useEffect(() => {
    if (!videoAllowed && resolution === '1080p') setResolution(DEFAULT_VIDEO_RESOLUTION);
  }, [videoAllowed, resolution]);

  const credits = useMemo(() => {
    if (isVideo) {
      return estimateGenerationCredits({ mediaType: 'video', tier, resolution, durationSeconds });
    }
    return estimateGenerationCredits({ mediaType: 'image', tier, imageSize });
  }, [isVideo, tier, resolution, durationSeconds, imageSize]);

  const advancedSummary = useMemo(() => {
    if (isVideo) {
      const quality = qualityOptions.find((option) => option.value === tier)?.label ?? tier;
      return `${quality} · ${VIDEO_DURATION_LABELS[durationSeconds]}`;
    }
    const quality = qualityOptions.find((option) => option.value === tier)?.label ?? tier;
    return `${quality} · ${IMAGE_SIZE_LABELS[imageSize]}`;
  }, [isVideo, qualityOptions, tier, durationSeconds, imageSize]);

  const applyMediaType = (next: MarketingGenerationMediaType) => {
    setMediaType(next);
    setTier(DEFAULT_TIER);
    setAspectRatio(next === 'video' ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO);
    setImageSize(DEFAULT_IMAGE_SIZE);
    setResolution(DEFAULT_VIDEO_RESOLUTION);
    setDurationSeconds(DEFAULT_VIDEO_DURATION);
    const cap = next === 'video' ? VIDEO_MAX_REFERENCES : maxReferencesForTier(DEFAULT_TIER);
    setReferences((current) => current.slice(0, cap));
    setAdvancedOpen(false);
  };

  const handleMediaTypeChange = (next: MarketingGenerationMediaType) => {
    if (next === 'video') {
      if (videoPermissionBlocked) return;
      if (videoPlanBlocked) {
        openUpgradeModal('aiMarketingVideoGeneration');
        return;
      }
    }
    applyMediaType(next);
  };

  const handleTierChange = (next: MarketingGenerationTier) => {
    setTier(next);
    if (isVideo) return;
    if (next === 'draft') setImageSize('1K');
    setReferences((current) => current.slice(0, maxReferencesForTier(next)));
  };

  const canSubmit =
    prompt.trim().length > 0 &&
    !isGenerating &&
    !disabled &&
    (!isVideo || (!videoPermissionBlocked && !videoPlanBlocked));

  return (
    <form
      id="ai-studio-composer"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        if (isVideo) {
          onGenerate({
            mediaType: 'video',
            prompt: prompt.trim(),
            qualityTier: tier,
            aspectRatio,
            resolution,
            durationSeconds,
            referenceIds: references.map((reference) => reference.id),
          });
          return;
        }
        onGenerate({
          mediaType: 'image',
          prompt: prompt.trim(),
          qualityTier: tier,
          aspectRatio,
          imageSize,
          referenceIds: references.map((reference) => reference.id),
        });
      }}
    >
      <SegmentedControl
        value={mediaType}
        onChange={handleMediaTypeChange}
        size="dense"
        fullWidth
        aria-label="Media type"
        options={[
          { value: 'image', label: 'Image', disabled },
          {
            value: 'video',
            label: videoPlanBlocked && !videoPermissionBlocked ? 'Video · Business' : 'Video',
            disabled: disabled || videoPermissionBlocked,
            ariaLabel: videoPermissionBlocked
              ? 'Video. You do not have permission to generate video for this property.'
              : videoPlanBlocked
                ? 'Video. Available on Business and above.'
                : 'Video',
          },
        ]}
      />

      <div className="space-y-1.5">
        <Label className="settings-field-label" htmlFor="ai-studio-prompt">
          Prompt
        </Label>
        <Textarea
          id="ai-studio-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, maxPromptChars))}
          placeholder={promptPlaceholder}
          rows={5}
          disabled={disabled || isGenerating}
          className="border-border/80 focus-visible:ring-primary/30 min-h-[120px] resize-y rounded-xl text-sm leading-relaxed"
        />
        {prompt.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {promptStarters.slice(0, 2).map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => setPrompt(starter)}
                disabled={disabled || isGenerating}
                className="border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground min-h-[36px] rounded-full border px-3 py-1.5 text-left text-xs transition-colors"
              >
                {starter}
              </button>
            ))}
          </div>
        )}
      </div>

      <AiStudioReferenceUploader
        references={references}
        maxReferences={maxReferences}
        disabled={disabled || isGenerating}
        onAdd={(reference) => setReferences((current) => [...current, reference])}
        onRemove={(referenceId) =>
          setReferences((current) => current.filter((item) => item.id !== referenceId))
        }
      />

      <AiStudioAspectPicker
        mediaType={mediaType}
        value={aspectRatio}
        onChange={setAspectRatio}
        disabled={disabled || isGenerating}
      />

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger
          type="button"
          disabled={disabled || isGenerating}
          className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm font-medium transition-colors disabled:opacity-60"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>Advanced</span>
            {!advancedOpen && (
              <span className="text-muted-foreground truncate text-xs font-normal">
                {advancedSummary}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
              advancedOpen && 'rotate-180'
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {isVideo ? (
            <AiStudioVideoOptionsBar
              tier={tier}
              onTierChange={handleTierChange}
              resolution={resolution}
              onResolutionChange={setResolution}
              durationSeconds={durationSeconds}
              onDurationSecondsChange={setDurationSeconds}
              allowHighResolution={videoAllowed}
              allowPremium={allowPremium}
              disabled={disabled || isGenerating}
            />
          ) : (
            <AiStudioOptionsBar
              tier={tier}
              onTierChange={handleTierChange}
              imageSize={imageSize}
              onImageSizeChange={setImageSize}
              allowPremium={allowPremium}
              disabled={disabled || isGenerating}
            />
          )}
        </CollapsibleContent>
      </Collapsible>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="min-h-[48px] w-full gap-2 text-sm font-semibold"
      >
        {isGenerating ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {isGenerating ? 'Generating' : `Generate · ${credits.toLocaleString()} credits`}
      </Button>
    </form>
  );
}
