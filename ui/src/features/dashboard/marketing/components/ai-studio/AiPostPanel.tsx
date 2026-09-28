import { useCallback, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, PenLine, Send, Shuffle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
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

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const GOALS: Array<{ value: PosterGoal; label: string }> = [
  { value: 'vibe', label: 'Vibe' },
  { value: 'promo', label: 'Promo' },
  { value: 'amenity-spotlight', label: 'Amenities' },
  { value: 'feature-spotlight', label: 'Feature' },
  { value: 'stay-info', label: 'Stay info' },
];

const FORMATS: Array<{ value: DesignTemplateFormat; label: string }> = [
  { value: 'instagram-portrait', label: 'Portrait' },
  { value: 'instagram-post', label: 'Square' },
  { value: 'instagram-story', label: 'Story' },
  { value: 'facebook-post', label: 'Facebook' },
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6 lg:overflow-hidden">
      <div className="lg:max-h-full lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto">
        <div className="lg:border-border/60 lg:bg-card flex flex-col gap-4 lg:rounded-2xl lg:border lg:p-5 lg:shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-foreground text-base font-semibold">AI Post</h2>
            <TierBadge feature="aiMarketingGeneration" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium">Goal</span>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGoal(option.value)}
                  aria-pressed={goal === option.value}
                  className={cn(
                    'min-h-9 rounded-full border px-3.5 text-sm transition-colors',
                    goal === option.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium">Format</span>
            <SegmentedControl
              value={format}
              onChange={handleFormatChange}
              options={FORMATS}
              fullWidth
              aria-label="Format"
            />
          </div>

          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 500))}
            placeholder={PROMPT_PLACEHOLDER[goal]}
            rows={3}
            aria-label="What should the post say?"
          />

          <Button
            onClick={() => void handleGenerate()}
            disabled={disabled || isGenerating || rendering}
            className="min-h-11 w-full"
          >
            {isGenerating || rendering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isGenerating ? 'Designing' : rendering ? 'Rendering' : 'Generate posts'}
          </Button>
          {!canGenerate && (
            <p className="text-muted-foreground text-xs">
              You do not have permission to generate content for this property.
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto">
        {variants.length === 0 && !isGenerating ? (
          <div className="border-border/60 text-muted-foreground flex min-h-48 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm">
            Posts made from your listing photos show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      className={cn('block w-full object-cover', aspectClass(format))}
                    />
                  ) : (
                    <Skeleton className={cn('w-full rounded-none', aspectClass(format))} />
                  )}
                  {variant && (
                    <div className="flex flex-wrap gap-1.5 p-2.5">
                      <Button
                        size="sm"
                        className="h-10 sm:h-9"
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
                        className="h-10 sm:h-9"
                        variant="ghost"
                        disabled={!variant.preview || busyKey !== null}
                        onClick={() => void handleShuffle(variant)}
                        aria-label="Try another layout"
                      >
                        <Shuffle className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-10 sm:h-9"
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
                          className="ml-auto h-10 sm:h-9"
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
