import { useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  AiStudioChoiceGroup,
  AiStudioShapePreview,
  type AiStudioChoice,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioChoiceGroup';
import { AiStudioCameraMovePicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioCameraMovePicker';
import { AiStudioLookPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioLookPicker';
import { AiStudioPhotoPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioPhotoPicker';
import type { GenerateMarketingMediaPayload } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import type { AiStudioComposerDraft } from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import {
  DEFAULT_VIDEO_CAMERA_MOVE,
  DEFAULT_VIDEO_SOUND,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_SIZE_LABELS,
  IMAGE_SUBJECT_IDEAS,
  MAX_LOOK_SUFFIX_CHARS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_MAX_REFERENCES,
  VIDEO_RESOLUTION_LABELS,
  VIDEO_SOUND_MODES,
  VIDEO_SUBJECT_IDEAS,
  composeGenerationPrompt,
  imageSizeOptions,
  imageTierOptions,
  maxReferencesForTier,
  videoTierOptions,
  type VideoCameraMoveId,
  type VideoSoundMode,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_TIER,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
  DRAFT_VIDEO_RESOLUTION,
  MAX_IMAGE_PROMPT_CHARS,
  MAX_VIDEO_PROMPT_CHARS,
  estimateGenerationCredits,
  type ImageSize,
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
const VIDEO_PLACEHOLDER = 'Sunlit living room with a sea view';
const VIDEO_PHOTO_PLACEHOLDER = 'What should move? Curtains, water, light';

function formatCredits(credits: number): string {
  return `${credits.toLocaleString()} credits`;
}

/**
 * Photo / video composer. One column, top to bottom in the order a host thinks:
 * what to show → which of their photos → the look (video: the camera move) → where it
 * will be posted → quality. Size, resolution, sound and prompt enhancement live under
 * More options. A video's photo is its first frame, so the look is hidden then: the
 * photo already sets the light.
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
  const [cameraMove, setCameraMove] = useState<VideoCameraMoveId>(DEFAULT_VIDEO_CAMERA_MOVE);
  const [sound, setSound] = useState<VideoSoundMode>(DEFAULT_VIDEO_SOUND);
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
    setCameraMove(values.cameraMove);
    setSound(values.sound);
    setReferences(values.references);
    window.setTimeout(() => promptRef.current?.focus({ preventScroll: true }), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft.id is the apply key
  }, [draftId]);

  const pendingReferenceId = pendingReference?.id;
  useEffect(() => {
    if (pendingReferenceId == null || !pendingReference) return;
    const incoming = pendingReference.reference;
    if (references.some((row) => row.id === incoming.id)) return;
    if (maxPhotos === 1) {
      setReferences([incoming]);
      return;
    }
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

  // Draft renders 720p only; the picked resolution comes back when switching up again.
  const videoResolutionFor = (nextTier: MarketingGenerationTier): VideoResolution =>
    nextTier === 'draft' || !allowHighResolution ? DRAFT_VIDEO_RESOLUTION : resolution;
  const effectiveResolution = videoResolutionFor(tier);
  const hasStartFrame = isVideo && references.length > 0;

  const creditsFor = (nextTier: MarketingGenerationTier) =>
    isVideo
      ? estimateGenerationCredits({
          mediaType: 'video',
          tier: nextTier,
          resolution: videoResolutionFor(nextTier),
          durationSeconds: DEFAULT_VIDEO_DURATION,
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
  const moreSummary = useMemo(() => {
    const autoImprove = `Auto-improve ${enhancePrompt ? 'on' : 'off'}`;
    if (isVideo) {
      const soundLabel = VIDEO_SOUND_MODES.find((mode) => mode.value === sound)?.label;
      return `${VIDEO_RESOLUTION_LABELS[effectiveResolution]} · ${soundLabel} · ${autoImprove}`;
    }
    const size = IMAGE_SIZE_LABELS[tier === 'draft' ? '1K' : imageSize];
    return `${size} size · ${autoImprove}`;
  }, [isVideo, effectiveResolution, sound, tier, imageSize, enhancePrompt]);

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
  // A video that starts from a photo can go without a description.
  const hasContent = description.trim().length > 0 || hasStartFrame;
  const canSubmit = hasContent && !locked;

  return (
    <form
      id="ai-studio-composer"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) {
          if (!locked && !hasContent) promptRef.current?.focus();
          return;
        }
        if (!planAllowed) {
          openUpgradeModal(isVideo ? 'aiMarketingVideoGeneration' : 'aiMarketingImageGeneration');
          return;
        }
        const prompt = composeGenerationPrompt(description, hasStartFrame ? null : lookId);
        const referenceIds = references.map((reference) => reference.id);
        if (isVideo) {
          onGenerate({
            mediaType: 'video',
            prompt,
            qualityTier: tier,
            aspectRatio,
            resolution: effectiveResolution,
            durationSeconds: DEFAULT_VIDEO_DURATION,
            referenceIds,
            cameraMove,
            sound,
            enhancePrompt,
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
          {description.length > maxDescriptionChars * 0.8 ? (
            <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
              {maxDescriptionChars - description.length} left
            </span>
          ) : (
            hasStartFrame && <span className="text-muted-foreground text-xs">Optional</span>
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
          placeholder={
            hasStartFrame
              ? VIDEO_PHOTO_PLACEHOLDER
              : isVideo
                ? VIDEO_PLACEHOLDER
                : IMAGE_PLACEHOLDER
          }
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
                className="border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring min-h-10 shrink-0 snap-start whitespace-nowrap rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-50 sm:min-h-9"
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
        startFrame={isVideo}
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

      {isVideo && (
        <AiStudioCameraMovePicker value={cameraMove} onChange={setCameraMove} disabled={locked} />
      )}

      {!hasStartFrame && (
        <AiStudioLookPicker value={lookId} onChange={setLookId} disabled={locked} />
      )}

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
            <>
              {allowHighResolution && (
                <div className="space-y-2">
                  <span className="settings-field-label">Resolution</span>
                  <SegmentedControl
                    value={effectiveResolution}
                    onChange={setResolution}
                    size="dense"
                    fullWidth
                    aria-label="Resolution"
                    options={(['720p', '1080p'] as const).map((value) => ({
                      value,
                      label: VIDEO_RESOLUTION_LABELS[value],
                      disabled: locked || (tier === 'draft' && value === '1080p'),
                    }))}
                  />
                  {tier === 'draft' && (
                    <p className="text-muted-foreground text-xs">Draft is always 720p.</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <span className="settings-field-label">Sound</span>
                <SegmentedControl
                  value={sound}
                  onChange={setSound}
                  size="dense"
                  fullWidth
                  aria-label="Sound"
                  options={VIDEO_SOUND_MODES.map((mode) => ({
                    value: mode.value,
                    label: mode.label,
                    disabled: locked,
                  }))}
                />
              </div>
            </>
          ) : (
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
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="ai-studio-enhance-prompt" className="text-sm font-medium">
                Auto-improve description
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {isVideo
                  ? 'Plans the motion from your photo and words. Off uses your exact words.'
                  : 'Adds lighting, camera and property detail. Off uses your exact words.'}
              </p>
            </div>
            <Switch
              id="ai-studio-enhance-prompt"
              checked={enhancePrompt}
              onCheckedChange={setEnhancePrompt}
              disabled={locked}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

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
        <p className="text-muted-foreground text-center text-[11px]">
          {isVideo ? 'AI videos' : 'AI images'} carry an invisible SynthID watermark.
        </p>
      </div>
    </form>
  );
}
