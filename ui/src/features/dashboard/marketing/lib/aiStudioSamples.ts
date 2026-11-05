/**
 * AI Studio examples: what each output looks like, and the exact settings that made it.
 *
 * Posts are drawn live from the host's own listing (no AI call, no files); with no listing
 * photos they use a stand-in showcase listing built from stock photos. Photos and clips
 * were made once by the production generation code (`scripts/marketing/ai-studio-samples/`)
 * from free stock photos and ship as static files under `ui/public/marketing/ai-studio/samples`.
 *
 * Rule: a photo or clip recipe and its files change together. Editing a prompt or setting
 * here without regenerating the asset breaks the promise that the example is reproducible.
 *
 * Only `import type` from UI modules other than pricing/options, so the Deno generator can
 * import this file through its `@/` import map.
 */
import { READY_SAMPLE_IDS } from '@/features/dashboard/marketing/lib/aiStudioSampleAssets';
import {
  GENERATION_LOOKS,
  MAX_LOOK_SUFFIX_CHARS,
  composeGenerationPrompt,
  type VideoCameraMoveId,
  type VideoSoundMode,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_VIDEO_DURATION,
  DRAFT_VIDEO_RESOLUTION,
  MAX_IMAGE_PROMPT_CHARS,
  MAX_VIDEO_PROMPT_CHARS,
  estimateGenerationCredits,
  type ImageSize,
  type VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import type {
  PosterArchetypeId,
  PosterFacts,
  PosterGoal,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

export const AI_STUDIO_SAMPLES_BASE = '/marketing/ai-studio/samples';
export const POST_SAMPLE_PROMPT_MAX = 500;

export type SampleSource = {
  provider: 'pexels';
  /** Provider photo id. */
  id: string;
  /** Photo page, for the credits file. */
  pageUrl: string;
  photographer: string;
};

type SampleBase = {
  /** Stable, kebab-case; used in URLs (`?sample=`) and analytics. */
  id: string;
  output: AiStudioOutput;
  title: string;
  /** What the host should add for a result like this one. */
  need: string;
  order: number;
};

export type PostSample = SampleBase & {
  output: 'post';
  goal: PosterGoal;
  /** The layout placed first when this example is used. */
  archetype: PosterArchetypeId;
  format: DesignTemplateFormat;
  /** Optional host words sent with the request; '' lets the angle carry it. */
  prompt: string;
  /** Facts a live render needs to look right; the example hides without them. */
  requires: Array<'amenities' | 'stayTimes'>;
};

export type PhotoSample = SampleBase & {
  output: 'image';
  /** Host words, without the look suffix. */
  prompt: string;
  lookId: string | null;
  aspect: '1:1' | '4:5' | '9:16' | '16:9';
  tier: 'standard';
  imageSize: ImageSize;
  enhancePrompt: boolean;
  source: SampleSource;
};

export type ClipSample = SampleBase & {
  output: 'video';
  prompt: string;
  cameraMove: VideoCameraMoveId;
  sound: VideoSoundMode;
  aspect: '9:16' | '16:9';
  tier: 'standard';
  resolution: VideoResolution;
  enhancePrompt: boolean;
  source: SampleSource;
};

export type AiStudioSample = PostSample | PhotoSample | ClipSample;

export const POST_SAMPLES: PostSample[] = [
  {
    id: 'post-weekend-escape',
    output: 'post',
    title: 'Weekend escape',
    need: 'Uses your listing photos',
    order: 1,
    goal: 'vibe',
    archetype: 'magazine-cover',
    format: 'instagram-portrait',
    prompt: '',
    requires: [],
  },
  {
    id: 'post-book-direct',
    output: 'post',
    title: 'Book direct',
    need: 'Uses your listing photos',
    order: 2,
    goal: 'promo',
    archetype: 'sky-headline',
    format: 'instagram-portrait',
    prompt: 'Book direct for weekday stays',
    requires: [],
  },
  {
    id: 'post-pool-day',
    output: 'post',
    title: 'Amenity spotlight',
    need: 'Uses your listing photos and amenities',
    order: 3,
    goal: 'amenity-spotlight',
    archetype: 'feature-sticker',
    format: 'instagram-post',
    prompt: '',
    requires: ['amenities'],
  },
  {
    id: 'post-night-in',
    output: 'post',
    title: 'Night in',
    need: 'Uses your listing photos',
    order: 4,
    goal: 'promo',
    archetype: 'night-glass',
    format: 'instagram-story',
    prompt: 'Late check-out on weekday stays',
    requires: [],
  },
  {
    id: 'post-standout',
    output: 'post',
    title: 'Standout feature',
    need: 'Uses your listing photos and amenities',
    order: 5,
    goal: 'feature-spotlight',
    archetype: 'magazine-cover',
    format: 'instagram-portrait',
    prompt: '',
    requires: ['amenities'],
  },
  {
    id: 'post-check-in-guide',
    output: 'post',
    title: 'Check-in guide',
    need: 'Uses your check-in and check-out times',
    order: 6,
    goal: 'stay-info',
    archetype: 'minimal-title',
    format: 'instagram-story',
    prompt: '',
    requires: ['stayTimes'],
  },
];

export const PHOTO_SAMPLES: PhotoSample[] = [
  {
    id: 'photo-golden-balcony',
    output: 'image',
    title: 'Golden hour balcony',
    need: 'A photo of your balcony or view',
    order: 1,
    prompt:
      'Bedroom opening onto the balcony, sheer curtains, two cups of coffee on the balcony table, green hills in the distance',
    lookId: 'golden-hour',
    aspect: '4:5',
    tier: 'standard',
    imageSize: '1K',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '7501132',
      pageUrl: 'https://www.pexels.com/photo/a-bedroom-with-a-balcony-7501132/',
      photographer: 'Gustavo Galeano Maz',
    },
  },
  {
    id: 'photo-bright-living',
    output: 'image',
    title: 'Bright living room',
    need: 'A photo of your living room',
    order: 2,
    prompt: 'Living room with fresh flowers on the coffee table and green plants by the window',
    lookId: 'bright-airy',
    aspect: '4:5',
    tier: 'standard',
    imageSize: '1K',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '3209045',
      pageUrl: 'https://www.pexels.com/photo/3209045/',
      photographer: 'Jason Boyd',
    },
  },
  {
    id: 'photo-ready-bedroom',
    output: 'image',
    title: 'Ready for guests',
    need: 'A photo of your bedroom',
    order: 3,
    prompt: 'Freshly made bed with folded white towels and a breakfast tray with two coffee cups',
    lookId: 'bright-airy',
    aspect: '1:1',
    tier: 'standard',
    imageSize: '1K',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '6782567',
      pageUrl: 'https://www.pexels.com/photo/6782567/',
      photographer: 'Max Vakhtbovych',
    },
  },
  {
    id: 'photo-city-lights',
    output: 'image',
    title: 'City lights',
    need: 'A photo with a window or a view',
    order: 4,
    prompt: 'Living room at night with the city lights glowing through the big windows',
    lookId: 'evening-glow',
    aspect: '9:16',
    tier: 'standard',
    imageSize: '1K',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '1918291',
      pageUrl: 'https://www.pexels.com/photo/1918291/',
      photographer: 'Chait Goli',
    },
  },
  {
    id: 'photo-blue-hour-pool',
    output: 'image',
    title: 'Pool at blue hour',
    need: 'A photo of your pool',
    order: 5,
    prompt: 'Rooftop pool with the water lit up and the city skyline around it',
    lookId: 'blue-hour',
    aspect: '16:9',
    tier: 'standard',
    imageSize: '1K',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '261102',
      pageUrl: 'https://www.pexels.com/photo/261102/',
      photographer: 'Pixabay',
    },
  },
  {
    id: 'photo-rainy-cozy',
    output: 'image',
    title: 'Rainy day in',
    need: 'A photo of your living room or bedroom',
    order: 6,
    prompt: 'Cozy living room on a rainy day, a soft throw blanket on the sofa, rain on the window',
    lookId: 'rainy-cozy',
    aspect: '4:5',
    tier: 'standard',
    imageSize: '1K',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '1457842',
      pageUrl: 'https://www.pexels.com/photo/1457842/',
      photographer: 'Jean van der Meulen',
    },
  },
];

