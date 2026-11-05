import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

import { Audio, Video } from '@remotion/media';
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
  Img,
  Sequence,
  interpolate,
  isHtmlInCanvasSupported,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  adjustFilter,
  cropInnerStyle,
  ctaReveal,
  fadedVolume,
  isRenderableMediaUrl,
  layerMotion,
  overlayAspect,
  overlayBoxStyle,
  revealText,
} from '@/features/dashboard/marketing/lib/video/v2/clipStyles';
import { mainTrackOf } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import type {
  AudioItem,
  LayerItem,
  MediaItem,
  VideoProjectV2,
  VideoTrack,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
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
import type {
  VideoSceneKind,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import {
  resolveVideoTypographyContext,
  type VideoTemplateLook,
  type VideoTypographyContext,
} from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import { scaleForVideoFormat } from '@/features/dashboard/marketing/lib/video/videoTextSlotContent';
import { parseHexRgb } from '@/lib/theme/colorConvert';

export type VideoCompositionV2Props = {
  project: VideoProjectV2;
  brandColor?: string;
  theme?: MarketingThemeTokens | null;
  typography?: VideoTypographyContext;
  motionProfile?: VideoMotionProfile;
  /** Preview-only: mutes every audio source in the Remotion player. */
  previewMuted?: boolean;
  /**
   * Export: a media file that fails to load aborts the render instead of showing the striped
   * placeholder (the export preflight reports unreachable files before this can happen).
   */
  strictMedia?: boolean;
};

type Ctx = {
  project: VideoProjectV2;
  typography: VideoTypographyContext;
  motionProfile: VideoMotionProfile;
  previewMuted: boolean;
  strictMedia: boolean;
};

const DARK_BASE = '#0f172a';

// ─── Scrim (Quiet Coast photo wash), identical to v1 ────────────────────────

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

function scrimStyle(
  kind: VideoSceneKind,
  look: VideoTemplateLook,
  palette: CampaignPalette,
  overlay: VideoOverlayMode
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
  return {
    background: `linear-gradient(to bottom,
      rgba(${slate.r},${slate.g},${slate.b},${topOpacity}) 0%,
      rgba(${mid.r},${mid.g},${mid.b},${midOpacity}) 52%,
      rgba(${bottom.r},${bottom.g},${bottom.b},${look.scrimBottomOpacity}) 100%)`,
  };
}

// ─── Media element ──────────────────────────────────────────────────────────

/** Diagonal-stripe stand-in for media that is missing, failed to load or not chosen yet. */
function MissingMedia() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1e293b',
        backgroundImage:
          'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 14px, rgba(255,255,255,0) 14px 28px)',
      }}
    />
  );
}

function MediaElement({
  item,
  muted,
  volume,
  transform,
  strict = false,
}: {
  item: MediaItem;
  muted: boolean;
  volume: number;
  transform?: string;
  strict?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = item.media.url;
  if (!isRenderableMediaUrl(url) || failed) return <MissingMedia />;

  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: item.fit,
    transform,
    filter: adjustFilter(item.adjust),
  };

  if (item.type === 'video') {
    return (
      <Video
        src={url}
        muted={muted}
        volume={volume}
        loop
        trimBefore={item.trimBeforeFrames || undefined}
        playbackRate={item.playbackRate ?? 1}
        objectFit={item.fit}
        style={{ ...style, objectFit: undefined }}
        onError={() => {
          setFailed(true);
          return strict ? 'fail' : 'fallback';
        }}
      />
    );
  }
  return <Img src={url} onError={() => setFailed(!strict)} style={style} />;
}

/** Blurred, scaled copy behind letterboxed media (images, or the video poster). */
function BlurBackdrop({ item }: { item: MediaItem }) {
  const url = item.type === 'video' ? item.media.posterUrl : item.media.url;
  if (!isRenderableMediaUrl(url)) return null;
  return (
    <Img
      src={url}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'blur(32px) brightness(0.8)',
        transform: 'scale(1.15)',
      }}
    />
  );
}

function croppedMedia(item: MediaItem, props: Parameters<typeof MediaElement>[0]) {
  return (
    <div style={{ ...cropInnerStyle(item.crop) } as CSSProperties}>
      <MediaElement {...props} />
    </div>
  );
}

