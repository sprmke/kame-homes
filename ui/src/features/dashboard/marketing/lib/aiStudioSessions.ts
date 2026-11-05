import {
  VIDEO_PHOTO_DEFAULT_PROMPT,
  splitGenerationPrompt,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import { isGenerationInFlight } from '@/features/dashboard/marketing/lib/marketingGenerationProgress';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';

/**
 * AI Studio conversations, client side. A conversation (session) is the host's first
 * request and every refinement. Photo / clip versions are generation jobs; post
 * versions are art-direction specs the poster compiler turns into designs.
 */

export type AiSessionCover = {
  media: 'post' | 'image' | 'video';
  url: string | null;
  /** Clips: the start photo, a still for the card. */
  posterUrl: string | null;
  aspect: string | null;
};

export type AiSessionSummary = {
  id: string;
  output: AiStudioOutput;
  title: string;
  themeKey: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  versionCount: number;
  inFlight: boolean;
  cover: AiSessionCover | null;
};

export type AiSessionRecord = Pick<
  AiSessionSummary,
  'id' | 'output' | 'title' | 'themeKey' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type AiPostVersionRecord = {
  id: string;
  sessionId: string;
  turnId: string;
  prompt: string | null;
  goal: string;
  format: string;
  spec: Record<string, unknown>;
  photoUrls: string[];
  previewUrl: string | null;
  parentVersionId: string | null;
  createdAt: string;
};

export type AiSessionDetail = {
  session: AiSessionRecord;
  jobs: MarketingGenerationJob[];
  postVersions: AiPostVersionRecord[];
};

export type AiVersion =
  | { kind: 'post'; key: string; number: number; post: AiPostVersionRecord }
  | { kind: 'image' | 'video'; key: string; number: number; job: MarketingGenerationJob };

export type AiTurn = {
  key: string;
  /** What the host asked for, in their words. */
  prompt: string | null;
  /** When there was no message: what changed ("New layout", "Resized to Story"). */
  note: string | null;
  createdAt: string;
  versions: AiVersion[];
};

export const AI_OUTPUT_LABEL: Record<AiStudioOutput, { one: string; many: string }> = {
  post: { one: 'Post', many: 'Posts' },
  image: { one: 'Photo', many: 'Photos' },
  video: { one: 'Clip', many: 'Clips' },
};

const POST_FORMAT_LABEL: Record<string, string> = {
  'instagram-post': 'Square',
  'instagram-portrait': 'Portrait',
  'instagram-story': 'Story',
  'facebook-post': 'Facebook',
};

const POST_GOAL_LABEL: Record<string, string> = {
  vibe: 'Vibe',
  promo: 'Promo',
  'amenity-spotlight': 'Amenities',
  'feature-spotlight': 'Feature',
  'stay-info': 'Stay info',
};

export function postFormatLabel(format: string): string {
  return POST_FORMAT_LABEL[format] ?? 'Post';
}

export function postGoalLabel(goal: string): string {
  return POST_GOAL_LABEL[goal] ?? 'Post';
}

export function versionKey(kind: AiVersion['kind'], id: string): string {
  return `${kind}:${id}`;
}

function jobTurnPrompt(job: MarketingGenerationJob): string | null {
  const description = splitGenerationPrompt(job.prompt).description.trim();
  if (!description) return null;
  // A clip started from a photo with no words carries the server default.
  if (job.mediaType === 'video' && description === VIDEO_PHOTO_DEFAULT_PROMPT) return null;
  return description;
}

function postTurnNote(
  first: AiPostVersionRecord,
  byId: Map<string, AiPostVersionRecord>
): string | null {
  if (first.prompt) return null;
  const parent = first.parentVersionId ? byId.get(first.parentVersionId) : null;
  if (!parent) return `${postGoalLabel(first.goal)} post`;
  if (parent.format !== first.format) return `Resized to ${postFormatLabel(first.format)}`;
  return 'New layout';
}

/**
 * The thread: one turn per message, oldest first. Every job is its own turn; post
 * versions made by one message share a `turnId` (the first message makes four).
 * Versions are numbered across the whole conversation (V1, V2, …).
 */
export function buildAiTurns(detail: Pick<AiSessionDetail, 'jobs' | 'postVersions'>): AiTurn[] {
  const byId = new Map(detail.postVersions.map((row) => [row.id, row]));
  const turns: AiTurn[] = [];

  for (const job of detail.jobs) {
    turns.push({
      key: `job:${job.id}`,
      prompt: jobTurnPrompt(job),
      note: null,
      createdAt: job.createdAt,
      versions: [{ kind: job.mediaType, key: versionKey(job.mediaType, job.id), number: 0, job }],
    });
  }

  const postTurns = new Map<string, AiPostVersionRecord[]>();
  for (const row of detail.postVersions) {
    const list = postTurns.get(row.turnId);
    if (list) list.push(row);
    else postTurns.set(row.turnId, [row]);
  }
  for (const [turnId, rows] of postTurns) {
    const ordered = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const first = ordered[0]!;
    turns.push({
      key: `turn:${turnId}`,
      prompt: first.prompt,
      note: postTurnNote(first, byId),
      createdAt: first.createdAt,
      versions: ordered.map((post) => ({
        kind: 'post' as const,
        key: versionKey('post', post.id),
        number: 0,
        post,
      })),
    });
  }

  turns.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let number = 0;
  for (const turn of turns) {
    for (const version of turn.versions) {
      number += 1;
      version.number = number;
    }
  }
  return turns;
}

export function flattenVersions(turns: readonly AiTurn[]): AiVersion[] {
  return turns.flatMap((turn) => turn.versions);
}

/** Newest version: what the stage shows when nothing is picked. */
export function latestVersion(turns: readonly AiTurn[]): AiVersion | null {
  const all = flattenVersions(turns);
  return all[all.length - 1] ?? null;
}

export function isVersionInFlight(version: AiVersion | null | undefined): boolean {
  return Boolean(version && version.kind !== 'post' && isGenerationInFlight(version.job));
}

export function isVersionUsable(version: AiVersion | null | undefined): boolean {
  if (!version) return false;
  if (version.kind === 'post') return true;
  return Boolean(version.job.outputUrl) && !isGenerationInFlight(version.job);
}

/** Picture for a thumbnail: post preview, photo output, or a clip's start photo. */
export function versionThumbUrl(version: AiVersion): string | null {
  if (version.kind === 'post') return version.post.previewUrl;
  if (version.kind === 'image') return version.job.outputUrl;
  return version.job.referenceUrls[0] ?? null;
}

/** One-tap refinements under the message box, in host language. */
export const REFINE_SUGGESTIONS: Record<AiStudioOutput, string[]> = {
  post: ['Shorter headline', 'Use a different photo', 'More playful'],
  image: ['Make it evening', 'Brighter and airier', 'Closer view'],
  video: ['Slower camera', 'Pull back instead', 'Warmer light'],
};

/** Example requests on an empty new-creation box. */
export const START_EXAMPLES: Record<AiStudioOutput, string[]> = {
  post: ['Weekday stays, book direct', 'Pool and fast WiFi', 'Check-in details for this weekend'],
  image: ['Living room with a view', 'Bedroom ready for guests', 'Balcony at golden hour'],
  video: ['Curtains moving in a breeze', 'Slow walk through the living room', 'Pool at sunset'],
};

/** Aspect ratio of a version's media (CSS `aspect-ratio`). */
export function versionAspect(version: AiVersion): string {
  if (version.kind === 'post') {
    switch (version.post.format) {
      case 'instagram-story':
        return '9 / 16';
      case 'facebook-post':
        return '40 / 21';
      case 'instagram-portrait':
        return '4 / 5';
      default:
        return '1 / 1';
    }
  }
  const [w, h] = version.job.aspectRatio.split(':').map(Number);
  return w && h ? `${w} / ${h}` : '1 / 1';
}