export const CLIP_SAMPLES: ClipSample[] = [
  {
    id: 'clip-living-push',
    output: 'video',
    title: 'Living room reveal',
    need: 'A wide photo of your living room',
    order: 1,
    prompt: 'Slow move toward the sofa, soft daylight shifting across the floor',
    cameraMove: 'push-in',
    sound: 'ambient',
    aspect: '16:9',
    tier: 'standard',
    resolution: '720p',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '1571460',
      pageUrl: 'https://www.pexels.com/photo/1571460/',
      photographer: 'Viaceslav Kat',
    },
  },
  {
    id: 'clip-balcony-breeze',
    output: 'video',
    title: 'Balcony breeze',
    need: 'A photo with curtains or plants',
    order: 2,
    prompt: 'Curtains moving gently in the breeze, the city calm in the background',
    cameraMove: 'still',
    sound: 'ambient',
    aspect: '9:16',
    tier: 'standard',
    resolution: '720p',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '7534285',
      pageUrl:
        'https://www.pexels.com/photo/chairs-and-coffee-table-placed-in-patio-of-contemporary-apartment-7534285/',
      photographer: 'Max Vakhtbovych',
    },
  },
  {
    id: 'clip-pool-orbit',
    output: 'video',
    title: 'Pool at sunset',
    need: 'A photo of your pool',
    order: 3,
    prompt: 'Slow arc around the pool at sunset, the water rippling and the lights glowing',
    cameraMove: 'orbit',
    sound: 'music',
    aspect: '16:9',
    tier: 'standard',
    resolution: '720p',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '261102',
      pageUrl: 'https://www.pexels.com/photo/261102/',
      photographer: 'Pixabay',
    },
  },
  {
    id: 'clip-walkthrough',
    output: 'video',
    title: 'Walkthrough',
    need: 'A photo that looks down a room',
    order: 4,
    prompt: 'Smooth walk through the lounge toward the windows and the sea view',
    cameraMove: 'walkthrough',
    sound: 'music',
    aspect: '9:16',
    tier: 'standard',
    resolution: '720p',
    enhancePrompt: true,
    source: {
      provider: 'pexels',
      id: '2507010',
      pageUrl: 'https://www.pexels.com/photo/2507010/',
      photographer: 'Quark Studio',
    },
  },
];

