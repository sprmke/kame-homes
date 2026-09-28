/**
 * AI art director for Marketing Studio posters
 * (docs/workflow/in-progress/marketing-ai-poster-studio.md, Phases 3–4).
 *
 * One multimodal call: the model *sees* the property's real photos, reads the fact
 * pack and the host's request, and returns N PosterSpecs (archetype, type system,
 * palette, short copy, which photos, which amenities). It never places elements and
 * never renders text into pixels: the UI compiles each spec into an editable Polotno
 * design with ui/src/features/dashboard/marketing/lib/poster/posterCompiler.ts.
 *
 * Enums below mirror ui/.../lib/poster/posterSpec.ts + posterFonts.ts. The UI's
 * normalizePosterSpec is the final authority; this module only enforces the rules
 * that need server context (photo allow-list, no invented amenities).
 */

import { z } from 'zod';

import { generateStructured, type LlmBilling, type LlmPart } from './ai/llmClient.ts';
import { definePrompt } from './ai/prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from './ai/untrusted.ts';
import { assertOrgAndPropertyAiQuota, type AiActorType } from './aiUsageService.ts';

const FEATURE = 'marketing_template' as const;

export const POSTER_DIRECTOR_PROMPT = definePrompt({
  id: 'marketing_template_poster',
  version: '2026-09-28.2',
});

export const POSTER_ARCHETYPES = [
  'wave-duo',
  'sky-headline',
  'night-glass',
  'minimal-title',
  'magazine-cover',
  'feature-sticker',
] as const;

export const POSTER_FONT_PAIRINGS = [
  'cozy-cafe',
  'tropical-script',
  'night-brush',
  'editorial-calm',
  'magazine-cover',
  'playful-pop',
  'modern-minimal',
  'sunny-weekend',
] as const;

export const POSTER_GOALS = [
  'vibe',
  'promo',
  'amenity-spotlight',
  'feature-spotlight',
  'stay-info',
] as const;

export type PosterGoal = (typeof POSTER_GOALS)[number];

/** Director-facing catalog: what each archetype is for and how much copy it holds. */
const ARCHETYPE_GUIDE = `
- wave-duo: cream brand field, two photos in organic wave frames, chunky name + script subtitle, 3 chips, 3 amenity icons, location pill. Best for cozy condos / everyday vibe. headline ≤ 3 words.
- sky-headline: full-bleed photo with calm sky or wall at the top; tracked eyebrow, one huge script word, bold caps line, banner, 5 icons and a check-in / check-out / deposit bar. Best for resorts, pools, stay info. accent = ONE word (e.g. "Bali").
- night-glass: dusk/night or moody photo darkened; script hero word in warm gold, frosted card with one descriptive sentence, icon grid, check-in card, location. Best for evening pool / lights shots.
- minimal-title: photo with only a refined serif title and a tracked subtitle. Best for beautiful rooms that should speak for themselves. headline ≤ 4 words.
- magazine-cover: big serif word + oversized script word ("Slow" / "mornings"), "at BRAND" wordmark, glass strip of 3–4 amenities. Best for bedroom / morning light shots. headline 1 word, accent 1–2 words.
- feature-sticker: two-tone chunky headline split in two halves ("Game on," / "stay in!"), circular sticker badge, "Perfect for" card with 4 use cases, script sign-off. Best for one standout amenity (PS5, jacuzzi, projector). headline 3–5 words with a natural break.`;

const FONT_GUIDE = `
- cozy-cafe: Fredoka chunky caps + Allura script (warm, cute, homey)
- tropical-script: Montserrat caps + Great Vibes script (resort, elegant)
- night-brush: Montserrat + Kaushan brush script (evening, bold)
- editorial-calm: Cormorant serif caps + Jost tracked caps (calm, premium, minimal)
- magazine-cover: Playfair + Sacramento script (soft editorial)
- playful-pop: Lilita One outlined caps + Kaushan (fun, games, families)
- modern-minimal: DM Serif Display + Montserrat (clean modern)
- sunny-weekend: Baloo chunky + Great Vibes (bright, friendly)`;

