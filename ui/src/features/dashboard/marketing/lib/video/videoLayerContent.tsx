import type { CSSProperties, ReactNode } from 'react';

import {
  resolveLayerTypography,
  typographyToCss,
} from '@/features/dashboard/marketing/lib/video/videoLayerTypography';
import type { VideoSceneLayer } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

export function layerHasContent(layer: VideoSceneLayer): boolean {
  switch (layer.kind) {
    case 'background':
      return true;
    case 'image':
    case 'logo':
      return Boolean(layer.imageUrl?.trim());
    case 'slots':
      return Boolean(layer.lines?.some((line) => line.trim()));
    case 'text':
    case 'cta':
      return Boolean(layer.text?.trim());
    default:
      return false;
  }
}

function slotChipStyle(
  look: VideoTypographyContext['look'],
  palette: VideoTypographyContext['palette'],
  fontFamily: string,
  scale: number
): CSSProperties {
  const base: CSSProperties = {
    textAlign: 'center',
    fontFamily,
    fontWeight: 800,
  };

  switch (look.pillStyle) {
    case 'bare':
      return {
        ...base,
        backgroundColor: 'transparent',
        color: palette.cream,
        fontSize: Math.round(56 * scale),
        letterSpacing: `${0.5 * scale}px`,
        textShadow: '0 2px 18px rgba(0,0,0,0.5)',
        padding: `${Math.round(8 * scale)}px ${Math.round(12 * scale)}px`,
      };
    case 'outline':
      return {
        ...base,
        backgroundColor: 'transparent',
        color: palette.cream,
        border: `${Math.max(2, Math.round(2 * scale))}px solid ${palette.cream}`,
        borderRadius: Math.round(16 * scale),
        padding: `${Math.round(14 * scale)}px ${Math.round(22 * scale)}px`,
        minWidth: Math.round(120 * scale),
        fontSize: Math.round(24 * scale),
      };
    case 'compact':
      return {
        ...base,
        backgroundColor: palette.cream,
        color: palette.ink,
        borderRadius: Math.round(12 * scale),
        padding: `${Math.round(12 * scale)}px ${Math.round(18 * scale)}px`,
        minWidth: Math.round(110 * scale),
        fontSize: Math.round(22 * scale),
      };
    case 'filled':
    default:
      return {
        ...base,
        backgroundColor: palette.cream,
        color: palette.ink,
        borderRadius: Math.round(20 * scale),
        padding: `${Math.round(20 * scale)}px ${Math.round(28 * scale)}px`,
        minWidth: Math.round(140 * scale),
        fontSize: Math.round(28 * scale),
      };
  }
}

export function VideoLayerBody({
  layer,
  typography: typographyContext,
  scale,
}: {
  layer: VideoSceneLayer;
  typography: VideoTypographyContext;
  scale: number;
}): ReactNode {
  if (layer.kind === 'logo' && layer.imageUrl) {
    return (
      <img
        src={layer.imageUrl}
        alt=""
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          height: 'auto',
          display: 'block',
          objectFit: 'cover',
          borderRadius: '9999px',
        }}
      />
    );
  }

  if (layer.kind === 'image' && layer.imageUrl) {
    return (
      <img
        src={layer.imageUrl}
        alt=""
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: Math.round(12 * scale),
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        }}
      />
    );
  }

  if (layer.kind === 'slots' && layer.lines?.length) {
    const chip = slotChipStyle(
      typographyContext.look,
      typographyContext.palette,
      typographyContext.fontPairing.label,
      scale
    );
    const gap =
      typographyContext.look.pillStyle === 'bare'
        ? Math.round(8 * scale)
        : typographyContext.look.pillStyle === 'compact'
          ? Math.round(10 * scale)
          : Math.round(16 * scale);

    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap,
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '92%',
        }}
      >
        {layer.lines.map((label) => (
          <div key={label} style={chip}>
            {label}
          </div>
        ))}
      </div>
    );
  }

  if ((layer.kind === 'text' || layer.kind === 'cta') && layer.text) {
    const typography = resolveLayerTypography(layer, typographyContext);
    const css = typographyToCss(typography, scale, {
      isCta: layer.kind === 'cta',
      ctaChrome: typographyContext.look.ctaChrome,
    });
    // Always allow wrapping (and respect literal newlines) — short hand-authored
    // captions never reach their max-width so this is a no-op for them, but it
    // stops long AI-generated copy from overflowing past the frame edge.
    return (
      <div
        style={{
          ...css,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        {layer.text}
      </div>
    );
  }

  return null;
}