export const AI_STUDIO_SAMPLES: AiStudioSample[] = [
  ...POST_SAMPLES,
  ...PHOTO_SAMPLES,
  ...CLIP_SAMPLES,
];

const SAMPLE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSampleIdShape(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && SAMPLE_ID_RE.test(value);
}

/** Examples to show (photo and clip ones only once their files ship), in catalog order. */
export function listSamples(
  output?: AiStudioOutput | null,
  readyIds: readonly string[] = READY_SAMPLE_IDS
): AiStudioSample[] {
  return AI_STUDIO_SAMPLES.filter(
    (sample) => (!output || sample.output === output) && isSampleReady(sample, readyIds)
  ).sort((a, b) => (a.output === b.output ? a.order - b.order : 0));
}

export function findSample(
  id: string | null | undefined,
  readyIds: readonly string[] = READY_SAMPLE_IDS
): AiStudioSample | null {
  if (!isSampleIdShape(id)) return null;
  const sample = AI_STUDIO_SAMPLES.find((item) => item.id === id) ?? null;
  return sample && isSampleReady(sample, readyIds) ? sample : null;
}

/** A post example whose live render would be missing what makes it work stays hidden. */
export function postSampleAvailable(
  sample: PostSample,
  facts: Pick<PosterFacts, 'amenities' | 'checkIn' | 'checkOut'>
): boolean {
  return sample.requires.every((need) =>
    need === 'amenities'
      ? facts.amenities.length > 0
      : Boolean(facts.checkIn?.trim() || facts.checkOut?.trim())
  );
}