const SYSTEM_PROMPT = withUntrustedDataRule(
  [
    'You are the art director for a vacation-rental marketing tool. You design Instagram and',
    'Facebook posts for one real property, choosing from fixed, hand-designed layouts. A',
    'separate engine renders your choices; you never describe coordinates.',
    '',
    'Look at the attached photos (numbered in order) before deciding anything:',
    '- Pick photoIndexes, hero first. Prefer sharp, bright, well-composed shots that match the goal.',
    '  sky-headline and minimal-title need calm space (sky, wall, ceiling) at the top of the hero.',
    '  night-glass suits evening or moody shots. wave-duo uses two different photos.',
    '- Palette: pick accent/secondary/field hexes that harmonize with the hero photo and the',
    '  brand color. Field is a light paper tone (cream, sand, blush). Accent carries pills and',
    '  icons, so it must be mid-dark. Secondary is a second real hue sampled from the photo',
    '  (leaf green, pool teal, terracotta, dusk navy), never gray or black. Avoid neon.',
    '- Use different hero photos across variants when more than one photo suits the goal.',
    '',
    'Layouts:',
    ARCHETYPE_GUIDE,
    '',
    'Type systems:',
    FONT_GUIDE,
    '',
    'Copy rules (strict):',
    '- Short, warm, specific, human. Sound like a boutique host, not an ad bot. Anchor copy in',
    '  what is visible in the photos (the view, the light, the coffee, the pool) and the host',
    '  request, so the post could only be about this place.',
    '- Banned generic phrases: "sweet escape", "home away from home", "your home away",',
    '  "experience comfort", "ultimate comfort", "perfect getaway", "luxury awaits",',
    '  "unwind in luxury", "look no further", "book now" (prefer "Book your stay").',
    '- eyebrow ≤ 5 words, headline ≤ 5 words (respect each layout limit), accent ≤ 4 words,',
    '  subhead one sentence ≤ 18 words, chips exactly 3 items of 1–2 words, tagline ≤ 8 words',
    '  (rhythmic, e.g. "Sip slow. Breathe deep."), cta ≤ 4 words, badge ≤ 6 words, listTitle ≤ 3 words.',
    '- Never use em dashes or en dashes. No emojis. No hashtags. No exclamation spam (max one).',
    '- Never invent facts: no prices, discounts, dates, times, amenities or places that are not in',
    '  the property facts or the host request. Check-in times, deposit and location are printed by',
    '  the engine from facts, so do not repeat them in copy.',
    '- features: amenity labels copied from the facts list, or a use case for feature-sticker',
    '  ("Family bonding", "Game nights"). Keep each 1–3 words.',
    '- Match the host language. Taglish is fine when the host writes that way.',
    '',
    'Return exactly the requested number of variants. Each variant must use a different',
    'archetype, and vary the type system, so the host gets real choices.',
  ].join('\n')
);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    variants: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          archetype: { type: 'STRING', enum: [...POSTER_ARCHETYPES] },
          fontPairing: { type: 'STRING', enum: [...POSTER_FONT_PAIRINGS] },
          palette: {
            type: 'OBJECT',
            properties: {
              accent: { type: 'STRING' },
              secondary: { type: 'STRING' },
              field: { type: 'STRING' },
            },
            required: ['accent', 'secondary', 'field'],
          },
          copy: {
            type: 'OBJECT',
            properties: {
              eyebrow: { type: 'STRING' },
              headline: { type: 'STRING' },
              accent: { type: 'STRING' },
              subhead: { type: 'STRING' },
              chips: { type: 'ARRAY', items: { type: 'STRING' } },
              tagline: { type: 'STRING' },
              cta: { type: 'STRING' },
              badge: { type: 'STRING' },
              listTitle: { type: 'STRING' },
            },
            required: ['eyebrow', 'headline', 'accent', 'subhead', 'chips', 'tagline', 'cta'],
          },
          features: { type: 'ARRAY', items: { type: 'STRING' } },
          photoIndexes: { type: 'ARRAY', items: { type: 'INTEGER' } },
          label: { type: 'STRING' },
        },
        required: ['archetype', 'fontPairing', 'palette', 'copy', 'features', 'photoIndexes'],
      },
    },
  },
  required: ['variants'],
} as const;

