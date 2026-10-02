import { useCallback, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, PenLine, Send, Shuffle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  AiStudioChoiceGroup,
  AiStudioShapePreview,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioChoiceGroup';
import { AiStudioEmptyState } from '@/features/dashboard/marketing/components/ai-studio/AiStudioEmptyState';
import { AiStudioGeneratingStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioGeneratingStage';
import { useGeneratePosters } from '@/features/dashboard/marketing/hooks/useGeneratePosters';
import { useMarketingCatalog } from '@/features/dashboard/marketing/hooks/useMarketingCatalog';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { saveMarketingTemplate } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { DESIGN_CUSTOM_SOURCE_PRESET_ID } from '@/features/dashboard/marketing/lib/designAutosave';
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import {
  compilePosterDocument,
  type PhotoSizeMap,
} from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { POSTER_GOAL_ARCHETYPES } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { preloadPosterFonts } from '@/features/dashboard/marketing/lib/poster/posterFontLoader';
import { loadPosterPhotoSizes } from '@/features/dashboard/marketing/lib/poster/posterPhotoSizes';
import { renderPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterRender';
import {
  POSTER_ARCHETYPE_IDS,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const GOALS: Array<{ value: PosterGoal; label: string }> = [
  { value: 'vibe', label: 'Vibe' },
  { value: 'promo', label: 'Promo' },
  { value: 'amenity-spotlight', label: 'Amenities' },
  { value: 'feature-spotlight', label: 'Feature' },
  { value: 'stay-info', label: 'Stay info' },
];

const FORMATS: Array<{
  value: DesignTemplateFormat;
  label: string;
  hint: string;
  ratio: number;
}> = [
  { value: 'instagram-portrait', label: 'Portrait', hint: 'Feed post', ratio: 4 / 5 },
  { value: 'instagram-post', label: 'Square', hint: 'Feed post', ratio: 1 },
  { value: 'instagram-story', label: 'Story', hint: 'Stories', ratio: 9 / 16 },
  { value: 'facebook-post', label: 'Facebook', hint: 'Page post', ratio: 40 / 21 },
];

const PROMPT_PLACEHOLDER: Record<PosterGoal, string> = {
  vibe: 'Slow mornings, coffee with a view',
  promo: 'Weekday stays, book direct',
  'amenity-spotlight': 'Pool, jacuzzi and fast WiFi',
  'feature-spotlight': 'New PS5 with games for game nights',
  'stay-info': 'Check-in details for this weekend',
};

type PosterVariant = {
  key: string;
  spec: PosterSpec;
  document: PolotnoDesignDocument;
  preview: string | null;
};

type Props = {
  onOpenInDesign: (templateId: string) => void;
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
  canPublish: boolean;
};

function aspectClass(format: DesignTemplateFormat): string {
  if (format === 'instagram-story') return 'aspect-[9/16]';
  if (format === 'facebook-post') return 'aspect-[40/21]';
  if (format === 'instagram-portrait') return 'aspect-[4/5]';
  return 'aspect-square';
}
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/**
 * Generate tab, "AI Post" mode: the AI art director picks layouts, type and copy for
 * the property's real photos, and the poster compiler turns each pick into a finished,
 * editable design. Results open in the Design editor for tweaks.
 */
export function AiPostPanel({ onOpenInDesign, onPublish, canPublish }: Props) {
  const { property, org } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const { data: publicProperty, isLoading: propertyLoading } = usePublicPropertyDetail(
    property.slug
  );
  const { data: appSettings } = useAppSettings();
  const { data: orgSettings } = useOrgSettings();
  const orgBrandColor = useOrgBrandColor();
  const brandColor = appSettings?.resolvedBrandColor ?? orgBrandColor ?? null;
  const logoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;

  const { canGenerate, canAddTemplate } = useMarketingPermissions();
  const { canUse, isLoading: gateLoading } = useFeatureGate('aiMarketingGeneration');
  const { open: openUpgradeModal } = useUpgradeModal();
  const catalog = useMarketingCatalog('design');
  const generate = useGeneratePosters();

  const [goal, setGoal] = useState<PosterGoal>('vibe');
  const [format, setFormat] = useState<DesignTemplateFormat>('instagram-portrait');
  const [prompt, setPrompt] = useState('');
  const [variants, setVariants] = useState<PosterVariant[]>([]);
  const [facts, setFacts] = useState<PosterFacts | null>(null);
  const [photoSizes, setPhotoSizes] = useState<PhotoSizeMap>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const baseFacts = useMemo(
    () =>
      buildPosterFacts({
        propertyName: property.name,
        brandName: org.name ?? null,
        property: publicProperty ?? null,
        photos: publicProperty?.images ?? [],
        logoUrl,
      }),
    [property.name, org.name, publicProperty, logoUrl]
  );

  // Every generate / format switch starts a new run; renders from an older run are
  // dropped so a slow render can never overwrite newer results.
  const runRef = useRef(0);
  const formatRef = useRef(format);
  formatRef.current = format;

  /** Renders variants in order; returns how many rendered (for the all-failed case). */
  const renderVariants = useCallback(async (next: PosterVariant[], run: number) => {
    setVariants(next);
    let rendered = 0;
    for (const variant of next) {
      if (run !== runRef.current) return rendered;
      try {
        const result = await renderPosterDocument(variant.document);
        if (run !== runRef.current) return rendered;
        rendered += 1;
        setVariants((current) =>
          current.map((item) =>
            item.key === variant.key
              ? { ...item, preview: result.dataUrl, document: result.document }
              : item
          )
        );
      } catch {
        if (run !== runRef.current) return rendered;
        setVariants((current) => current.filter((item) => item.key !== variant.key));
      }
    }
    if (rendered === 0 && next.length > 0) toast.error('Could not draw these posts. Try again.');
    return rendered;
  }, []);

  const compile = useCallback(
    (
      spec: PosterSpec,
      factsForSpec: PosterFacts,
      sizes: PhotoSizeMap,
      key: string,
      forFormat: DesignTemplateFormat
    ): PosterVariant => ({
      key,
      spec,
      document: compilePosterDocument(spec, factsForSpec, forFormat, {
        photoSizes: sizes,
        brandColor,
      }),
      preview: null,
    }),
    [brandColor]
  );

  /** Same specs, new canvas: layouts are deterministic, so no AI call is needed. */
  const handleFormatChange = (next: DesignTemplateFormat) => {
    setFormat(next);
    formatRef.current = next;
    if (!facts || variants.length === 0) return;
    const run = ++runRef.current;
    void renderVariants(
      variants.map((variant, index) =>
        compile(variant.spec, facts, photoSizes, `${run}-${index}`, next)
      ),
      run
    );
  };

  const handleGenerate = async () => {
    if (!canUse) {
      openUpgradeModal('aiMarketingGeneration');
      return;
    }
    const run = ++runRef.current;
    setVariants([]);
    try {
      const [result, sizes] = await Promise.all([
        generate.mutateAsync({ goal, prompt: prompt.trim(), facts: baseFacts, brandColor }),
        loadPosterPhotoSizes(baseFacts.photos),
        preloadPosterFonts(),
      ]);
      if (run !== runRef.current) return;
      setFacts(result.facts);
      setPhotoSizes(sizes);
      if (!result.aiDirected) toast.message('AI styling is busy. Showing quick layouts instead.');
      // Compile for the format selected now, not when the request started.
      const compiled = result.specs.map((spec, index) => {
        const variant = compile(spec, result.facts, sizes, `${run}-${index}`, formatRef.current);
        return { variant, issues: auditPosterDocument(variant.document).length };
      });
      // Layout QA: variants with collisions or overflow go last, never first.
      compiled.sort((a, b) => a.issues - b.issues);
      await renderVariants(
        compiled.map((item) => item.variant),
        run
      );
    } catch {
      /* quota / permission errors are surfaced by the mutation's onError */
    }
  };

  /** Same copy, next layout + type system: no AI call, instant. */
  const handleShuffle = async (variant: PosterVariant) => {
    if (!facts) return;
    const used = new Set(variants.map((item) => item.spec.archetype));
    const order = [...POSTER_GOAL_ARCHETYPES[variant.spec.goal], ...POSTER_ARCHETYPE_IDS];
    const archetype =
      order.find((id) => !used.has(id)) ??
      order[(order.indexOf(variant.spec.archetype) + 1) % order.length]!;
    const spec: PosterSpec = {
      ...variant.spec,
      archetype,
      fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
    };
    const next = compile(spec, facts, photoSizes, `${variant.key}-s${Date.now()}`, format);
    setVariants((current) => current.map((item) => (item.key === variant.key ? next : item)));
    try {
      const rendered = await renderPosterDocument(next.document);
      setVariants((current) =>
        current.map((item) =>
          item.key === next.key
            ? { ...item, preview: rendered.dataUrl, document: rendered.document }
            : item
        )
      );
    } catch {
      toast.error('Could not render that layout');
    }
  };

  const exportBlob = async (variant: PosterVariant) => {
    const rendered = await renderPosterDocument(variant.document, {
      pixelRatio: 1,
      mimeType: 'image/png',
    });
    return dataUrlToBlob(rendered.dataUrl);
  };

  const handleDownload = async (variant: PosterVariant) => {
    setBusyKey(`${variant.key}:download`);
    try {
      const blob = await exportBlob(variant);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${variant.spec.label || 'poster'}.png`.replace(/[^\w.-]+/g, '-');
      link.click();
      // Revoking in the same tick can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      toast.error('Could not export this post');
    } finally {
      setBusyKey(null);
    }
  };

  const handlePublish = async (variant: PosterVariant) => {
    setBusyKey(`${variant.key}:publish`);
    try {
      onPublish({ blob: await exportBlob(variant), mediaType: 'image' });
    } catch {
      toast.error('Could not export this post');
    } finally {
      setBusyKey(null);
    }
  };

  const handleEdit = async (variant: PosterVariant) => {
    setBusyKey(`${variant.key}:edit`);
    try {
      const categoryId = catalog.findOrCreateCategoryByLabel('AI posts') ?? 'custom';
      const record = await saveMarketingTemplate(propertyId, {
        name: variant.spec.label || variant.spec.copy.headline,
        contentType: 'design',
        aspectPreset: format,
        platform: format.includes('facebook') ? 'facebook' : 'instagram',
        designJson: {
          templateId: '',
          sourcePresetId: DESIGN_CUSTOM_SOURCE_PRESET_ID,
          format,
          categoryId,
          category: categoryId,
          aiGenerated: true,
          posterSpec: variant.spec,
          polotno: variant.document,
          ...(variant.preview ? { thumbnailDataUrl: variant.preview } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
      onOpenInDesign(record.id);
    } catch {
      toast.error('Could not open this post in Design');
    } finally {
      setBusyKey(null);
    }
  };

  const disabled = !canGenerate || gateLoading || propertyLoading;
  const isGenerating = generate.isPending;
  const rendering = variants.some((variant) => !variant.preview);

  return (
    <div className="@4xl:flex-row @4xl:gap-6 @4xl:overflow-hidden flex min-h-0 flex-1 flex-col gap-4">
      <div className="@4xl:max-h-full @4xl:w-[26rem] @4xl:shrink-0 @4xl:overflow-y-auto">
        <FloatingPanel
          padding="md"
          mobileOnly
          className="lg:border-border/60 lg:bg-card lg:rounded-2xl lg:border lg:p-5 lg:shadow-sm"
        >
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!disabled && !isGenerating && !rendering) void handleGenerate();
            }}
          >
            {!canGenerate && (
              <p className="bg-muted/60 text-muted-foreground rounded-lg px-3 py-2 text-xs">
                You do not have permission to generate content for this property.
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span id="ai-post-goal-label" className="settings-field-label">
                  Goal
                </span>
                <TierBadge feature="aiMarketingGeneration" />
              </div>
              <div
                role="group"
                aria-labelledby="ai-post-goal-label"
                className="flex flex-wrap gap-1.5"
              >
                {GOALS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGoal(option.value)}
                    aria-pressed={goal === option.value}
                    className={cn(
                      'min-h-11 rounded-full border px-3.5 text-[13px] font-medium sm:min-h-9',
                      'transition-[border-color,background-color,color] duration-150 ease-out',
                      'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      goal === option.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/80 bg-background text-foreground hover:bg-muted/60'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ai-post-prompt" className="settings-field-label">
                  What should the post say?
                </Label>
                <span className="text-muted-foreground text-xs">Optional</span>
              </div>
              <Textarea
                id="ai-post-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value.slice(0, 500))}
                placeholder={PROMPT_PLACEHOLDER[goal]}
                rows={3}
                className="border-border/80 focus-visible:ring-primary/30 min-h-[88px] resize-y rounded-xl text-sm leading-relaxed"
              />
            </div>

            <AiStudioChoiceGroup
              label="Format"
              value={format}
              onChange={handleFormatChange}
              columns={4}
              options={FORMATS.map((option) => ({
                value: option.value,
                label: option.label,
                hint: option.hint,
                visual: <AiStudioShapePreview ratio={option.ratio} />,
              }))}
            />

            <div className="bg-card lg:border-border/60 pt-1 lg:sticky lg:bottom-0 lg:-mx-5 lg:-mb-5 lg:border-t lg:px-5 lg:pb-5 lg:pt-4">
              <Button
                type="submit"
                disabled={disabled || isGenerating || rendering}
                className="min-h-12 w-full gap-2 text-sm font-semibold"
              >
                {isGenerating || rendering ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {isGenerating ? 'Designing' : rendering ? 'Rendering' : 'Generate posts'}
              </Button>
            </div>
          </form>
        </FloatingPanel>
      </div>

      <div className="@4xl:overflow-y-auto @container min-h-0 min-w-0 flex-1">
        {variants.length === 0 && !isGenerating ? (
          <AiStudioEmptyState kind="post" />
        ) : (
          <div className="@md:grid-cols-2 grid grid-cols-1 gap-4">
            {(isGenerating ? Array.from({ length: 4 }, () => null) : variants).map(
              (variant, index) => (
                <div
                  key={variant?.key ?? `pending-${index}`}
                  className="border-border/60 bg-card overflow-hidden rounded-2xl border shadow-sm"
                >
                  {variant?.preview ? (
                    <img
                      src={variant.preview}
                      alt={variant.spec.copy.headline}
                      className={cn(
                        'animate-ai-gen-reveal block w-full object-cover',
                        aspectClass(format)
                      )}
                    />
                  ) : (
                    <div className={cn('relative w-full', aspectClass(format))}>
                      <AiStudioGeneratingStage
                        variant="fill"
                        label={isGenerating ? 'Designing post' : 'Rendering post'}
                      />
                    </div>
                  )}
                  {variant && (
                    <div className="flex flex-wrap gap-1.5 p-2.5">
                      <Button
                        size="sm"
                        className="min-h-11 sm:min-h-9"
                        variant="secondary"
                        disabled={!variant.preview || !canAddTemplate || busyKey !== null}
                        onClick={() => void handleEdit(variant)}
                      >
                        {busyKey === `${variant.key}:edit` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <PenLine className="size-4" />
                        )}
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="min-h-11 sm:min-h-9"
                        variant="ghost"
                        disabled={!variant.preview || busyKey !== null}
                        onClick={() => void handleShuffle(variant)}
                        aria-label="Try another layout"
                      >
                        <Shuffle className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="min-h-11 sm:min-h-9"
                        variant="ghost"
                        disabled={!variant.preview || busyKey !== null}
                        onClick={() => void handleDownload(variant)}
                        aria-label="Download"
                      >
                        <Download className="size-4" />
                      </Button>
                      {canPublish && (
                        <Button
                          size="sm"
                          className="ml-auto min-h-11 sm:min-h-9"
                          variant="ghost"
                          disabled={!variant.preview || busyKey !== null}
                          onClick={() => void handlePublish(variant)}
                        >
                          <Send className="size-4" />
                          Post
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
