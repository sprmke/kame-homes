import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { dissolve } from '@remotion/transitions/dissolve';
import { fade } from '@remotion/transitions/fade';
import { flip } from '@remotion/transitions/flip';
import { pushCut } from '@remotion/transitions/push-cut';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { zoomInOut } from '@remotion/transitions/zoom-in-out';
import {
  AbsoluteFill,
  Audio,
  Img,
  Video,
  interpolate,
  isHtmlInCanvasSupported,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import { PositionedLayer } from '@/features/dashboard/marketing/lib/video/videoCompositionLayout';
import {
  layerHasContent,
  VideoLayerBody,
} from '@/features/dashboard/marketing/lib/video/videoLayerContent';
import {
  backgroundMotionTransform,
  resolveSceneMotionProfile,
  resolveVideoMotionProfile,
  type VideoMotionProfile,
} from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import { VIDEO_MUSIC_DEFAULT_VOLUME } from '@/features/dashboard/marketing/lib/video/videoMusicPresets';
import type {
  VideoProject,
  VideoScene,
  VideoSceneKind,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  sceneDurationInFrames,
  transitionDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import {
  getSceneLayers,
  sceneBackgroundLayer,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  resolveVideoTypographyContext,
  type VideoTemplateLook,
  type VideoTypographyContext,
} from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import { scaleForVideoFormat } from '@/features/dashboard/marketing/lib/video/videoTextSlotContent';

import { parseHexRgb } from '@/lib/theme/colorConvert';
export type VideoCompositionProps = {
  project: VideoProject;
  brandColor?: string;
  /** Active marketing theme (palette + fonts) when `typography` is not passed. */
  theme?: MarketingThemeTokens | null;
  /** Resolved from `project.templateId` when omitted, so every render path matches. */
  typography?: VideoTypographyContext;
  motionProfile?: VideoMotionProfile;
  /** Preview-only: mutes background music in the Remotion player. */
  previewMuted?: boolean;
};

function overlayOpacityForKind(kind: VideoSceneKind): number {
  switch (kind) {
    case 'photo':
      return 0.35;
    case 'promo':
      return 0.48;
    case 'slots':
      return 0.52;
    case 'cta':
      return 0.55;
    default:
      return 0.4;
  }
}

function mixRgb(
  left: { r: number; g: number; b: number },
  right: { r: number; g: number; b: number },
  rightWeight: number
) {
  const weight = Math.max(0, Math.min(1, rightWeight));
  const keep = 1 - weight;
  return {
    r: Math.round(left.r * keep + right.r * weight),
    g: Math.round(left.g * keep + right.g * weight),
    b: Math.round(left.b * keep + right.b * weight),
  };
}

/**
 * Quiet Coast photo wash. Overlay mode comes from the storyboard recipe
 * (host-overridable per scene). `none` keeps the photo clean.
 */
function sceneScrimStyle(
  kind: VideoSceneKind,
  look: VideoTemplateLook,
  palette: CampaignPalette,
  overlay: VideoOverlayMode = 'soft-scrim'
): CSSProperties | null {
  if (overlay === 'none') return null;

  const slate = { r: 15, g: 23, b: 42 };
  const accent = parseHexRgb(palette.accent) ?? slate;
  const ink = parseHexRgb(palette.ink) ?? slate;
  const mid = mixRgb(slate, accent, look.scrimAccentMix);
  const bottom = mixRgb(mixRgb(slate, ink, 0.45), accent, look.scrimAccentMix * 0.85);
  const strength = overlay === 'soft-scrim' ? 0.85 : 1;
  const kindBase = overlayOpacityForKind(kind) * strength;

  if (overlay === 'top-band') {
    return {
      background: `linear-gradient(to bottom,
        rgba(${mid.r},${mid.g},${mid.b},${look.scrimBottomOpacity * 0.85}) 0%,
        rgba(${slate.r},${slate.g},${slate.b},${kindBase * 0.2}) 42%,
        rgba(${slate.r},${slate.g},${slate.b},0) 70%)`,
    };
  }

  if (overlay === 'bottom-band') {
    return {
      background: `linear-gradient(to bottom,
        rgba(${slate.r},${slate.g},${slate.b},0) 0%,
        rgba(${slate.r},${slate.g},${slate.b},0) 38%,
        rgba(${mid.r},${mid.g},${mid.b},${look.scrimBottomOpacity * 0.55}) 68%,
        rgba(${bottom.r},${bottom.g},${bottom.b},${look.scrimBottomOpacity}) 100%)`,
    };
  }

  const topOpacity = kindBase * 0.12;
  const midOpacity = Math.min(0.72, look.scrimBottomOpacity * 0.72);
  const bottomOpacity = look.scrimBottomOpacity;

  return {
    background: `linear-gradient(to bottom,
      rgba(${slate.r},${slate.g},${slate.b},${topOpacity}) 0%,
      rgba(${mid.r},${mid.g},${mid.b},${midOpacity}) 52%,
      rgba(${bottom.r},${bottom.g},${bottom.b},${bottomOpacity}) 100%)`,
  };
}

function isRenderableMediaUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  return /^https?:\/\//i.test(url.trim()) || url.trim().startsWith('data:');
}

function SceneBackground({
  url,
  mediaType = 'image',
  transform,
}: {
  url: string | null;
  mediaType?: 'image' | 'video';
  transform: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!isRenderableMediaUrl(url) || imageFailed) {
    return <AbsoluteFill style={{ backgroundColor: '#1e293b' }} />;
  }

  if (mediaType === 'video') {
    return (
      <Video
        src={url}
        muted
        loop
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform }}
      />
    );
  }

  return (
    <Img
      src={url}
      onError={() => setImageFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', transform }}
    />
  );
}