// ─── Main track ─────────────────────────────────────────────────────────────

function MainClip({
  item,
  index,
  ctx,
  muted,
}: {
  item: MediaItem;
  index: number;
  ctx: Ctx;
  muted: boolean;
}) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const motion = resolveSceneMotionProfile(ctx.motionProfile, item.motion);
  const progress = interpolate(frame, [0, Math.max(1, config.durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = motion.zoomFrom + (motion.zoomTo - motion.zoomFrom) * progress;
  // Template camera motion is for photos; real footage only moves when the host picked a motion.
  const useMotion = item.type === 'image' || item.motion !== undefined;
  const transform = useMotion
    ? backgroundMotionTransform(motion, progress, index, zoom)
    : undefined;
  const reveal = item.sceneKind === 'cta' ? ctaReveal(frame, motion.ctaRevealFrames) : 1;
  const scrim = scrimStyle(
    item.sceneKind ?? 'photo',
    ctx.typography.look,
    ctx.typography.palette,
    item.overlay ?? 'none'
  );
  const volume = muted || item.muted ? 0 : (item.volume ?? 1);
  const letterboxed = item.fit === 'contain' && ctx.project.background.fill === 'blur';

  return (
    <AbsoluteFill style={{ backgroundColor: ctx.project.background.color, opacity: reveal }}>
      {letterboxed ? <BlurBackdrop item={item} /> : null}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {croppedMedia(item, {
          item,
          muted: muted || item.muted === true,
          volume,
          transform,
          strict: ctx.strictMedia,
        })}
      </AbsoluteFill>
      {scrim ? <AbsoluteFill style={scrim} /> : null}
    </AbsoluteFill>
  );
}

type FrameSize = { width: number; height: number };

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

function renderTransition(
  transition: VideoTransition,
  durationInFrames: number,
  key: string,
  frameSize: FrameSize
) {
  if (transition === 'none' || durationInFrames <= 0) return null;
  const timing = linearTiming({ durationInFrames });
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

function MainTrack({ track, ctx }: { track: VideoTrack; ctx: Ctx }) {
  const config = useVideoConfig();
  const frameSize = useMemo<FrameSize>(
    () => ({ width: config.width, height: config.height }),
    [config.width, config.height]
  );
  const items = track.items as MediaItem[];
  if (items.length === 0) return null;

  const children: ReactNode[] = [];
  items.forEach((item, index) => {
    if (index > 0 && item.transitionIn) {
      const overlap = items[index - 1]!.from + items[index - 1]!.durationInFrames - item.from;
      const node = renderTransition(
        item.transitionIn.type,
        overlap,
        `${item.id}-transition`,
        frameSize
      );
      if (node) children.push(node);
    }
    children.push(
      <TransitionSeries.Sequence key={item.id} durationInFrames={item.durationInFrames}>
        <MainClip
          item={item}
          index={index}
          ctx={ctx}
          muted={ctx.previewMuted || track.muted === true}
        />
      </TransitionSeries.Sequence>
    );
  });
  return <TransitionSeries>{children}</TransitionSeries>;
}

// ─── Overlay / text / audio tracks ──────────────────────────────────────────

function OverlayClip({
  item,
  muted,
  strict,
}: {
  item: MediaItem;
  muted: boolean;
  strict: boolean;
}) {
  const volume = muted || item.muted ? 0 : (item.volume ?? 1);
  return (
    <AbsoluteFill>
      <div style={overlayBoxStyle(item.transform, overlayAspect(item)) as CSSProperties}>
        {croppedMedia(item, { item, muted: muted || item.muted === true, volume, strict })}
      </div>
    </AbsoluteFill>
  );
}

function LayerClip({ item, ctx }: { item: LayerItem; ctx: Ctx }) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const scale = scaleForVideoFormat(config.width, config.height);
  const motionProfile = ctx.motionProfile;
  const enter = spring({
    frame,
    fps: config.fps,
    config: { damping: motionProfile.springDamping, stiffness: motionProfile.springStiffness },
  });
  const motion = layerMotion({
    frame,
    durationInFrames: config.durationInFrames,
    fps: config.fps,
    animationIn: item.animationIn,
    animationOut: item.animationOut,
    templateEnter: enter,
    templateOffsetX: motionProfile.entryOffsetX,
    templateOffsetY: motionProfile.entryOffsetY,
    travel: 60 * scale,
  });
  const reveal = item.sceneKind === 'cta' ? ctaReveal(frame, motionProfile.ctaRevealFrames) : 1;

  const layer =
    motion.reveal < 1 && item.layer.text
      ? { ...item.layer, text: revealText(item.layer.text, motion.reveal) }
      : item.layer;
  if (!layerHasContent(layer)) return null;

  return (
    <AbsoluteFill
      style={{
        opacity: motion.opacity * reveal,
        transform: motion.scale !== 1 ? `scale(${motion.scale})` : undefined,
      }}
    >
      <PositionedLayer
        layer={layer}
        scale={scale}
        enterOffset={motion.translateY}
        enterOffsetX={motion.translateX}
      >
        <VideoLayerBody layer={layer} typography={ctx.typography} scale={scale} />
      </PositionedLayer>
    </AbsoluteFill>
  );
}

function AudioClip({ item, muted }: { item: AudioItem; muted: boolean }) {
  const { fps } = useVideoConfig();
  if (!isRenderableMediaUrl(item.media.url)) return null;
  const { durationInFrames, volume, fadeInFrames, fadeOutFrames } = item;
  const hasFade = (fadeInFrames ?? 0) > 0 || (fadeOutFrames ?? 0) > 0;
  return (
    <Audio
      src={item.media.url}
      muted={muted}
      loop={item.loop === true}
      premountFor={fps}
      trimBefore={item.trimBeforeFrames || undefined}
      volume={
        hasFade
          ? (frame: number) =>
              fadedVolume(frame, durationInFrames, volume, fadeInFrames, fadeOutFrames)
          : volume
      }
    />
  );
}

function TrackItems({ track, ctx }: { track: VideoTrack; ctx: Ctx }) {
  const { fps } = useVideoConfig();
  if (track.hidden && track.kind !== 'audio') return null;
  const muted = ctx.previewMuted || track.muted === true;

  switch (track.kind) {
    case 'main':
      return <MainTrack track={track} ctx={ctx} />;
    case 'overlay':
      return (
        <>
          {(track.items as MediaItem[]).map((item) => (
            <Sequence
              key={item.id}
              from={item.from}
              durationInFrames={item.durationInFrames}
              premountFor={fps}
            >
              <OverlayClip item={item} muted={muted} strict={ctx.strictMedia} />
            </Sequence>
          ))}
        </>
      );
    case 'text':
      return (
        <>
          {(track.items as LayerItem[]).map((item) => (
            <Sequence key={item.id} from={item.from} durationInFrames={item.durationInFrames}>
              <LayerClip item={item} ctx={ctx} />
            </Sequence>
          ))}
        </>
      );
    case 'audio':
      return (
        <>
          {(track.items as AudioItem[]).map((item) => (
            <Sequence
              key={item.id}
              from={item.from}
              durationInFrames={item.durationInFrames}
              layout="none"
            >
              <AudioClip item={item} muted={muted || track.hidden === true} />
            </Sequence>
          ))}
        </>
      );
  }
}

export function CampaignVideoCompositionV2({
  project,
  brandColor = '#e8752a',
  theme = null,
  typography,
  motionProfile,
  previewMuted = false,
  strictMedia = false,
}: VideoCompositionV2Props) {
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
  const ctx = useMemo<Ctx>(
    () => ({
      project,
      typography: resolvedTypography,
      motionProfile: resolvedMotion,
      previewMuted,
      strictMedia,
    }),
    [project, resolvedTypography, resolvedMotion, previewMuted, strictMedia]
  );

  if (mainTrackOf(project).items.length === 0 && project.tracks.length <= 1) {
    return <AbsoluteFill style={{ backgroundColor: DARK_BASE }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: project.background.color }}>
      {project.tracks.map((track) => (
        <TrackItems key={track.id} track={track} ctx={ctx} />
      ))}
    </AbsoluteFill>
  );
}