// ── Files ────────────────────────────────────────────────────────────────────

export type SampleImage = {
  /** Smallest WebP, for `src`. */
  src: string;
  webpSrcSet: string;
  avifSrcSet: string;
  width: number;
  height: number;
};

export const SAMPLE_IMAGE_WIDTHS = [480, 960] as const;
const SAMPLE_IMAGE_EXTS = ['webp', 'avif'] as const;

export function aspectSize(aspect: string): { width: number; height: number } {
  const [w, h] = aspect.split(':').map(Number);
  return { width: w && h ? w : 1, height: w && h ? h : 1 };
}

export function postFormatAspect(format: DesignTemplateFormat): string {
  switch (format) {
    case 'instagram-story':
      return '9:16';
    case 'instagram-portrait':
      return '4:5';
    case 'facebook-post':
      return '40:21';
    default:
      return '1:1';
  }
}

function sampleImage(stem: string, aspect: string): SampleImage {
  const set = (ext: string) =>
    SAMPLE_IMAGE_WIDTHS.map((width) => `${stem}-${width}.${ext} ${width}w`).join(', ');
  return {
    src: `${stem}-${SAMPLE_IMAGE_WIDTHS[0]}.webp`,
    webpSrcSet: set('webp'),
    avifSrcSet: set('avif'),
    ...aspectSize(aspect),
  };
}

function imagePaths(image: SampleImage): string[] {
  const stem = image.src.replace(/-\d+\.webp$/, '');
  return SAMPLE_IMAGE_WIDTHS.flatMap((width) =>
    SAMPLE_IMAGE_EXTS.map((ext) => `${stem}-${width}.${ext}`)
  );
}

/** A stock source photo, cropped to the example's shape ("before"). */
export function sourceImage(sample: PhotoSample | ClipSample): SampleImage {
  return sampleImage(
    `${AI_STUDIO_SAMPLES_BASE}/${sample.output === 'image' ? 'photos' : 'clips'}/${sample.id}-before`,
    sample.aspect
  );
}

export type SampleFiles =
  | { kind: 'image'; before: SampleImage; after: SampleImage }
  | { kind: 'video'; before: SampleImage; poster: SampleImage; mp4: string };

/** Files a photo or clip example ships with (public, root-relative). Posts have none. */
export function sampleFiles(sample: PhotoSample | ClipSample): SampleFiles {
  if (sample.output === 'image') {
    return {
      kind: 'image',
      before: sourceImage(sample),
      after: sampleImage(`${AI_STUDIO_SAMPLES_BASE}/photos/${sample.id}-after`, sample.aspect),
    };
  }
  return {
    kind: 'video',
    before: sourceImage(sample),
    poster: sampleImage(`${AI_STUDIO_SAMPLES_BASE}/clips/${sample.id}-poster`, sample.aspect),
    mp4: `${AI_STUDIO_SAMPLES_BASE}/clips/${sample.id}.mp4`,
  };
}

/** Every public file path an example needs (exporter writes them; the catalog test checks them). */
export function sampleFilePaths(sample: PhotoSample | ClipSample): string[] {
  const files = sampleFiles(sample);
  const images =
    files.kind === 'image' ? [files.before, files.after] : [files.before, files.poster];
  const paths = images.flatMap(imagePaths);
  return files.kind === 'video' ? [...paths, files.mp4] : paths;
}

// ── Showcase listing (post examples when the property has no photos) ─────────

/** Stock photos used as a stand-in listing; shipped under `samples/showcase/`. */
export const SHOWCASE_PHOTOS: Array<SampleSource & { aspect: string }> = [
  {
    provider: 'pexels',
    id: '3209045',
    pageUrl: 'https://www.pexels.com/photo/3209045/',
    photographer: 'Jason Boyd',
    aspect: '3:2',
  },
  {
    provider: 'pexels',
    id: '6782567',
    pageUrl: 'https://www.pexels.com/photo/6782567/',
    photographer: 'Max Vakhtbovych',
    aspect: '3:2',
  },
  {
    provider: 'pexels',
    id: '261102',
    pageUrl: 'https://www.pexels.com/photo/261102/',
    photographer: 'Pixabay',
    aspect: '3:2',
  },
];