function SceneLayers({
  scene,
  sceneIndex,
  typography,
  motionProfile,
}: {
  scene: VideoScene;
  sceneIndex: number;
  typography: VideoTypographyContext;
  motionProfile: VideoMotionProfile;
}) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const scale = scaleForVideoFormat(config.width, config.height);
  const motion = resolveSceneMotionProfile(motionProfile, scene.motion);

  const progress = interpolate(frame, [0, Math.max(1, config.durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = motion.zoomFrom + (motion.zoomTo - motion.zoomFrom) * progress;
  const backgroundTransform = backgroundMotionTransform(motion, progress, sceneIndex, zoom);

  const enter = spring({
    frame,
    fps: config.fps,
    config: { damping: motion.springDamping, stiffness: motion.springStiffness },
  });
  const enterOffsetY = (1 - enter) * motion.entryOffsetY;
  const enterOffsetX = (1 - enter) * motion.entryOffsetX;
  const fadeIn =
    scene.kind === 'cta'
      ? interpolate(frame, [0, Math.max(1, motion.ctaRevealFrames)], [0, 1], {
          extrapolateRight: 'clamp',
        })
      : 1;

  const layers = getSceneLayers(scene);
  const background = sceneBackgroundLayer(scene);
  const overlays = layers.filter((layer) => layer.kind !== 'background');

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', opacity: fadeIn }}>
      <SceneBackground
        url={background?.imageUrl ?? null}
        mediaType={background?.mediaType ?? 'image'}
        transform={backgroundTransform}
      />
      {(() => {
        const scrim = sceneScrimStyle(
          scene.kind,
          typography.look,
          typography.palette,
          scene.overlay ?? 'soft-scrim'
        );
        return scrim ? <AbsoluteFill style={scrim} /> : null;
      })()}
      {overlays.map((layer) => {
        if (!layerHasContent(layer)) return null;
        return (
          <PositionedLayer
            key={layer.id}
            layer={layer}
            scale={scale}
            enterOffset={enterOffsetY}
            enterOffsetX={enterOffsetX}
          >
            <VideoLayerBody layer={layer} typography={typography} scale={scale} />
          </PositionedLayer>
        );
      })}
    </AbsoluteFill>
  );
}

/**
 * `dissolve` and `zoomInOut` are WebGL shaders that need Chrome's HTML-in-canvas
 * API. Everywhere else, fall back to the closest CSS-only move so a template's
 * transition pair never crashes the player or the export.
 */
let htmlInCanvasSupport: boolean | null = null;
function supportsShaderTransitions(): boolean {
  if (htmlInCanvasSupport === null) {
    try {
      htmlInCanvasSupport = isHtmlInCanvasSupported();
    } catch {
      htmlInCanvasSupport = false;
    }
  }
  return htmlInCanvasSupport;
}

type FrameSize = { width: number; height: number };

function renderSceneTransition(transition: VideoTransition, key: string, frameSize: FrameSize) {
  const durationInFrames = transitionDurationInFrames(transition);
  if (durationInFrames <= 0) return null;

  const timing = linearTiming({ durationInFrames });
  // Each presentation carries its own props type, so the element is built per case.
  const element = <T extends Record<string, unknown>>(presentation: TransitionPresentation<T>) => (
    <TransitionSeries.Transition key={key} presentation={presentation} timing={timing} />
  );

  switch (transition) {
    case 'slide-left':
      return element(slide({ direction: 'from-left' }));
    case 'slide-up':
      return element(slide({ direction: 'from-bottom' }));
    case 'wipe':
      return element(wipe());
    case 'flip':
      return element(flip({ direction: 'from-left' }));
    case 'clock-wipe':
      return element(clockWipe(frameSize));
    case 'push-cut':
      return element(pushCut());
    case 'dissolve':
      return supportsShaderTransitions()
        ? element(dissolve({}))
        : element(fade({ shouldFadeOutExitingScene: true }));
    case 'zoom-in-out':
      return supportsShaderTransitions()
        ? element(zoomInOut({}))
        : element(
            pushCut({
              cutProgress: 0.5,
              outgoingScale: 1.18,
              incomingStartScale: 1.18,
              incomingEndScale: 1,
              flashOpacity: 0,
            })
          );
    case 'fade':
    default:
      return element(fade());
  }
}

export function CampaignVideoComposition({
  project,
  brandColor = '#e8752a',
  theme = null,
  typography,
  motionProfile,
  previewMuted = false,
}: VideoCompositionProps) {
  const { fps, scenes, music } = project;
  const config = useVideoConfig();
  const musicUrl = music?.url?.trim() || null;
  const musicVolume = previewMuted ? 0 : (music?.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME);

  const resolvedTypography = useMemo(
    () =>
      typography ??
      resolveVideoTypographyContext(project.templateId, brandColor, project.palette, theme),
    [typography, project.templateId, project.palette, brandColor, theme]
  );
  const resolvedMotion = useMemo(
    () => motionProfile ?? resolveVideoMotionProfile(project.templateId),
    [motionProfile, project.templateId]
  );
  const frameSize = useMemo<FrameSize>(
    () => ({ width: config.width, height: config.height }),
    [config.width, config.height]
  );

  if (scenes.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#0f172a' }} />;
  }

  const elements: ReactNode[] = [];

  scenes.forEach((scene, index) => {
    elements.push(
      <TransitionSeries.Sequence
        key={scene.id}
        durationInFrames={sceneDurationInFrames(scene, fps)}
      >
        <SceneLayers
          scene={scene}
          sceneIndex={index}
          typography={resolvedTypography}
          motionProfile={resolvedMotion}
        />
      </TransitionSeries.Sequence>
    );

    if (index < scenes.length - 1) {
      const nextScene = scenes[index + 1]!;
      const transition = renderSceneTransition(
        nextScene.transition,
        `${scene.id}-transition`,
        frameSize
      );
      if (transition) elements.push(transition);
    }
  });

  return (
    <AbsoluteFill>
      {musicUrl ? <Audio src={musicUrl} volume={musicVolume} /> : null}
      <TransitionSeries>{elements}</TransitionSeries>
    </AbsoluteFill>
  );
}
