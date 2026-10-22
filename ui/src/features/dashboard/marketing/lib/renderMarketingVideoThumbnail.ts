import { renderStillOnWeb } from '@remotion/web-renderer';

import { CampaignVideoComposition } from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { blobToDataUrl } from '@/features/dashboard/marketing/lib/exportVideoMedia';
import { resolveMarketingThumbBinding } from '@/features/dashboard/marketing/lib/marketingDefaultBinding';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { VIDEO_FORMAT_DIMENSIONS } from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import { buildDefaultVideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import type {
  VideoFormat,
  VideoProject,
  VideoScene,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  sceneDurationInFrames,
  sceneStartFrame,
  videoProjectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import { getSceneLayers } from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import {
  getVideoCampaignTemplate,
  type VideoCampaignTemplateDef,
} from '@/features/dashboard/marketing/lib/videoCampaignTemplates';
import { runVideoThumbnailCapture } from '@/features/dashboard/marketing/lib/videoThumbnailCapture';

const THUMB_SCALE = 0.16;

function categoryForTemplate(template: VideoCampaignTemplateDef | undefined) {
  return template?.category ?? 'soft-stay';
}

async function preloadProjectImages(project: VideoProject): Promise<void> {
  const urls = new Set<string>();
  for (const scene of project.scenes) {
    if (scene.imageUrl) urls.add(scene.imageUrl);
    for (const layer of getSceneLayers(scene)) {
      if (layer.imageUrl) urls.add(layer.imageUrl);
    }
  }
  await Promise.all(
    [...urls].map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
}

/**
 * Frame inside a scene for still capture — late enough that enter motion has settled
 * so headlines/CTAs are readable in the thumbnail.
 */
export function thumbnailFrameForScene(project: VideoProject, sceneIndex: number): number {
  const durationInFrames = videoProjectDurationInFrames(project);
  const scene = project.scenes[sceneIndex];
  if (!scene) return 0;

  const start = sceneStartFrame(project, sceneIndex);
  const sceneFrames = sceneDurationInFrames(scene, project.fps);
  // ~45% into the clip (and at least ~0.4s) so enter springs have settled.
  const minOffset = Math.max(1, Math.ceil(project.fps * 0.4));
  const frameInScene = Math.min(
    Math.max(Math.floor(sceneFrames * 0.45), minOffset),
    Math.max(sceneFrames - 1, 0)
  );
  return Math.min(start + frameInScene, Math.max(durationInFrames - 1, 0));
}

function thumbnailFrameForProject(project: VideoProject): number {
  return thumbnailFrameForScene(project, 0);
}

/** Fingerprint for cache invalidation when scene media/text changes. */
export function videoSceneThumbFingerprint(scene: VideoScene): string {
  const layers = getSceneLayers(scene)
    .map(
      (layer) =>
        `${layer.id}:${layer.kind}:${layer.text ?? ''}:${layer.imageUrl ?? ''}:${layer.position.x}:${layer.position.y}:${layer.position.align ?? ''}:${layer.widthPct ?? ''}`
    )
    .join('|');
  return [
    scene.imageUrl ?? '',
    scene.backgroundMediaType ?? '',
    scene.overlay ?? '',
    scene.durationSec,
    scene.kind,
    layers,
  ].join('::');
}

export async function renderVideoPresetThumbnail(
  templateId: string,
  format: VideoFormat,
  binding: DesignBinding,
  brandColor?: string,
  theme?: MarketingThemeTokens | null
): Promise<string | null> {
  const template = getVideoCampaignTemplate(templateId);
  const project = buildDefaultVideoProject(
    templateId,
    categoryForTemplate(template),
    resolveMarketingThumbBinding(binding),
    format
  );
  return renderVideoProjectThumbnail(project, brandColor, theme);
}

export async function renderVideoSceneThumbnail(
  project: VideoProject,
  sceneIndex: number,
  brandColor?: string,
  theme?: MarketingThemeTokens | null
): Promise<string | null> {
  if (typeof document !== 'undefined' && document.hidden) {
    return null;
  }
  if (!project.scenes[sceneIndex]) return null;

  return runVideoThumbnailCapture(async () => {
    const dims = VIDEO_FORMAT_DIMENSIONS[project.format];
    const durationInFrames = videoProjectDurationInFrames(project);
    const frame = thumbnailFrameForScene(project, sceneIndex);

    try {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
      ]);
      await preloadProjectImages(project);

      const stillProps = {
        project: {
          ...project,
          music: project.music ? { ...project.music, url: null } : project.music,
        },
        brandColor,
        theme: theme ?? null,
        previewMuted: true,
      };

      const result = await renderStillOnWeb({
        composition: {
          id: `${project.templateId}-scene-${sceneIndex}`,
          component: CampaignVideoComposition,
          width: dims.width,
          height: dims.height,
          fps: project.fps,
          durationInFrames,
          defaultProps: stillProps,
        },
        inputProps: stillProps,
        frame,
        scale: THUMB_SCALE,
      });

      const blob = await result.blob({ format: 'jpeg', quality: 0.78 });
      if (!blob || blob.size < 64) return null;
      return blobToDataUrl(blob);
    } catch {
      return null;
    }
  });
}

export async function renderVideoProjectThumbnail(
  project: VideoProject,
  brandColor?: string,
  theme?: MarketingThemeTokens | null
): Promise<string | null> {
  if (typeof document !== 'undefined' && document.hidden) {
    return null;
  }

  return runVideoThumbnailCapture(async () => {
    const dims = VIDEO_FORMAT_DIMENSIONS[project.format];
    const durationInFrames = videoProjectDurationInFrames(project);
    const frame = thumbnailFrameForProject(project);

    try {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
      ]);
      await preloadProjectImages(project);

      // Stills don't need audio — skip Jamendo CDN URLs (CORS) entirely.
      const stillProps = {
        project: {
          ...project,
          music: project.music ? { ...project.music, url: null } : project.music,
        },
        brandColor,
        theme: theme ?? null,
        previewMuted: true,
      };

      const result = await renderStillOnWeb({
        composition: {
          id: project.templateId,
          component: CampaignVideoComposition,
          width: dims.width,
          height: dims.height,
          fps: project.fps,
          durationInFrames,
          defaultProps: stillProps,
        },
        inputProps: stillProps,
        frame,
        scale: THUMB_SCALE,
      });

      const blob = await result.blob({ format: 'jpeg', quality: 0.78 });
      if (!blob || blob.size < 64) return null;
      return blobToDataUrl(blob);
    } catch {
      return null;
    }
  });
}