export function showcasePhotoUrl(id: string): string {
  return `${AI_STUDIO_SAMPLES_BASE}/showcase/${id}-960.webp`;
}

export function showcasePhotoPaths(): string[] {
  return SHOWCASE_PHOTOS.map((photo) => showcasePhotoUrl(photo.id));
}

/** Facts for the stand-in listing. Plain and generic, never a real place. */
export function showcaseFacts(origin = ''): PosterFacts {
  return {
    propertyName: 'Seaside Suite',
    brandName: null,
    location: null,
    checkIn: '2:00 PM',
    checkOut: '12:00 PM',
    securityDeposit: null,
    nightlyRate: null,
    amenities: ['Pool', 'Wi-Fi', 'Balcony', 'Air conditioning'],
    logoUrl: null,
    photos: SHOWCASE_PHOTOS.map((photo) => `${origin}${showcasePhotoUrl(photo.id)}`),
  };
}

// ── Readiness ────────────────────────────────────────────────────────────────

/**
 * Photo and clip examples only show once their generated files exist. The exporter
 * rewrites `aiStudioSampleAssets.ts`; posts are always ready (drawn live).
 */
export function isSampleReady(sample: AiStudioSample, readyIds: readonly string[]): boolean {
  return sample.output === 'post' || readyIds.includes(sample.id);
}

// ── Recipe → form ────────────────────────────────────────────────────────────

/** Prompt the generate request actually carries (look suffix included). */
export function samplePrompt(sample: PhotoSample | ClipSample): string {
  return sample.output === 'image'
    ? composeGenerationPrompt(sample.prompt, sample.lookId)
    : sample.prompt;
}

/** Longest host text each output accepts (same caps as the create form). */
export function samplePromptLimit(output: AiStudioOutput): number {
  if (output === 'post') return POST_SAMPLE_PROMPT_MAX;
  return (
    (output === 'video' ? MAX_VIDEO_PROMPT_CHARS : MAX_IMAGE_PROMPT_CHARS) - MAX_LOOK_SUFFIX_CHARS
  );
}

export type SampleContext = {
  /** 1080p clips allowed (Business+). Samples are 720p, so this only matters for parity. */
  allowHighResolution: boolean;
};

/** Credits Generate will show once this example is applied. */
export function sampleCredits(sample: AiStudioSample, ctx: SampleContext): number | null {
  if (sample.output === 'post') return null;
  if (sample.output === 'image') {
    return estimateGenerationCredits({
      mediaType: 'image',
      tier: sample.tier,
      imageSize: sample.imageSize,
    });
  }
  return estimateGenerationCredits({
    mediaType: 'video',
    tier: sample.tier,
    resolution: sampleResolution(sample, ctx),
    durationSeconds: DEFAULT_VIDEO_DURATION,
  });
}

export function sampleResolution(sample: ClipSample, ctx: SampleContext): VideoResolution {
  return ctx.allowHighResolution ? sample.resolution : DRAFT_VIDEO_RESOLUTION;
}

export function sampleEtaLabel(sample: AiStudioSample): string {
  if (sample.output === 'post') return 'About 20 seconds';
  if (sample.output === 'image') return 'About 15 seconds';
  return 'About 3 minutes';
}

/** Short setting chips for the detail view, in plain words. */
export function sampleSettingLabels(sample: AiStudioSample): string[] {
  if (sample.output === 'post') return [];
  const look =
    sample.output === 'image'
      ? GENERATION_LOOKS.find((item) => item.id === sample.lookId)?.title
      : undefined;
  return [look, sample.aspect].filter((value): value is string => Boolean(value));
}

/** What `AiStudioCreate` loads when an example is applied. */
export type SampleCreateState =
  | { output: 'post'; text: string; goal: PosterGoal; format: DesignTemplateFormat }
  | {
      output: 'image';
      text: string;
      aspect: string;
      lookId: string | null;
      tier: 'standard';
      imageSize: ImageSize;
      enhance: boolean;
    }
  | {
      output: 'video';
      text: string;
      aspect: string;
      tier: 'standard';
      resolution: VideoResolution;
      cameraMove: VideoCameraMoveId;
      sound: VideoSoundMode;
      enhance: boolean;
    };

