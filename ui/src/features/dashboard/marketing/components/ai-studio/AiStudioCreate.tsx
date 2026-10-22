import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Play,
  Settings2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { AI_OUTPUT_ICON } from '@/features/dashboard/marketing/components/ai-studio/AiSessionCard';
import { AiStudioCameraMovePicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioCameraMovePicker';
import {
  AiStudioChoiceGroup,
  type AiStudioChoice,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioChoiceGroup';
import { AiStudioLookPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioLookPicker';
import { AiStudioPhotoPicker } from '@/features/dashboard/marketing/components/ai-studio/AiStudioPhotoPicker';
import { SizeGlyph } from '@/features/dashboard/marketing/components/library/MarketingNewButton';
import { useOptionalMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemePostArt } from '@/features/dashboard/marketing/components/themes/ThemePreview';
import type { GenerateMarketingMediaPayload } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import { takePendingAiStartPhoto } from '@/features/dashboard/marketing/lib/aiStudioHandoff';
import { START_EXAMPLES } from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  DEFAULT_VIDEO_CAMERA_MOVE,
  DEFAULT_VIDEO_SOUND,
  GENERATION_LOOKS,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_SIZE_LABELS,
  MAX_LOOK_SUFFIX_CHARS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_MAX_REFERENCES,
  VIDEO_RESOLUTION_LABELS,
  VIDEO_SOUND_MODES,
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
  MarketingGenerationReference,
  MarketingGenerationTier,
} from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import type { PosterGoal } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import type { ResolvedMarketingTheme } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type AiCreateRequest =
  | { output: 'post'; goal: PosterGoal; format: DesignTemplateFormat; prompt: string }
  | {
      output: 'image' | 'video';
      prompt: string;
      aspect: string;
      payload: GenerateMarketingMediaPayload;
    };

export const POST_GOALS: Array<{ value: PosterGoal; label: string; hint: string }> = [
  { value: 'vibe', label: 'Vibe', hint: 'A feel-good moment' },
  { value: 'promo', label: 'Promo', hint: 'A deal or discount' },
  { value: 'amenity-spotlight', label: 'Amenities', hint: 'One amenity, up close' },
  { value: 'feature-spotlight', label: 'Feature', hint: 'One standout feature' },
  { value: 'stay-info', label: 'Stay info', hint: 'Check-in, house rules' },
];

export const POST_FORMATS: Array<{
  value: DesignTemplateFormat;
  label: string;
  width: number;
  height: number;
}> = [
  { value: 'instagram-portrait', label: 'Portrait', width: 4, height: 5 },
  { value: 'instagram-post', label: 'Square', width: 1, height: 1 },
  { value: 'instagram-story', label: 'Story', width: 9, height: 16 },
  { value: 'facebook-post', label: 'Facebook', width: 40, height: 21 },
];

export const OUTPUT_FEATURE: Record<AiStudioOutput, PlanFeatureKey> = {
  post: 'aiMarketingGeneration',
  image: 'aiMarketingImageGeneration',
  video: 'aiMarketingVideoGeneration',
};

const PLACEHOLDER: Record<AiStudioOutput, string> = {
  post: 'What is the post about? (optional)',
  image: 'Describe the photo you want',
  video: 'What should move? Curtains, water, light',
};

const POST_PROMPT_MAX = 500;

type Props = {
  output: AiStudioOutput;
  onOutputChange: (output: AiStudioOutput) => void;
  onSubmit: (request: AiCreateRequest) => void;
  busy: boolean;
  /** Role may start this output. */
  canStart: boolean;
  planAllowed: boolean;
  allowPremium: boolean;
  /** 1080p clips (Business+). */
  allowHighResolution: boolean;
  /** What the host typed under another output; follows them across outputs. */
  text: string;
  onTextChange: (text: string) => void;
};

function credits(value: number): string {
  return `${value.toLocaleString()} credits`;
}

/**
 * Step 2 of a new creation: say what you want, add photos, pick a size, Generate.
 * Everything else (look, quality, camera, sound, resolution, auto-improve) waits under
 * Advanced with sensible defaults, so a first-time host never has to open it.
 */
export function AiStudioCreate({
  output,
  onOutputChange,
  onSubmit,
  busy,
  canStart,
  planAllowed,
  allowPremium,
  allowHighResolution,
  text,
  onTextChange,
}: Props) {
  const { open: openUpgradeModal } = useUpgradeModal();
  const { property } = useOrgContext();
  const isPost = output === 'post';
  const isVideo = output === 'video';
  const theme = useOptionalMarketingTheme();
  const themePhotoLook = theme?.active?.tokens.photoLook ?? null;
  const resolvedTheme = theme?.resolved ?? null;
  const coverPhotoUrl = theme?.coverPhotoUrl;

  const [goal, setGoal] = useState<PosterGoal>('vibe');
  const [format, setFormat] = useState<DesignTemplateFormat>('instagram-portrait');
  const [aspect, setAspect] = useState(
    isVideo ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO
  );
  const [lookId, setLookId] = useState<string | null>(themePhotoLook);
  const [tier, setTier] = useState<MarketingGenerationTier>(DEFAULT_TIER);
  const [imageSize, setImageSize] = useState<ImageSize>(DEFAULT_IMAGE_SIZE);
  const [resolution, setResolution] = useState<VideoResolution>(DEFAULT_VIDEO_RESOLUTION);
  const [cameraMove, setCameraMove] = useState<VideoCameraMoveId>(DEFAULT_VIDEO_CAMERA_MOVE);
  const [sound, setSound] = useState<VideoSoundMode>(DEFAULT_VIDEO_SOUND);
  const [enhance, setEnhance] = useState(true);
  const [references, setReferences] = useState<MarketingGenerationReference[]>(() => {
    const handoff = takePendingAiStartPhoto();
    return handoff ? [handoff] : [];
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Photo ↔ Clip: settings that differ reset; photos are trimmed to the new cap.
  const mountedOutput = useRef(output);
  useEffect(() => {
    if (mountedOutput.current === output) return;
    mountedOutput.current = output;
    setTier(DEFAULT_TIER);
    setAspect(output === 'video' ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO);
    const cap = output === 'video' ? VIDEO_MAX_REFERENCES : maxReferencesForTier(DEFAULT_TIER);
    setReferences((current) => current.slice(0, cap));
  }, [output]);

  useEffect(() => {
    if (!allowPremium && tier === 'premium') setTier(DEFAULT_TIER);
  }, [allowPremium, tier]);

  useEffect(() => {
    window.setTimeout(() => promptRef.current?.focus({ preventScroll: true }), 0);
  }, [output]);

  const maxChars = isPost
    ? POST_PROMPT_MAX
    : (isVideo ? MAX_VIDEO_PROMPT_CHARS : MAX_IMAGE_PROMPT_CHARS) - MAX_LOOK_SUFFIX_CHARS;
  const maxPhotos = isVideo ? VIDEO_MAX_REFERENCES : maxReferencesForTier(tier);
  const hasStartFrame = isVideo && references.length > 0;
  const effectiveResolution: VideoResolution =
    tier === 'draft' || !allowHighResolution ? DRAFT_VIDEO_RESOLUTION : resolution;
  const locked = busy || !canStart;

  const creditsFor = (nextTier: MarketingGenerationTier) =>
    isVideo
      ? estimateGenerationCredits({
          mediaType: 'video',
          tier: nextTier,
          resolution:
            nextTier === 'draft' || !allowHighResolution ? DRAFT_VIDEO_RESOLUTION : resolution,
          durationSeconds: DEFAULT_VIDEO_DURATION,
        })
      : estimateGenerationCredits({
          mediaType: 'image',
          tier: nextTier,
          imageSize: nextTier === 'draft' ? '1K' : imageSize,
        });

  const sizeChoices = useMemo(
    () =>
      isPost
        ? POST_FORMATS.map((option) => ({
            value: option.value as string,
            label: option.label,
            width: option.width,
            height: option.height,
          }))
        : (isVideo ? VIDEO_ASPECT_RATIO_OPTIONS : IMAGE_ASPECT_RATIO_OPTIONS).map((option) => {
            const [w, h] = option.value.split(':').map(Number);
            return { value: option.value, label: option.label, width: w ?? 1, height: h ?? 1 };
          }),
    [isPost, isVideo]
  );
  const sizeValue = isPost ? format : aspect;

  const tierOptions = isVideo ? videoTierOptions(allowPremium) : imageTierOptions(allowPremium);
  const hasContent = isPost || text.trim().length > 0 || hasStartFrame;
  const canSubmit = hasContent && !locked;
  const feature = OUTPUT_FEATURE[output];

  const handleTier = (next: MarketingGenerationTier) => {
    setTier(next);
    if (isVideo) return;
    if (next === 'draft') setImageSize('1K');
    const cap = maxReferencesForTier(next);
    if (references.length > cap) {
      setReferences((current) => current.slice(0, cap));
      toast.message(`This quality uses up to ${cap} photos`);
    }
  };

  const submit = () => {
    if (!canSubmit) {
      if (!locked && !hasContent) promptRef.current?.focus();
      return;
    }
    if (!planAllowed) {
      openUpgradeModal(feature);
      return;
    }
    const description = text.trim();
    if (isPost) {
      onSubmit({ output: 'post', goal, format, prompt: description });
      return;
    }
    const prompt = composeGenerationPrompt(description, hasStartFrame ? null : lookId);
    const referenceIds = references.map((reference) => reference.id);
    onSubmit(
      isVideo
        ? {
            output: 'video',
            prompt: description,
            aspect,
            payload: {
              mediaType: 'video',
              prompt,
              qualityTier: tier,
              aspectRatio: aspect,
              resolution: effectiveResolution,
              durationSeconds: DEFAULT_VIDEO_DURATION,
              referenceIds,
              cameraMove,
              sound,
              enhancePrompt: enhance,
            },
          }
        : {
            output: 'image',
            prompt: description,
            aspect,
            payload: {
              mediaType: 'image',
              prompt,
              qualityTier: tier,
              aspectRatio: aspect,
              imageSize: tier === 'draft' ? '1K' : imageSize,
              referenceIds,
              enhancePrompt: enhance,
            },
          }
    );
  };

  const advancedSummary = isPost
    ? null
    : [
        tierOptions.find((option) => option.value === tier)?.label,
        isVideo ? undefined : GENERATION_LOOKS.find((look) => look.id === lookId)?.title,
        isVideo ? VIDEO_RESOLUTION_LABELS[effectiveResolution].replace(/ \(.+\)/, '') : undefined,
      ]
        .filter(Boolean)
        .join(' · ');

  const examples = START_EXAMPLES[output];
  const activeSize = sizeChoices.find((choice) => choice.value === sizeValue);
  const previewW = activeSize?.width ?? 1;
  const previewH = activeSize?.height ?? 1;

  return (
    <form
      id="ai-studio-composer"
      className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(22rem,25rem)_minmax(0,1fr)]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="border-border bg-card mx-auto flex w-full max-w-2xl flex-col rounded-2xl border shadow-sm lg:mx-0 lg:min-h-0 lg:max-w-none lg:rounded-none lg:border-0 lg:border-r lg:shadow-none">
        <div className="border-border/70 flex items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          <SegmentedControl
            value={output}
            onChange={(next) => onOutputChange(next as AiStudioOutput)}
            size="dense"
            aria-label="What to make"
            options={(['post', 'image', 'video'] as const).map((value) => ({
              value,
              label: value === 'post' ? 'Post' : value === 'image' ? 'Photo' : 'Clip',
              icon: AI_OUTPUT_ICON[value],
              disabled: busy,
            }))}
          />
        </div>

        <div className="space-y-4 p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {!canStart ? (
            <p className="bg-muted/60 text-muted-foreground rounded-lg px-3 py-2 text-xs">
              You do not have permission to make {isPost ? 'posts' : isVideo ? 'clips' : 'photos'}{' '}
              with AI for this property.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="ai-studio-prompt" className="sr-only">
              {isPost
                ? 'What is the post about?'
                : isVideo
                  ? 'Describe the clip'
                  : 'Describe the photo'}
            </Label>
            <Textarea
              ref={promptRef}
              id="ai-studio-prompt"
              value={text}
              onChange={(event) => onTextChange(event.target.value.slice(0, maxChars))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={PLACEHOLDER[output]}
              rows={3}
              disabled={locked}
              className="min-h-[96px] resize-none border-0 bg-transparent px-1 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
            />
            {text.length === 0 ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Examples">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      onTextChange(example);
                      promptRef.current?.focus();
                    }}
                    className="border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring min-h-9 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : text.length > maxChars * 0.8 ? (
              <p
                className="text-muted-foreground text-right text-xs tabular-nums"
                aria-live="polite"
              >
                {maxChars - text.length} left
              </p>
            ) : null}
          </div>

          {isPost ? (
            <AiStudioChoiceGroup
              label="What's it about?"
              value={goal}
              onChange={setGoal}
              columns={3}
              disabled={locked}
              options={POST_GOALS.map((option): AiStudioChoice<PosterGoal> => ({
                value: option.value,
                label: option.label,
                hint: option.hint,
              }))}
            />
          ) : (
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
              onRemove={(id) => setReferences((current) => current.filter((row) => row.id !== id))}
            />
          )}

          {!isPost ? (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleContent className="border-border/70 space-y-4 rounded-xl border p-3">
                {isVideo ? (
                  <AiStudioCameraMovePicker
                    value={cameraMove}
                    onChange={setCameraMove}
                    disabled={locked}
                  />
                ) : null}
                {!hasStartFrame ? (
                  <AiStudioLookPicker value={lookId} onChange={setLookId} disabled={locked} />
                ) : null}
                <div className="space-y-2">
                  <span className="settings-field-label">Quality</span>
                  <SegmentedControl
                    value={tier}
                    onChange={(next) => handleTier(next as MarketingGenerationTier)}
                    size="dense"
                    fullWidth
                    aria-label="Quality"
                    options={tierOptions.map((option) => ({
                      value: option.value,
                      label: `${option.label} · ${creditsFor(option.value).toLocaleString()}`,
                      disabled: locked,
                    }))}
                  />
                </div>
                {isVideo ? (
                  <>
                    {allowHighResolution ? (
                      <div className="space-y-2">
                        <span className="settings-field-label">Resolution</span>
                        <SegmentedControl
                          value={effectiveResolution}
                          onChange={(next) => setResolution(next as VideoResolution)}
                          size="dense"
                          fullWidth
                          aria-label="Resolution"
                          options={(['720p', '1080p'] as const).map((value) => ({
                            value,
                            label: VIDEO_RESOLUTION_LABELS[value],
                            disabled: locked || (tier === 'draft' && value === '1080p'),
                          }))}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <span className="settings-field-label">Sound</span>
                      <SegmentedControl
                        value={sound}
                        onChange={(next) => setSound(next as VideoSoundMode)}
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
                    <span className="settings-field-label">Image size</span>
                    <SegmentedControl
                      value={tier === 'draft' ? '1K' : imageSize}
                      onChange={(next) => setImageSize(next as ImageSize)}
                      size="dense"
                      fullWidth
                      aria-label="Image size"
                      options={(['512px', '1K', '2K', '4K'] as const).map((value) => ({
                        value,
                        label: IMAGE_SIZE_LABELS[value],
                        disabled: locked || !imageSizeOptions(tier).includes(value),
                      }))}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="ai-studio-enhance-prompt" className="text-sm font-medium">
                      Auto-improve description
                    </Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Off sends your exact words.
                    </p>
                  </div>
                  <Switch
                    id="ai-studio-enhance-prompt"
                    checked={enhance}
                    onCheckedChange={setEnhance}
                    disabled={locked}
                  />
                </div>
              </CollapsibleContent>
              <div className="border-border/70 -mx-3 mt-4 grid grid-cols-2 gap-2 border-t px-3 pt-3 sm:-mx-4 sm:px-4">
                <SizeSelect
                  choices={sizeChoices}
                  value={sizeValue}
                  onChange={setAspect}
                  disabled={locked}
                  className="w-full min-w-0"
                />
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border/50 h-11 w-full min-w-0 justify-between overflow-hidden border px-3 font-medium shadow-none"
                    disabled={locked}
                    aria-label={advancedOpen ? 'Hide advanced options' : 'Advanced options'}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Settings2 className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        Advanced
                        {advancedSummary && !advancedOpen ? (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            · {advancedSummary}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 opacity-50 transition-transform',
                        advancedOpen && 'rotate-180'
                      )}
                      aria-hidden
                    />
                  </Button>
                </CollapsibleTrigger>
                <GenerateButton
                  className="col-span-2"
                  feature={feature}
                  busy={busy}
                  disabled={locked}
                  dim={!canSubmit && !locked}
                  label={`Generate · ${credits(creditsFor(tier))}`}
                />
              </div>
            </Collapsible>
          ) : (
            <div className="border-border/70 -mx-3 flex items-center gap-2 border-t px-3 pt-3 sm:-mx-4 sm:px-4">
              <SizeSelect
                choices={sizeChoices}
                value={sizeValue}
                onChange={(value) => setFormat(value as DesignTemplateFormat)}
                disabled={locked}
                className="w-[8.75rem] shrink-0"
              />
              <GenerateButton
                className="min-w-0 flex-1"
                feature={feature}
                busy={busy}
                disabled={locked}
                dim={false}
                label="Generate 4 posts"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-muted/30 hidden min-h-0 flex-col lg:flex" aria-label="Preview">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 [container-type:size] sm:p-8">
          <div
            className="bg-card relative overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-12px_rgba(0,0,0,0.25)]"
            style={{
              aspectRatio: `${previewW} / ${previewH}`,
              width: `min(100cqw, calc(100cqh * ${previewW} / ${previewH}))`,
            }}
          >
            <AiStudioCreatePreview
              output={output}
              theme={resolvedTheme}
              coverPhotoUrl={coverPhotoUrl}
              propertyName={property.name}
              references={references}
            />
          </div>
        </div>
      </div>
    </form>
  );
}

function AiStudioCreatePreview({
  output,
  theme,
  coverPhotoUrl,
  propertyName,
  references,
}: {
  output: AiStudioOutput;
  theme: ResolvedMarketingTheme | null;
  coverPhotoUrl: string | undefined;
  propertyName: string;
  references: MarketingGenerationReference[];
}) {
  if (output === 'post') {
    if (!theme) {
      return (
        <AiStudioCreatePreviewEmpty
          icon={AI_OUTPUT_ICON.post}
          title="Your post will appear here"
          body="A ready-to-share design made from your listing photos."
        />
      );
    }
    return <ThemePostArt theme={theme} title={propertyName} photoUrl={coverPhotoUrl} />;
  }

  if (output === 'video') {
    const startFrame = references[0];
    if (!startFrame) {
      return (
        <AiStudioCreatePreviewEmpty
          icon={AI_OUTPUT_ICON.video}
          title="Your clip will appear here"
          body="Add a start photo and describe the motion, then Generate."
        />
      );
    }
    return (
      <div className="relative size-full overflow-hidden bg-black">
        <img
          src={startFrame.public_url}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-90"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
            <Play className="size-5 fill-white text-white" aria-hidden />
          </span>
        </span>
      </div>
    );
  }

  if (references.length === 0) {
    return (
      <AiStudioCreatePreviewEmpty
        icon={AI_OUTPUT_ICON.image}
        title="Your photo will appear here"
        body="Describe the shot, add a reference photo if you have one, then Generate."
      />
    );
  }
  const cover = references[references.length - 1]!;
  return (
    <div
      className="relative size-full overflow-hidden"
      style={{ backgroundColor: theme?.secondary }}
    >
      <img src={cover.public_url} alt="" className="absolute inset-0 size-full object-cover" />
      {references.length > 1 ? (
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <ImagePlus className="size-3" aria-hidden />
          {references.length} photos
        </span>
      ) : null}
    </div>
  );
}

/** Quiet placeholder shown in the preview frame before there is anything to show. */
function AiStudioCreatePreviewEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-muted/40 flex size-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="max-w-[16rem] space-y-1">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function GenerateButton({
  feature,
  busy,
  disabled,
  dim,
  label,
  className,
}: {
  feature: PlanFeatureKey;
  busy: boolean;
  disabled: boolean;
  dim: boolean;
  label: string;
  className?: string;
}) {
  return (
    <TierBadgeAnchor feature={feature} className={cn('min-w-0', className)}>
      <Button
        type="submit"
        disabled={disabled}
        aria-disabled={dim}
        className={cn('h-11 w-full gap-2 px-4 font-semibold', dim && 'opacity-60')}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {busy ? 'Generating' : label}
      </Button>
    </TierBadgeAnchor>
  );
}

export function SizeSelect({
  choices,
  value,
  onChange,
  disabled,
  className,
}: {
  choices: Array<{ value: string; label: string; width: number; height: number }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      // Radix echoes the value through a hidden native select, which can report an
      // empty one while the options mount. Only a real choice counts as a change.
      onValueChange={(next) => {
        if (next !== value && choices.some((choice) => choice.value === next)) onChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn('h-11 w-auto min-w-[8.5rem] gap-2 max-lg:h-11 lg:h-11', className)}
        aria-label="Size"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            <span className="inline-flex items-center gap-2">
              <SizeGlyph width={choice.width} height={choice.height} />
              {choice.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
