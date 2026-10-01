import { useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  AiStudioChoiceGroup,
  AiStudioShapePreview,
  type AiStudioChoice,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioChoiceGroup';
import { AiStudioLookPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioLookPicker';
import { AiStudioPhotoPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioPhotoPicker';
import type { GenerateMarketingMediaPayload } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import type { AiStudioComposerDraft } from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_SIZE_LABELS,
  IMAGE_SUBJECT_IDEAS,
  MAX_LOOK_SUFFIX_CHARS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_DURATION_LABELS,
  VIDEO_MAX_REFERENCES,
  VIDEO_RESOLUTION_LABELS,
  VIDEO_SUBJECT_IDEAS,
  composeGenerationPrompt,
  imageSizeOptions,
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
  VIDEO_DURATIONS,
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
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Props = {
  /** Owned by the Generate tab's Post / Photo / Video switch. */
  mediaType: MarketingGenerationMediaType;
  onGenerate: (payload: GenerateMarketingMediaPayload) => void;
  isGenerating: boolean;
  /** Permission or plan-gate loading: everything is read-only. */
  disabled?: boolean;
  /** Plan for this media type. False keeps the form usable; Generate opens the upgrade modal. */
  planAllowed?: boolean;
  allowPremium?: boolean;
  /** 1080p video (Business+). */
  allowHighResolution?: boolean;
  draft?: AiStudioComposerDraft | null;
  pendingReference?: { id: number; reference: MarketingGenerationReference } | null;
};

const IMAGE_PLACEHOLDER = 'Balcony at golden hour with the skyline behind it';
const VIDEO_PLACEHOLDER = 'Slow pan across the living room at golden hour';

function formatCredits(credits: number): string {
  return `${credits.toLocaleString()} credits`;
}

/**
 * Photo / video composer. One column, top to bottom in the order a host thinks:
 * what to show → which of their photos → the look → where it will be posted → quality.
 * Size, resolution and prompt enhancement live under More options.
 */
export function AiStudioComposer({
  mediaType,
  onGenerate,
  isGenerating,
  disabled = false,
  planAllowed = true,
  allowPremium = false,
  allowHighResolution = false,
  draft,
  pendingReference,
}: Props) {
  const { open: openUpgradeModal } = useUpgradeModal();
  const isVideo = mediaType === 'video';
  const [description, setDescription] = useState('');
  const [lookId, setLookId] = useState<string | null>(null);
  const [tier, setTier] = useState<MarketingGenerationTier>(DEFAULT_TIER);
  const [aspectRatio, setAspectRatio] = useState(
    isVideo ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO
  );
  const [imageSize, setImageSize] = useState<ImageSize>(DEFAULT_IMAGE_SIZE);
  const [resolution, setResolution] = useState<VideoResolution>(DEFAULT_VIDEO_RESOLUTION);
  const [durationSeconds, setDurationSeconds] = useState<VideoDuration>(DEFAULT_VIDEO_DURATION);
  const [references, setReferences] = useState<MarketingGenerationReference[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const maxPhotos = isVideo ? VIDEO_MAX_REFERENCES : maxReferencesForTier(tier);
  const maxDescriptionChars =
    (isVideo ? MAX_VIDEO_PROMPT_CHARS : MAX_IMAGE_PROMPT_CHARS) - MAX_LOOK_SUFFIX_CHARS;
  const locked = disabled || isGenerating;

  // Switching Photo ↔ Video keeps the description, look and photos (trimmed to the
  // new cap) and resets the settings that differ between the two.
  const mountedMediaType = useRef(mediaType);
  useEffect(() => {
    if (mountedMediaType.current === mediaType) return;
    mountedMediaType.current = mediaType;
    setTier(DEFAULT_TIER);
    setAspectRatio(mediaType === 'video' ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO);
    setImageSize(DEFAULT_IMAGE_SIZE);
    setResolution(DEFAULT_VIDEO_RESOLUTION);
    setDurationSeconds(DEFAULT_VIDEO_DURATION);
    const cap = mediaType === 'video' ? VIDEO_MAX_REFERENCES : maxReferencesForTier(DEFAULT_TIER);
    setReferences((current) => current.slice(0, cap));
  }, [mediaType]);

  // Declared after the media-type reset so a Retry / Refine landing on the other
  // media type in the same render wins over the reset.
  const draftId = draft?.id;
  useEffect(() => {
    if (!draft) return;
    const values = draft.values;
    mountedMediaType.current = values.mediaType;
    setDescription(values.prompt.slice(0, maxDescriptionChars));
    setLookId(values.lookId);
    setTier(values.qualityTier);
    setAspectRatio(values.aspectRatio);
    setImageSize(values.imageSize);
    setResolution(values.resolution);
    setDurationSeconds(values.durationSeconds);
    setReferences(values.references);
    window.setTimeout(() => promptRef.current?.focus({ preventScroll: true }), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft.id is the apply key
  }, [draftId]);

  const pendingReferenceId = pendingReference?.id;
  useEffect(() => {
    if (pendingReferenceId == null || !pendingReference) return;
    const incoming = pendingReference.reference;
    if (references.some((row) => row.id === incoming.id)) return;
    if (references.length >= maxPhotos) {
      toast.error('Remove a photo first');
      return;
    }
    setReferences((current) => [...current, incoming]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingReference.id is the apply key
  }, [pendingReferenceId]);

  useEffect(() => {
    if (!allowPremium && tier === 'premium') setTier(DEFAULT_TIER);
  }, [allowPremium, tier]);

  useEffect(() => {
    if (!allowHighResolution && resolution === '1080p') setResolution(DEFAULT_VIDEO_RESOLUTION);
  }, [allowHighResolution, resolution]);

  const creditsFor = (nextTier: MarketingGenerationTier) =>
    isVideo
      ? estimateGenerationCredits({
          mediaType: 'video',
          tier: nextTier,
          resolution,
          durationSeconds,
        })
      : estimateGenerationCredits({
          mediaType: 'image',
          tier: nextTier,
          // Draft only renders at 1K, so price it that way whatever size is picked.
          imageSize: nextTier === 'draft' ? '1K' : imageSize,
        });
  const credits = creditsFor(tier);

  const qualityOptions: AiStudioChoice<MarketingGenerationTier>[] = (
    isVideo ? videoTierOptions(allowPremium) : imageTierOptions(allowPremium)
  ).map((option) => ({
    value: option.value,
    label: option.label,
    hint: `${option.hint} · ${creditsFor(option.value).toLocaleString()}`,
  }));

  const formatOptions: AiStudioChoice<string>[] = (
    isVideo ? VIDEO_ASPECT_RATIO_OPTIONS : IMAGE_ASPECT_RATIO_OPTIONS
  ).map((option) => ({
    value: option.value,
    label: option.label,
    hint: option.hint,
    visual: <AiStudioShapePreview ratio={option.ratio} />,
  }));

  const sizeOptions = imageSizeOptions(tier);
  const showMoreOptions = !isVideo || allowHighResolution;
  const moreSummary = useMemo(() => {
    if (isVideo) return VIDEO_RESOLUTION_LABELS[resolution];
    const size = IMAGE_SIZE_LABELS[tier === 'draft' ? '1K' : imageSize];
    return `${size} size · Auto-improve ${enhancePrompt ? 'on' : 'off'}`;
  }, [isVideo, resolution, tier, imageSize, enhancePrompt]);

  const handleTierChange = (next: MarketingGenerationTier) => {
    setTier(next);
    if (isVideo) return;
    if (next === 'draft') setImageSize('1K');
    const cap = maxReferencesForTier(next);
    if (references.length > cap) {
      setReferences((current) => current.slice(0, cap));
      toast.message(`${next === 'premium' ? 'Premium' : 'This quality'} uses up to ${cap} photos`);
    }
  };

  const ideas = isVideo ? VIDEO_SUBJECT_IDEAS : IMAGE_SUBJECT_IDEAS;
  const canSubmit = description.trim().length > 0 && !locked;

  return (
    <form
      id="ai-studio-composer"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) {
          if (!locked && description.trim().length === 0) promptRef.current?.focus();
          return;
        }
        if (!planAllowed) {
          openUpgradeModal(isVideo ? 'aiMarketingVideoGeneration' : 'aiMarketingImageGeneration');
          return;
        }
        const prompt = composeGenerationPrompt(description, lookId);
        const referenceIds = references.map((reference) => reference.id);
        if (isVideo) {
          onGenerate({
            mediaType: 'video',
            prompt,
            qualityTier: tier,
            aspectRatio,
            resolution,
            durationSeconds,
            referenceIds,
          });
          return;
        }
        onGenerate({
          mediaType: 'image',
          prompt,
          qualityTier: tier,
          aspectRatio,
          imageSize: tier === 'draft' ? '1K' : imageSize,
          referenceIds,
          enhancePrompt,
        });
      }}
    >
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label className="settings-field-label" htmlFor="ai-studio-prompt">
            {isVideo ? 'Describe the clip' : 'Describe the photo'}
          </Label>
          {description.length > maxDescriptionChars * 0.8 && (
            <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
              {maxDescriptionChars - description.length} left
            </span>
          )}
        </div>
        <Textarea
          ref={promptRef}
          id="ai-studio-prompt"
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, maxDescriptionChars))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={isVideo ? VIDEO_PLACEHOLDER : IMAGE_PLACEHOLDER}
          rows={3}
          disabled={locked}
          className="border-border/80 focus-visible:ring-primary/30 min-h-[96px] resize-y rounded-xl text-sm leading-relaxed"
        />
        {description.length === 0 && (
          <div
            className="scrollbar-hide -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-0.5"
            aria-label="Ideas"
            role="group"
          >
            {ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  setDescription(idea);
                  promptRef.current?.focus();
                }}
                disabled={locked}
                className="border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring min-h-10 shrink-0 snap-start sm:min-h-9 whitespace-nowrap rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-50"
              >
                {idea}
              </button>
            ))}
          </div>
        )}
      </div>

      <AiStudioPhotoPicker
        references={references}
        maxPhotos={maxPhotos}
        disabled={locked}
        onAdd={(reference) =>
          setReferences((current) =>
            current.some((row) => row.id === reference.id) || current.length >= maxPhotos
              ? current
              : [...current, reference]
          )
        }
        onRemove={(referenceId) =>
          setReferences((current) => current.filter((item) => item.id !== referenceId))
        }
      />

      <AiStudioLookPicker value={lookId} onChange={setLookId} disabled={locked} />

      <AiStudioChoiceGroup
        label="Format"
        value={aspectRatio}
        onChange={setAspectRatio}
        options={formatOptions}
        columns={isVideo ? 2 : 4}
        disabled={locked}
      />

      <AiStudioChoiceGroup
        label="Quality"
        value={tier}
        onChange={handleTierChange}
        options={qualityOptions}
        columns={qualityOptions.length === 3 ? 3 : 2}
        disabled={locked}
      />

      {isVideo && (
        <AiStudioChoiceGroup
          label="Length"
          value={String(durationSeconds)}
          onChange={(next) => setDurationSeconds(Number(next) as VideoDuration)}
          options={VIDEO_DURATIONS.map((seconds) => ({
            value: String(seconds),
            label: VIDEO_DURATION_LABELS[seconds],
          }))}
          disabled={locked}
        />
      )}

      {showMoreOptions && (
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger
            type="button"
            disabled={locked}
            className="hover:bg-muted/40 focus-visible:ring-ring -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-foreground text-sm font-medium">More options</span>
              {!moreOpen && (
                <span className="text-muted-foreground truncate text-xs">{moreSummary}</span>
              )}
            </span>
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                moreOpen && 'rotate-180'
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            {isVideo ? (
              <div className="space-y-2">
                <span className="settings-field-label">Resolution</span>
                <SegmentedControl
                  value={resolution}
                  onChange={setResolution}
                  size="dense"
                  fullWidth
                  aria-label="Resolution"
                  options={(['720p', '1080p'] as const).map((value) => ({
                    value,
                    label: VIDEO_RESOLUTION_LABELS[value],
                    disabled: locked,
                  }))}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="settings-field-label">Size</span>
                  <SegmentedControl
                    value={tier === 'draft' ? '1K' : imageSize}
                    onChange={setImageSize}
                    size="dense"
                    fullWidth
                    aria-label="Size"
                    options={(['512px', '1K', '2K', '4K'] as const).map((value) => ({
                      value,
                      label: IMAGE_SIZE_LABELS[value],
                      disabled: locked || !sizeOptions.includes(value),
                    }))}
                  />
                  {tier === 'draft' && (
                    <p className="text-muted-foreground text-xs">Draft is always Medium.</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="ai-studio-enhance-prompt" className="text-sm font-medium">
                      Auto-improve description
                    </Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Adds lighting, camera and property detail. Off uses your exact words.
                    </p>
                  </div>
                  <Switch
                    id="ai-studio-enhance-prompt"
                    checked={enhancePrompt}
                    onCheckedChange={setEnhancePrompt}
                    disabled={locked}
                  />
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="bg-card lg:border-border/60 space-y-2 pt-1 lg:sticky lg:bottom-0 lg:-mx-5 lg:-mb-5 lg:border-t lg:px-5 lg:pb-5 lg:pt-4">
        <TierBadgeAnchor
          feature={isVideo ? 'aiMarketingVideoGeneration' : 'aiMarketingImageGeneration'}
          className="w-full"
        >
          <Button
            type="submit"
            disabled={locked}
            aria-disabled={!canSubmit}
            className={cn(
              'min-h-12 w-full gap-2 text-sm font-semibold',
              !canSubmit && !locked && 'opacity-60'
            )}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {isGenerating ? 'Generating' : `Generate · ${formatCredits(credits)}`}
          </Button>
        </TierBadgeAnchor>
        {!isVideo && (
          <p className="text-muted-foreground text-center text-[11px]">
            AI images carry an invisible SynthID watermark.
          </p>
        )}
      </div>
    </form>
  );
}