const responseContract = z
  .object({ variants: z.array(z.record(z.unknown())).min(1) })
  .passthrough();

export type PosterFactsInput = {
  propertyName: string;
  brandName: string | null;
  location: string | null;
  checkIn: string | null;
  checkOut: string | null;
  securityDeposit: string | null;
  nightlyRate: string | null;
  amenities: string[];
};

export type PosterPhotoInput = { url: string; mimeType: string; data: string };

export type GeneratePosterSpecsInput = {
  organizationId: string;
  propertyId: string;
  actorUserId?: string | null;
  actorType?: AiActorType;
  goal: PosterGoal;
  prompt: string;
  facts: PosterFactsInput;
  brandColor: string | null;
  /** Already allow-listed and fetched (see loadPosterPhotos). Index = photoIndexes. */
  photos: PosterPhotoInput[];
  count: number;
};

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/i)
    .filter((word) => word.length > 2);
}

/**
 * Server-side grounding: an amenity-like feature survives only when it matches a stored
 * amenity or something the host typed. Use-case labels on feature-sticker ("Game nights")
 * are allowed because they describe who the stay is for, not a claim about the unit.
 */
export function groundPosterFeatures(
  features: unknown,
  archetype: unknown,
  facts: PosterFactsInput,
  hostPrompt: string
): string[] {
  if (!Array.isArray(features)) return [];
  const known = new Set([...facts.amenities.flatMap(words), ...words(hostPrompt)]);
  return features
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 40))
    .filter((label) => {
      if (archetype === 'feature-sticker') return true;
      return words(label).some((word) => known.has(word));
    })
    .slice(0, 7);
}

/** Enforced, not just requested: the model drifts back to stock hospitality phrases. */
const BANNED_COPY =
  /sweet escape|home away|experience (true |ultimate )?comfort|ultimate comfort|perfect getaway|luxury awaits|unwind in luxury|look no further/i;

export function stripBannedCopy(copy: unknown): Record<string, unknown> {
  if (!copy || typeof copy !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(copy as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = BANNED_COPY.test(value) ? '' : value;
    else if (Array.isArray(value)) {
      out[key] = value.filter((item) => typeof item === 'string' && !BANNED_COPY.test(item));
    } else out[key] = value;
  }
  return out;
}

/** Exported for tests. */
export function sanitizeVariant(
  raw: Record<string, unknown>,
  input: GeneratePosterSpecsInput
): Record<string, unknown> {
  const photoIndexes = Array.isArray(raw.photoIndexes)
    ? raw.photoIndexes.filter(
        (value): value is number =>
          Number.isInteger(value) &&
          (value as number) >= 0 &&
          (value as number) < input.photos.length
      )
    : [];
  return {
    ...raw,
    goal: input.goal,
    copy: stripBannedCopy(raw.copy),
    features: groundPosterFeatures(raw.features, raw.archetype, input.facts, input.prompt).map(
      (label) => ({ label })
    ),
    photoIndexes,
  };
}

function buildUserParts(input: GeneratePosterSpecsInput): LlmPart[] {
  const facts = input.facts;
  const factLines = [
    `Property: ${facts.propertyName}`,
    facts.brandName ? `Brand: ${facts.brandName}` : null,
    facts.location ? `Location: ${facts.location}` : null,
    facts.amenities.length ? `Amenities: ${facts.amenities.slice(0, 20).join(', ')}` : null,
    facts.nightlyRate ? `Nightly rate from: ${facts.nightlyRate}` : null,
    input.brandColor ? `Brand color: ${input.brandColor}` : null,
  ].filter(Boolean);
  const parts: LlmPart[] = [
    {
      text: [
        `Goal: ${input.goal}`,
        `Variants to return: ${input.count}`,
        wrapUntrusted('property_facts', factLines.join('\n'), 1_500),
        input.prompt
          ? `Host request:\n${wrapUntrusted('host_prompt', input.prompt, 500)}`
          : 'Host request: none, choose the strongest angle for the goal.',
        `Photos attached: ${input.photos.length} (photo 0 is the first image below).`,
      ].join('\n\n'),
    },
  ];
  input.photos.forEach((photo, index) => {
    parts.push(
      { text: `Photo ${index}:` },
      { inlineData: { mimeType: photo.mimeType, data: photo.data } }
    );
  });
  return parts;
}

/** The model call itself, with explicit billing (callers own quota checks). */
export async function directPosterSpecs(
  input: GeneratePosterSpecsInput,
  billing: LlmBilling
): Promise<Array<Record<string, unknown>>> {
  const result = await generateStructured({
    feature: FEATURE,
    prompt: POSTER_DIRECTOR_PROMPT,
    system: SYSTEM_PROMPT,
    user: buildUserParts(input),
    temperature: 0.9,
    // Four full specs run ~2.5k tokens; the feature default (1024) would truncate them.
    maxOutputTokens: 6_000,
    schema: responseContract,
    jsonSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    // Images make every request unique, so there is no response cache.
    billing,
  });
  return result.data.variants
    .slice(0, input.count)
    .map((variant) => sanitizeVariant(variant, input));
}

export async function generatePosterSpecs(
  input: GeneratePosterSpecsInput
): Promise<Array<Record<string, unknown>>> {
  await assertOrgAndPropertyAiQuota(input.organizationId, input.propertyId, FEATURE);
  return directPosterSpecs(input, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? 'staff',
    quotaChecked: true,
  });
}

