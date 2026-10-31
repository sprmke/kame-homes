import { useCallback, useMemo, useRef } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOptionalMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  generatePosters,
  requestPosterSpecs,
} from '@/features/dashboard/marketing/hooks/useGeneratePosters';
import {
  invalidateMarketingLibrary,
  saveMarketingTemplate,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import {
  compilePosterDocument,
  type PhotoSizeMap,
} from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { preloadPosterFonts } from '@/features/dashboard/marketing/lib/poster/posterFontLoader';
import { loadPosterPhotoSizes } from '@/features/dashboard/marketing/lib/poster/posterPhotoSizes';
import type { renderPosterDocument as RenderPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterRender';
import {
  compactPosterPhotos,
  normalizePosterSpec,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { marketingThemeFontList } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import { themeStampForSave } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import { findMarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

/**
 * The renderer pulls in Konva + OpenPolotno (~1.5 MB). AI Studio is the landing tab,
 * so it loads only when a post renders.
 */
const renderPosterDocument: typeof RenderPosterDocument = (...args) =>
  import('@/features/dashboard/marketing/lib/poster/posterRender').then((m) =>
    m.renderPosterDocument(...args)
  );

/** Stored with each version: sharp enough for the stage, small enough for Storage. */
const PREVIEW_PIXEL_RATIO = 0.75;

export type RenderedPost = {
  spec: PosterSpec;
  photoUrls: string[];
  format: DesignTemplateFormat;
  document: PolotnoDesignDocument;
  previewDataUrl: string;
};

/**
 * AI Post engine for AI Studio: the AI art director picks layouts, type and copy for
 * the property's real photos; the poster compiler turns each spec into an editable
 * design. Facts (times, deposit, amenities) come from settings, never the model.
 */
export function useAiPosterEngine(themeKey?: string | null) {
  const { property, org } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const studio = useOptionalMarketingTheme();
  const { data: publicProperty, isLoading: propertyLoading } = usePublicPropertyDetail(
    property.slug
  );
  const { data: appSettings } = useAppSettings();
  const { data: orgSettings } = useOrgSettings();
  const orgBrandColor = useOrgBrandColor();

  // A conversation keeps the theme it started in; new posts use the open theme.
  const themeEntry =
    (studio && themeKey ? findMarketingThemeEntry(studio.library, themeKey) : null) ??
    studio?.active ??
    null;
  const themeTokens: MarketingThemeTokens | null = themeEntry?.tokens ?? null;
  const brandColor =
    themeTokens?.palette.primary ?? appSettings?.resolvedBrandColor ?? orgBrandColor ?? null;
  const logoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;

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

  const sizesRef = useRef(new Map<string, Promise<PhotoSizeMap>>());
  const photoSizes = useCallback((urls: string[]) => {
    const key = urls.join('\n');
    let pending = sizesRef.current.get(key);
    if (!pending) {
      pending = loadPosterPhotoSizes(urls);
      sizesRef.current.set(key, pending);
    }
    return pending;
  }, []);

  const loadFonts = useCallback(
    () =>
      Promise.all([
        preloadPosterFonts(),
        themeTokens ? loadMarketingFonts(marketingThemeFontList(themeTokens.fonts)) : undefined,
      ]),
    [themeTokens]
  );

  const factsFor = useCallback(
    (photoUrls: string[]): PosterFacts =>
      photoUrls.length > 0 ? { ...baseFacts, photos: photoUrls } : baseFacts,
    [baseFacts]
  );

  const compile = useCallback(
    async (spec: PosterSpec, photoUrls: string[], format: DesignTemplateFormat) =>
      compilePosterDocument(spec, factsFor(photoUrls), format, {
        photoSizes: await photoSizes(factsFor(photoUrls).photos),
        brandColor,
        theme: themeTokens,
      }),
    [factsFor, photoSizes, brandColor, themeTokens]
  );

  const render = useCallback(
    async (
      spec: PosterSpec,
      photoUrls: string[],
      format: DesignTemplateFormat
    ): Promise<RenderedPost> => {
      await loadFonts();
      // A version stores its own photos, so keep only the ones this post places.
      const compact = compactPosterPhotos(spec, photoUrls);
      const document = await compile(compact.spec, compact.photoUrls, format);
      const rendered = await renderPosterDocument(document, {
        pixelRatio: PREVIEW_PIXEL_RATIO,
        mimeType: 'image/jpeg',
      });
      return {
        spec: compact.spec,
        photoUrls: compact.photoUrls,
        format,
        document: rendered.document,
        previewDataUrl: rendered.dataUrl,
      };
    },
    [compile, loadFonts]
  );

  /** First message: four posts, best-laid-out first. */
  const generateBatch = useCallback(
    async (input: { goal: PosterGoal; prompt: string; format: DesignTemplateFormat }) => {
      const [result] = await Promise.all([
        generatePosters(propertyId, {
          goal: input.goal,
          prompt: input.prompt,
          facts: baseFacts,
          brandColor,
        }),
        loadFonts(),
      ]);
      const photos = result.facts.photos;
      const scored = await Promise.all(
        result.specs.map(async (spec) => ({
          spec,
          issues: auditPosterDocument(await compile(spec, photos, input.format)).length,
        }))
      );
      // Layout QA: posts with collisions or overflow go last, never first.
      scored.sort((a, b) => a.issues - b.issues);
      return {
        specs: scored.map((item) => item.spec),
        photoUrls: photos,
        aiDirected: result.aiDirected,
      };
    },
    [propertyId, baseFacts, brandColor, loadFonts, compile]
  );

  /** A refinement: the AI revises the current post; no rule-based fallback. */
  const revise = useCallback(
    async (input: {
      spec: PosterSpec;
      photoUrls: string[];
      goal: PosterGoal;
      originalPrompt: string;
      instruction: string;
    }) => {
      const facts = factsFor(input.photoUrls);
      const response = await requestPosterSpecs(propertyId, {
        goal: input.goal,
        prompt: input.originalPrompt,
        facts,
        brandColor,
        count: 1,
        revise: {
          spec: input.spec as unknown as Record<string, unknown>,
          instruction: input.instruction,
        },
      });
      const photoUrls = Array.isArray(response?.photoUrls)
        ? response.photoUrls.filter((url): url is string => typeof url === 'string' && url !== '')
        : [];
      const nextFacts = photoUrls.length > 0 ? { ...facts, photos: photoUrls } : facts;
      const raw = Array.isArray(response?.variants) ? response.variants[0] : null;
      if (!raw) throw new Error('Could not change this post. Try different words.');
      return { spec: normalizePosterSpec(raw, nextFacts), photoUrls: nextFacts.photos };
    },
    [propertyId, factsFor, brandColor]
  );

  /** Full-size PNG for Download / Publish. */
  const exportBlob = useCallback(
    async (spec: PosterSpec, photoUrls: string[], format: DesignTemplateFormat) => {
      await loadFonts();
      const document = await compile(spec, photoUrls, format);
      const rendered = await renderPosterDocument(document, {
        pixelRatio: 1,
        mimeType: 'image/png',
      });
      return (await fetch(rendered.dataUrl)).blob();
    },
    [compile, loadFonts]
  );

  /** Saves the post as an editable design and returns its id (Posts editor). */
  const saveToPosts = useCallback(
    async (input: {
      spec: PosterSpec;
      photoUrls: string[];
      format: DesignTemplateFormat;
      name: string;
      previewUrl: string | null;
    }) => {
      await loadFonts();
      const document = await compile(input.spec, input.photoUrls, input.format);
      const record = await saveMarketingTemplate(propertyId, {
        name: input.name,
        contentType: 'design',
        aspectPreset: input.format,
        platform: input.format.includes('facebook') ? 'facebook' : 'instagram',
        kind: 'design',
        ...(themeEntry ? { themeKey: themeEntry.key } : {}),
        designJson: {
          ...(themeTokens ? themeStampForSave(themeTokens) : {}),
          templateId: '',
          format: input.format,
          aiGenerated: true,
          posterSpec: input.spec,
          polotno: document,
        },
      });
      invalidateMarketingLibrary(queryClient, propertyId);
      return record.id;
    },
    [loadFonts, compile, propertyId, themeEntry, themeTokens, queryClient]
  );

  return {
    ready: !propertyLoading,
    themeKey: themeEntry?.key ?? null,
    baseFacts,
    generateBatch,
    render,
    revise,
    exportBlob,
    saveToPosts,
  };
}

export type AiPosterEngine = ReturnType<typeof useAiPosterEngine>;
