import type { AttachedContextType } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import type { SocialPlatform } from '@/features/dashboard/inbox/types/inbox';

export type ContextPickerVisual =
  | {
      kind: 'initials';
      name: string;
      imageUrl?: string | null;
      tone?: 'default' | 'primary' | 'muted';
    }
  | {
      kind: 'module-icon';
      icon:
        AttachedContextType | 'income' | 'expense' | 'calendar' | 'design' | 'video' | 'stay_guide';
      tone?: 'default' | 'primary' | 'warning' | 'success' | 'muted';
    }
  | { kind: 'platform'; platform: SocialPlatform; avatarUrl?: string | null }
  | { kind: 'thumbnail'; src?: string | null; contentType?: 'calendar' | 'design' | 'video' }
  | { kind: 'property'; name: string };

export function contextPickerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function isLikelyStillImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(trimmed)) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(trimmed)) return true;
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Cheap poster for marketing templates — no Remotion / canvas capture.
 * Prefer saved `thumbnailDataUrl`; for videos fall back to the first scene's still.
 */
export function marketingTemplateThumbnail(
  designJson: Record<string, unknown> | undefined,
  contentType?: 'calendar' | 'design' | 'video'
): string | undefined {
  const saved = designJson?.thumbnailDataUrl;
  if (typeof saved === 'string' && saved.startsWith('data:')) return saved;

  if (contentType !== 'video') return undefined;

  const scenes = designJson?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) return undefined;
  const first = scenes[0];
  if (!first || typeof first !== 'object') return undefined;
  const scene = first as Record<string, unknown>;

  if (typeof scene.imageUrl === 'string' && isLikelyStillImageUrl(scene.imageUrl)) {
    return scene.imageUrl;
  }

  const layers = scene.layers;
  if (!Array.isArray(layers)) return undefined;
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const row = layer as { kind?: string; imageUrl?: string; mediaType?: string };
    if (row.mediaType === 'video') continue;
    if (
      (row.kind === 'background' || row.kind === 'image') &&
      typeof row.imageUrl === 'string' &&
      isLikelyStillImageUrl(row.imageUrl)
    ) {
      return row.imageUrl;
    }
  }
  return undefined;
}