// ---------------------------------------------------------------------------
// Photo loading (allow-listed)
// ---------------------------------------------------------------------------

const PHOTO_FETCH_TIMEOUT_MS = 6_000;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
/**
 * Gemini rejects inline requests over ~20 MB, and base64 inflates bytes by 4/3, so the
 * photos in one call share a 12 MB raw budget. Photos past it are skipped in order.
 */
const PHOTO_TOTAL_BYTES = 12 * 1024 * 1024;
export const POSTER_MAX_PHOTOS = 6;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Every image URL stored on the property (gallery media + legacy images list). */
export function allowedPropertyPhotoUrls(settings: Record<string, unknown>): Set<string> {
  const urls = new Set<string>();
  if (Array.isArray(settings.media)) {
    for (const item of settings.media) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (row.type === 'video' || typeof row.url !== 'string') continue;
      if (row.url.trim()) urls.add(row.url.trim());
    }
  }
  if (Array.isArray(settings.images)) {
    for (const url of settings.images) {
      if (typeof url === 'string' && url.trim()) urls.add(url.trim());
    }
  }
  return urls;
}

/**
 * Fetches the requested photos, but only URLs already stored on this property (so the
 * endpoint cannot be used to make the server fetch arbitrary URLs). Failed or oversized
 * photos are skipped; the returned `urls` keeps photoIndexes aligned with what the
 * model actually saw.
 */
export async function loadPosterPhotos(
  requested: string[],
  allowed: Set<string>
): Promise<{ urls: string[]; photos: PosterPhotoInput[] }> {
  const candidates = [...new Set(requested.map((url) => url.trim()))]
    .filter((url) => allowed.has(url) && /^https:\/\//i.test(url))
    .slice(0, POSTER_MAX_PHOTOS);
  const loaded = await Promise.all(
    candidates.map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
        const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
        if (!response.ok || !/^image\/(jpeg|png|webp)$/.test(mimeType)) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) return null;
        return { url, mimeType, data: bytesToBase64(bytes) };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  const ok: PosterPhotoInput[] = [];
  let total = 0;
  for (const item of loaded) {
    if (!item) continue;
    const bytes = Math.floor((item.data.length * 3) / 4);
    if (total + bytes > PHOTO_TOTAL_BYTES) continue;
    total += bytes;
    ok.push(item);
  }
  return { urls: ok.map((item) => item.url), photos: ok };
}