export function sampleToCreateState(sample: AiStudioSample, ctx: SampleContext): SampleCreateState {
  if (sample.output === 'post') {
    return { output: 'post', text: sample.prompt, goal: sample.goal, format: sample.format };
  }
  if (sample.output === 'image') {
    return {
      output: 'image',
      text: sample.prompt,
      aspect: sample.aspect,
      lookId: sample.lookId,
      tier: sample.tier,
      imageSize: sample.imageSize,
      enhance: sample.enhancePrompt,
    };
  }
  return {
    output: 'video',
    text: sample.prompt,
    aspect: sample.aspect,
    tier: sample.tier,
    resolution: sampleResolution(sample, ctx),
    cameraMove: sample.cameraMove,
    sound: sample.sound,
    enhance: sample.enhancePrompt,
  };
}

// ── Post batch order ─────────────────────────────────────────────────────────

/**
 * QA order (fewest layout issues first, stable), then the host's picked layout moves to
 * the front if it passes QA cleanly. A picked layout with issues keeps its QA place.
 */
export function orderPosterBatch<T extends { spec: { archetype: string }; issues: number }>(
  scored: T[],
  preferred: string | null
): T[] {
  const ordered = [...scored].sort((a, b) => a.issues - b.issues);
  if (!preferred) return ordered;
  const index = ordered.findIndex((item) => item.spec.archetype === preferred && item.issues === 0);
  if (index <= 0) return ordered;
  return [ordered[index]!, ...ordered.slice(0, index), ...ordered.slice(index + 1)];
}

// ── Live post previews ───────────────────────────────────────────────────────

/** Small, stable string hash (djb2) for cache keys. */
export function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Bump when the post compiler or sample render changes, so stale previews are redrawn. */
export const POST_SAMPLE_RENDER_VERSION = 1;

/**
 * IndexedDB key for a live post example: changes whenever the property, theme, listing
 * photos or the facts the layout prints change.
 */
export function postSampleCacheKey(input: {
  propertyId: string | null;
  sampleId: string;
  themeKey: string | null;
  facts: PosterFacts;
}): string {
  const { facts } = input;
  const fingerprint = hashString(
    JSON.stringify([
      facts.propertyName,
      facts.location,
      facts.checkIn,
      facts.checkOut,
      facts.amenities,
      facts.photos,
      facts.logoUrl,
    ])
  );
  return [
    'ai-sample',
    POST_SAMPLE_RENDER_VERSION,
    input.propertyId ?? 'none',
    input.sampleId,
    input.themeKey ?? 'default',
    fingerprint,
  ].join(':');
}

/** Which listing a post example is drawn with: the host's own, or the stand-in showcase. */
export function postSampleFacts(
  sample: PostSample,
  hostFacts: PosterFacts,
  showcase: PosterFacts
): { facts: PosterFacts; showcase: boolean } | null {
  if (hostFacts.photos.length === 0) return { facts: showcase, showcase: true };
  return postSampleAvailable(sample, hostFacts) ? { facts: hostFacts, showcase: false } : null;
}

// ── Display ──────────────────────────────────────────────────────────────────

export const SAMPLE_OUTPUT_NOUN = { post: 'Post', image: 'Photo', video: 'Clip' } as const;

export function sampleAspect(sample: AiStudioSample): string {
  return sample.output === 'post' ? postFormatAspect(sample.format) : sample.aspect;
}

/** "Post · 4 designs", "Photo · 120 credits", "Clip · 800 credits". */
export function sampleMeta(sample: AiStudioSample, allowHighResolution: boolean): string {
  const credits = sampleCredits(sample, { allowHighResolution });
  return [
    SAMPLE_OUTPUT_NOUN[sample.output],
    credits === null ? '4 designs' : `${credits.toLocaleString()} credits`,
  ].join(' · ');
}
