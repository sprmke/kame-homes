import type { PolotnoChild } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import {
  readableOn,
  type PosterPalette,
} from '@/features/dashboard/marketing/lib/poster/posterColor';
import type {
  PosterFontPairing,
  PosterTypeRole,
} from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  burstOrnament,
  glassPanel,
  gradientScrim,
  iconElement,
  iconRow,
  infoBar,
  logoElement,
  organicClipSvgUrl,
  photoElement,
  pill,
  posterText,
  rect,
  stickerBadge,
  type InfoItem,
  type PlacedText,
  type PosterCanvas,
} from '@/features/dashboard/marketing/lib/poster/posterModules';
import type {
  PosterArchetypeId,
  PosterFacts,
  PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import { fitText } from '@/features/dashboard/marketing/lib/poster/posterText';

import { mixHexToward, parseHexRgb, type Rgb } from '@/lib/theme/colorConvert';

/**
 * Hand-designed poster archetypes, one per benchmark post (see
 * docs/workflow/in-progress/marketing-ai-poster-studio.md, Part A). The AI never
 * places elements: it picks one of these and fills its slots. Each archetype stacks
 * modules with cursors and drops optional modules (in a fixed priority order) when a
 * format runs out of room, rather than shrinking everything into mush.
 */

export type PosterPhoto = { url: string; size: { width: number; height: number } | null };

export type PosterBuildContext = {
  canvas: PosterCanvas;
  spec: PosterSpec;
  facts: PosterFacts;
  fonts: PosterFontPairing;
  palette: PosterPalette;
  photos: PosterPhoto[];
};

export type PosterBuildResult = { background: string; children: PolotnoChild[] };

type Band<T> = { square: T; story: T; wide: T };

function pick<T>(canvas: PosterCanvas, values: Band<T>): T {
  if (canvas.isStory) return values.story;
  if (canvas.isWide) return values.wide;
  return values.square;
}

function push(children: PolotnoChild[], placed: PlacedText | null): PlacedText | null {
  if (placed) children.push(placed.child);
  return placed;
}

function after(placed: PlacedText | null, fallback: number, gap = 0): number {
  return placed ? placed.y + placed.height + gap : fallback;
}

function infoItems(facts: PosterFacts): InfoItem[] {
  const items: InfoItem[] = [];
  if (facts.checkIn) items.push({ icon: 'clock', title: 'Check-in', value: facts.checkIn });
  if (facts.checkOut) items.push({ icon: 'clock', title: 'Check-out', value: facts.checkOut });
  if (facts.securityDeposit) {
    items.push({ icon: 'shield-check', title: 'Security deposit', value: facts.securityDeposit });
  }
  return items;
}

function fullBleedPhoto(ctx: PosterBuildContext, focusY: number): PolotnoChild | null {
  const hero = ctx.photos[0];
  if (!hero) return null;
  return photoElement({
    url: hero.url,
    x: 0,
    y: 0,
    width: ctx.canvas.width,
    height: ctx.canvas.height,
    naturalSize: hero.size,
    name: 'Hero photo',
    treatment: { focusY, grade: true },
  });
}

type PillOptions = Parameters<typeof pill>[0];
type PillResult = ReturnType<typeof pill>;

/** Chip pill that drops trailing chips until the rest fit at the legibility floor. */
function chipsPill(
  chips: string[],
  separator: string,
  options: Omit<PillOptions, 'label'>
): PillResult {
  for (let count = chips.length; count > 0; count -= 1) {
    const result = pill({ ...options, label: chips.slice(0, count).join(separator) });
    if (!result.overflow) return result;
  }
  return { children: [], width: 0, height: 0, overflow: true };
}

/** Full location first, then just its first segment ("Azure North"), else nothing. */
function locationPill(location: string, options: Omit<PillOptions, 'label'>): PillResult {
  const candidates = [location, location.split(',')[0]!.trim()];
  for (const label of candidates) {
    const result = pill({ ...options, label });
    if (!result.overflow) return result;
  }
  return { children: [], width: 0, height: 0, overflow: true };
}

type ScrimTone = { color: Rgb; alpha: number };

/**
 * Hold-then-fade scrim sized to the text it protects: full strength across the
 * text stack, fading out over ~14% of the short side past it. Sized from the real
 * placed elements, so a 3-line headline gets a taller scrim than a 1-line one.
 */
function holdScrim(canvas: PosterCanvas, side: 'top' | 'bottom', edge: number, tone: ScrimTone) {
  const fade = canvas.s(0.16);
  const color = (alpha: number) => `rgba(${tone.color.r},${tone.color.g},${tone.color.b},${alpha})`;
  if (side === 'top') {
    const height = Math.min(canvas.height, edge + fade);
    const hold = Math.round((edge / height) * 100);
    return rect({
      name: 'Scrim top',
      x: 0,
      y: 0,
      width: canvas.width,
      height,
      fill: `linear-gradient(180deg, ${color(tone.alpha)} 0%, ${color(tone.alpha * 0.9)} ${hold}%, ${color(0)} 100%)`,
    });
  }
  const y = Math.max(0, edge - fade);
  const height = canvas.height - y;
  const start = Math.round(((edge - y) / height) * 100);
  return rect({
    name: 'Scrim bottom',
    x: 0,
    y,
    width: canvas.width,
    height,
    fill: `linear-gradient(180deg, ${color(0)} 0%, ${color(tone.alpha * 0.9)} ${start}%, ${color(tone.alpha)} 100%)`,
  });
}

/** Inserts top/bottom scrims right above the hero photo, behind every other layer. */
function addLegibilityScrims(
  canvas: PosterCanvas,
  children: PolotnoChild[],
  tones: { top?: ScrimTone; bottom?: ScrimTone }
): void {
  const photoIndex = children.findIndex((child) => child.name === 'Hero photo');
  if (photoIndex < 0) return;
  let topEdge = 0;
  let bottomEdge = canvas.height;
  for (const child of children) {
    // Only copy and icons sitting directly on the photo need a scrim; text on a
    // pill, card, badge or glass panel already has its own surface.
    const custom = child.custom as
      { posterSlot?: { onSurface?: boolean }; posterOnPhoto?: boolean } | undefined;
    const onPhoto =
      (child.type === 'text' && custom?.posterSlot && !custom.posterSlot.onSurface) ||
      (child.type === 'svg' && custom?.posterOnPhoto);
    if (!onPhoto) continue;
    const y = Number(child.y);
    const bottom = y + Number(child.height);
    // Group by where the element starts: a stack that begins above the midline is the
    // top stack even when its last line runs past it.
    if (y < canvas.height / 2) topEdge = Math.max(topEdge, bottom);
    else bottomEdge = Math.min(bottomEdge, y);
  }
  const scrims: PolotnoChild[] = [];
  if (tones.top && topEdge > 0)
    scrims.push(holdScrim(canvas, 'top', topEdge + canvas.s(0.02), tones.top));
  if (tones.bottom && bottomEdge < canvas.height) {
    scrims.push(holdScrim(canvas, 'bottom', bottomEdge - canvas.s(0.02), tones.bottom));
  }
  children.splice(photoIndex + 1, 0, ...scrims);
}

/** Brand wordmark style: chunky rounded caps, used for "at KAME HOME" lines. */
const WORDMARK_ROLE: PosterTypeRole = {
  family: 'Fredoka',
  weight: '700',
  letterSpacing: 0.02,
  lineHeight: 1,
  uppercase: true,
  widthFactor: 0.64,
};

// ---------------------------------------------------------------------------
// 1. wave-duo: Kame "Coffee • View • You time"
// ---------------------------------------------------------------------------

function buildWaveDuo(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, facts, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const children: PolotnoChild[] = [];
  const [photoA, photoB] = ctx.photos;
  // Story stacks photo, copy and features vertically; a second photo would crowd it.
  const hasSecond = Boolean(photoB) && !canvas.isWide && !canvas.isStory;

  const photoABox = pick(canvas, {
    square: { x: W * 0.44, y: 0, w: W * 0.56, h: H * (hasSecond ? 0.56 : 0.64) },
    story: { x: 0, y: 0, w: W, h: H * 0.4 },
    wide: { x: W * 0.5, y: 0, w: W * 0.5, h: H },
  });
  if (photoA) {
    children.push(
      photoElement({
        url: photoA.url,
        x: photoABox.x,
        y: photoABox.y,
        width: photoABox.w,
        height: photoABox.h,
        naturalSize: photoA.size,
        name: 'Hero photo',
        treatment: {
          clipSrc: organicClipSvgUrl(
            photoABox.w,
            photoABox.h,
            canvas.isWide ? 'right' : 'top-right'
          ),
          grade: true,
          focusY: 0.45,
        },
      })
    );
  }
  const col = pick(canvas, {
    square: { x: pad, w: W * 0.42 - pad, top: pad * 1.1 },
    story: { x: pad, w: W - pad * 2, top: H * 0.43 },
    wide: { x: pad, w: W * 0.47 - pad, top: pad * 0.9 },
  });
  const center = col.x + col.w / 2;
  let cursor = col.top;

  if (spec.include.logo && facts.logoUrl) {
    const logoSize = canvas.s(pick(canvas, { square: 0.13, story: 0.16, wide: 0.12 }));
    const logoX = canvas.isStory ? pad : center - logoSize / 2;
    const logoY = canvas.isStory ? pad : cursor;
    children.push(logoElement({ url: facts.logoUrl, x: logoX, y: logoY, size: logoSize }));
    children.push(
      burstOrnament({
        x: logoX - logoSize * 0.34,
        y: logoY + logoSize * 0.05,
        size: logoSize * 0.34,
        color: palette.accent,
        mirror: true,
      })
    );
    if (!canvas.isStory) cursor += logoSize + canvas.s(0.018);
  }

  const headline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Headline',
      value: spec.copy.headline,
      role: fonts.display,
      x: col.x,
      y: cursor,
      width: col.w,
      maxFontSize: canvas.s(pick(canvas, { square: 0.11, story: 0.105, wide: 0.1 })),
      maxLines: 4,
      minFontSize: canvas.s(0.04),
      fill: palette.accent,
      effect: fonts.displayEffect,
      outlineColor: '#ffffff',
      shadowColor: palette.fieldInk,
    })
  );
  cursor = after(headline, cursor);

  const accent = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Script accent',
      value: spec.copy.accent,
      role: fonts.script,
      x: col.x - W * 0.02,
      allowOverlap: true,
      y: cursor - (headline ? headline.fitted.fontSize * 0.12 : 0),
      width: col.w + W * 0.06,
      maxFontSize: canvas.s(pick(canvas, { square: 0.095, story: 0.11, wide: 0.085 })),
      maxLines: 2,
      fill: palette.fieldInk,
    })
  );
  cursor = after(accent, cursor, canvas.s(0.025));

  if (spec.copy.chips.length > 0) {
    const chips = chipsPill(spec.copy.chips, '  •  ', {
      floor: canvas.minText,
      name: 'Chips',
      role: fonts.chip,
      centerX: center,
      y: cursor,
      height: canvas.s(pick(canvas, { square: 0.062, story: 0.07, wide: 0.07 })),
      maxWidth: col.w + W * 0.04,
      fill: palette.accent,
      ink: palette.onAccent,
    });
    children.push(...chips.children);
    if (chips.height > 0) cursor += chips.height + canvas.s(0.025);
  }

  const tagline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Tagline',
      value: spec.copy.tagline,
      role: fonts.body,
      x: col.x,
      y: cursor,
      width: col.w,
      maxFontSize: canvas.s(pick(canvas, { square: 0.032, story: 0.038, wide: 0.034 })),
      maxLines: 2,
      fill: palette.fieldMuted,
    })
  );

  // Second photo fills the bottom-left, starting below the copy so it never covers it.
  const textBottom = after(tagline, cursor) + canvas.s(0.03);
  const photoBBox = pick(canvas, {
    square: { x: 0, y: Math.max(H * 0.55, textBottom), w: W * 0.58 },
    story: { x: 0, y: Math.max(H * 0.66, textBottom), w: W * 0.6 },
    wide: { x: 0, y: H, w: 0 },
  });
  const photoBHeight = H - photoBBox.y;
  if (hasSecond && photoB && photoBHeight > H * 0.2) {
    children.splice(
      1,
      0,
      photoElement({
        url: photoB.url,
        x: photoBBox.x,
        y: photoBBox.y,
        width: photoBBox.w,
        height: photoBHeight,
        naturalSize: photoB.size,
        name: 'Second photo',
        treatment: {
          clipSrc: organicClipSvgUrl(photoBBox.w, photoBHeight, 'bottom-left'),
          grade: true,
          focusY: 0.6,
        },
      })
    );
  }

  // Feature panel: bottom-right on square/story, under the column on wide.
  const panel = pick(canvas, {
    square: { x: W * 0.6, w: W * 0.4 - pad * 0.6, bottom: H - pad },
    story: { x: pad, w: W - pad * 2, bottom: H - canvas.safeBottom - pad },
    wide: { x: pad, w: W * 0.47 - pad, bottom: H - pad * 0.8 },
  });
  const features = spec.features.slice(0, 3);
  let panelBottom = panel.bottom;
  const locHeight = canvas.s(pick(canvas, { square: 0.058, story: 0.052, wide: 0.07 }));
  const panelFloor = canvas.isWide || canvas.isStory ? textBottom : 0;
  if (spec.include.location && facts.location && panelBottom - locHeight > panelFloor) {
    const loc = locationPill(facts.location, {
      floor: canvas.minText,
      name: 'Location',
      role: fonts.chip,
      centerX: panel.x + panel.w / 2,
      y: panelBottom - locHeight,
      height: locHeight,
      maxWidth: !canvas.isWide && !canvas.isStory ? W * 0.5 : panel.w,
      clampX:
        !canvas.isWide && !canvas.isStory
          ? [W * 0.45, W - pad * 0.6]
          : [panel.x, panel.x + panel.w],
      fill: palette.accent,
      ink: palette.onAccent,
      icon: 'map-pin',
    });
    children.push(...loc.children);
    if (loc.height > 0) panelBottom -= locHeight + canvas.s(0.04);
  }
  if (features.length > 0) {
    const iconSize = canvas.s(pick(canvas, { square: 0.085, story: 0.08, wide: 0.07 }));
    const probe = iconRow({
      floor: canvas.minText,
      features,
      x: panel.x,
      y: 0,
      width: panel.w,
      iconSize,
      iconColor: palette.accent,
      labelColor: palette.accent,
      labelRole: fonts.chip,
      maxPerRow: 3,
      labelScale: 0.3,
    });
    const rowTop = panelBottom - probe.height;
    const row = iconRow({
      floor: canvas.minText,
      features,
      x: panel.x,
      y: rowTop,
      width: panel.w,
      iconSize,
      iconColor: palette.accent,
      labelColor: palette.accent,
      labelRole: fonts.chip,
      maxPerRow: 3,
      labelScale: 0.3,
    });
    // Only draw when it doesn't collide with the headline column (wide) or photo A.
    const limit = canvas.isWide || canvas.isStory ? textBottom : photoABox.y + photoABox.h;
    if (rowTop > limit) children.push(...row.children);
  }

  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// 2. sky-headline: Four J's "Bali" (day)
// ---------------------------------------------------------------------------

function buildSkyHeadline(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, facts, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const children: PolotnoChild[] = [];
  const photo = fullBleedPhoto(ctx, 0.7);
  if (photo) children.push(photo);

  const textW = pick(canvas, { square: W * 0.84, story: W * 0.86, wide: W * 0.56 });
  const textX = canvas.isWide ? pad : (W - textW) / 2;
  if (canvas.isWide) {
    children.push(
      rect({
        name: 'Scrim',
        x: 0,
        y: 0,
        width: W * 0.62,
        height: H,
        fill: `linear-gradient(90deg, rgba(${palette.scrimLight.r},${palette.scrimLight.g},${palette.scrimLight.b},0.92) 0%, rgba(${palette.scrimLight.r},${palette.scrimLight.g},${palette.scrimLight.b},0.8) 70%, rgba(${palette.scrimLight.r},${palette.scrimLight.g},${palette.scrimLight.b},0) 100%)`,
      })
    );
  }

  let cursor = pick(canvas, { square: pad * 0.9, story: pad * 2.2, wide: pad });
  const eyebrow = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Eyebrow',
      value: spec.copy.eyebrow,
      role: fonts.eyebrow,
      x: textX,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(0.036),
      maxLines: 2,
      fill: palette.fieldInk,
      align: canvas.isWide ? 'left' : 'center',
    })
  );
  cursor = after(eyebrow, cursor, canvas.s(0.005));
  const script = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Script accent',
      value: spec.copy.accent,
      role: fonts.script,
      x: textX,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(pick(canvas, { square: 0.2, story: 0.24, wide: 0.19 })),
      maxLines: 2,
      fill: palette.fieldInk,
      align: canvas.isWide ? 'left' : 'center',
      effect: 'soft-shadow',
      shadowColor: '#ffffff',
    })
  );
  cursor = after(script, cursor, canvas.s(0.004));
  const headline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Headline',
      value: spec.copy.headline,
      role: fonts.display,
      x: textX,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(pick(canvas, { square: 0.052, story: 0.06, wide: 0.05 })),
      maxLines: 3,
      minFontSize: canvas.s(0.04),
      fill: palette.fieldInk,
      align: canvas.isWide ? 'left' : 'center',
    })
  );
  cursor = after(headline, cursor, canvas.s(0.02));
  const headBottom = cursor;

  // Supporting copy (banner + subhead) is placed after the fact modules below, only
  // into whatever room they leave: real amenities and times outrank a sentence.
  const extras: PolotnoChild[] = [];
  let extrasBottom = headBottom;
  const buildExtras = (withSubhead: boolean) => {
    const out: PolotnoChild[] = [];
    let y = headBottom;
    if (spec.copy.cta) {
      const banner = pill({
        floor: canvas.minText,
        name: 'Banner',
        label: spec.copy.cta,
        role: fonts.chip,
        ...(canvas.isWide ? { x: textX } : { centerX: W / 2 }),
        y,
        height: canvas.s(0.058),
        maxWidth: textW,
        fill: palette.accent,
        ink: palette.onAccent,
      });
      out.push(...banner.children);
      if (banner.height > 0) y += banner.height + canvas.s(0.012);
    }
    if (withSubhead) {
      const sub = posterText({
        floor: canvas.minText,
        name: 'Subhead',
        value: spec.copy.subhead,
        role: fonts.body,
        x: textX,
        y,
        width: textW,
        maxFontSize: canvas.s(pick(canvas, { square: 0.03, story: 0.034, wide: 0.03 })),
        maxLines: 2,
        fill: palette.fieldInk,
        align: canvas.isWide ? 'left' : 'center',
        optional: true,
      });
      if (sub) {
        out.push(sub.child);
        y = sub.y + sub.height;
      }
    }
    return { out, bottom: y };
  };

  // Bottom stack, built upward from the info bar. Optional pieces drop when they'd
  // climb into the headline stack.
  const infos = spec.include.infoBar ? infoItems(facts) : [];
  const barH =
    infos.length > 0 ? canvas.s(pick(canvas, { square: 0.13, story: 0.11, wide: 0.15 })) : 0;
  // In Story the info bar floats above the reply-bar zone on a matching field band.
  const barY = H - barH - canvas.safeBottom;
  const bottomChildren: PolotnoChild[] = [];
  let bottom = barY - canvas.s(0.035);
  const lowerW = canvas.isWide ? W * 0.56 : W - pad * 2;
  const lowerX = canvas.isWide ? pad : pad;

  const features = spec.features.slice(0, canvas.isWide ? 4 : 5);
  if (features.length > 0) {
    const iconSize = canvas.s(pick(canvas, { square: 0.075, story: 0.085, wide: 0.075 }));
    const probe = iconRow({
      floor: canvas.minText,
      features,
      x: lowerX,
      y: 0,
      width: lowerW,
      iconSize,
      iconColor: '#ffffff',
      labelColor: '#ffffff',
      labelRole: fonts.chip,
      maxPerRow: 5,
      labelScale: 0.3,
    });
    if (bottom - probe.height > headBottom + canvas.s(0.06)) {
      const row = iconRow({
        floor: canvas.minText,
        features,
        x: lowerX,
        y: bottom - probe.height,
        width: lowerW,
        iconSize,
        iconColor: '#ffffff',
        labelColor: '#ffffff',
        labelRole: fonts.chip,
        maxPerRow: 5,
        labelScale: 0.3,
      });
      bottomChildren.push(...row.children);
      bottom -= probe.height + canvas.s(0.035);
    }
  }
  for (const withSubhead of [true, false]) {
    const attempt = buildExtras(withSubhead);
    if (attempt.bottom + canvas.s(0.06) < bottom) {
      extras.push(...attempt.out);
      extrasBottom = attempt.bottom;
      break;
    }
  }
  children.push(...extras);
  const topStackBottom = extrasBottom;
  const room = (need: number) => bottom - need > topStackBottom + canvas.s(0.06);
  if (spec.copy.chips.length > 0 && room(canvas.s(0.06))) {
    const band = chipsPill(spec.copy.chips, '  |  ', {
      floor: canvas.minText,
      name: 'Chips',
      role: fonts.chip,
      ...(canvas.isWide ? { x: lowerX } : { centerX: W / 2 }),
      y: bottom - canvas.s(0.055),
      height: canvas.s(0.055),
      maxWidth: lowerW,
      fill: mixHexToward(palette.accent, { r: 0, g: 0, b: 0 }, 0.15),
      ink: palette.onAccent,
    });
    bottomChildren.push(...band.children);
    if (band.height > 0) bottom -= band.height + canvas.s(0.015);
  }
  const nameSize = canvas.s(pick(canvas, { square: 0.085, story: 0.1, wide: 0.08 }));
  if (room(nameSize * 1.2)) {
    const name = posterText({
      floor: canvas.minText,
      name: 'Property name',
      value: facts.propertyName,
      role: fonts.script,
      x: lowerX,
      y: bottom,
      anchor: 'bottom',
      width: lowerW,
      maxFontSize: nameSize,
      maxLines: 2,
      optional: true,
      fill: '#ffffff',
      align: canvas.isWide ? 'left' : 'center',
      effect: 'soft-shadow',
      shadowColor: '#000000',
    });
    if (name) {
      bottomChildren.push(name.child);
      bottom = name.y;
    }
  }

  const scrimTop = Math.max(topStackBottom, bottom - canvas.s(0.08));
  children.push(
    gradientScrim({
      y: scrimTop,
      height: barY - scrimTop,
      width: W,
      color: palette.scrimDark,
      from: 0,
      to: 0.72,
    })
  );
  children.push(...bottomChildren);
  if (infos.length > 0) {
    if (canvas.safeBottom > 0) {
      children.push(
        rect({ name: 'Info band', x: 0, y: barY, width: W, height: H - barY, fill: palette.field })
      );
    }
    children.push(
      ...infoBar({
        floor: canvas.minText,
        items: infos,
        x: 0,
        y: barY,
        width: W,
        height: barH,
        palette,
        titleRole: fonts.chip,
        valueRole: fonts.body,
      })
    );
  }

  if (!canvas.isWide)
    addLegibilityScrims(canvas, children, { top: { color: palette.scrimLight, alpha: 0.9 } });
  return { background: palette.deep, children };
}

// ---------------------------------------------------------------------------
// 3. night-glass: Four J's "Bali" (night)
// ---------------------------------------------------------------------------

function buildNightGlass(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, facts, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const children: PolotnoChild[] = [];
  const photo = fullBleedPhoto(ctx, 0.5);
  if (photo) children.push(photo);
  // Night mood regardless of the photo's time of day: a deep wash over everything.
  children.push(
    rect({
      name: 'Night wash',
      x: 0,
      y: 0,
      width: W,
      height: H,
      fill: `rgba(${palette.scrimDark.r},${palette.scrimDark.g},${palette.scrimDark.b},0.28)`,
    })
  );

  const textW = pick(canvas, { square: W * 0.62, story: W - pad * 2, wide: W * 0.5 });
  let cursor = pick(canvas, { square: pad, story: pad * 2, wide: pad * 0.8 });
  const eyebrow = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Eyebrow',
      value: spec.copy.eyebrow,
      role: fonts.eyebrow,
      x: pad,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(0.038),
      maxLines: 2,
      fill: palette.lightInk,
      align: 'left',
    })
  );
  cursor = after(eyebrow, cursor);
  const script = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Script accent',
      value: spec.copy.accent,
      role: fonts.script,
      x: pad,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(pick(canvas, { square: 0.16, story: 0.2, wide: 0.15 })),
      maxLines: 2,
      fill: palette.glow,
      align: 'left',
      effect: 'soft-shadow',
    })
  );
  cursor = after(script, cursor);
  const headline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Headline',
      value: spec.copy.headline,
      role: fonts.display,
      x: pad,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(0.042),
      maxLines: 3,
      minFontSize: canvas.s(0.04),
      fill: palette.lightInk,
      align: 'left',
    })
  );
  cursor = after(headline, cursor, canvas.s(0.025));

  if (spec.copy.subhead) {
    const cardPad = canvas.s(0.03);
    const body = posterText({
      floor: canvas.minText,
      name: 'Subhead',
      onSurface: true,
      value: spec.copy.subhead,
      role: fonts.body,
      x: pad + cardPad,
      y: cursor + cardPad,
      width: textW - cardPad * 2,
      maxFontSize: canvas.s(pick(canvas, { square: 0.028, story: 0.034, wide: 0.028 })),
      maxLines: pick(canvas, { square: 4, story: 5, wide: 3 }),
      fill: palette.lightInk,
      align: 'left',
    });
    if (body) {
      children.push(
        glassPanel({
          name: 'Glass card',
          x: pad,
          y: cursor,
          width: textW,
          height: body.height + cardPad * 2,
          tint: palette.scrimDark,
          alpha: 0.5,
          radius: canvas.s(0.03),
        }),
        body.child
      );
      cursor += body.height + cardPad * 2;
    }
  }
  const topBottom = cursor;

  // Bottom-up: footer (location / cta), then icon grid + check-in card, then name pill.
  let bottom = H - canvas.safeBottom - pad * 0.9;
  const footerSize = canvas.s(0.028);
  if (spec.include.location && facts.location) {
    const loc = posterText({
      floor: canvas.minText,
      name: 'Location',
      value: facts.location,
      role: fonts.body,
      x: pad + footerSize * 1.6,
      y: bottom,
      anchor: 'bottom',
      width: W * 0.5,
      maxFontSize: footerSize,
      maxLines: 2,
      fill: palette.lightInk,
      align: 'left',
    });
    if (loc) {
      children.push(
        iconElement({
          icon: 'map-pin',
          x: pad,
          y: loc.y,
          size: footerSize * 1.3,
          color: palette.glow,
          strokeWidth: 2,
        }),
        loc.child
      );
    }
  }
  push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Tagline',
      value: spec.copy.tagline,
      role: fonts.body,
      x: W * 0.54,
      y: bottom,
      anchor: 'bottom',
      width: W * 0.46 - pad,
      maxFontSize: footerSize,
      maxLines: 2,
      fill: palette.lightInk,
      align: 'right',
    })
  );
  bottom -= footerSize * 2.6 + canvas.s(0.03);

  const infos = spec.include.infoBar ? infoItems(facts).slice(0, 2) : [];
  const gridW = infos.length > 0 && !canvas.isStory ? W * 0.6 : W - pad * 2;
  const features = spec.features.slice(0, 6);
  let gridTop = bottom;
  if (features.length > 0) {
    const iconSize = canvas.s(pick(canvas, { square: 0.068, story: 0.08, wide: 0.065 }));
    const perRow = canvas.isWide ? 6 : 3;
    const probe = iconRow({
      floor: canvas.minText,
      features,
      x: pad,
      y: 0,
      width: gridW,
      iconSize,
      iconColor: palette.glow,
      labelColor: palette.lightInk,
      labelRole: fonts.body,
      maxPerRow: perRow,
      labelScale: 0.34,
    });
    gridTop = bottom - probe.height;
    if (gridTop > topBottom + canvas.s(0.06)) {
      children.push(
        ...iconRow({
          floor: canvas.minText,
          features,
          x: pad,
          y: gridTop,
          width: gridW,
          iconSize,
          iconColor: palette.glow,
          labelColor: palette.lightInk,
          labelRole: fonts.body,
          maxPerRow: perRow,
          labelScale: 0.34,
        }).children
      );
    } else {
      gridTop = bottom;
    }
  }

  if (infos.length > 0) {
    const cardW = canvas.isStory ? W - pad * 2 : W - pad * 2 - gridW - canvas.s(0.03);
    const cardX = W - pad - cardW;
    const rowH = canvas.s(canvas.isStory ? 0.1 : 0.085);
    const cardH = rowH * infos.length + canvas.s(0.03);
    const cardY = canvas.isStory ? gridTop - cardH - canvas.s(0.03) : bottom - cardH;
    if (cardY > topBottom + canvas.s(0.03)) {
      children.push(
        glassPanel({
          name: 'Check-in card',
          x: cardX,
          y: cardY,
          width: cardW,
          height: cardH,
          tint: palette.scrimDark,
          alpha: 0.6,
          radius: canvas.s(0.03),
        })
      );
      infos.forEach((item, index) => {
        const rowY = cardY + canvas.s(0.015) + index * rowH;
        const iconSize = rowH * 0.42;
        children.push(
          iconElement({
            icon: item.icon,
            x: cardX + canvas.s(0.025),
            y: rowY + (rowH - iconSize) / 2,
            size: iconSize,
            color: palette.glow,
            strokeWidth: 2,
          })
        );
        const textX = cardX + canvas.s(0.025) + iconSize + canvas.s(0.02);
        const textW2 = cardX + cardW - textX - canvas.s(0.02);
        const title = push(
          children,
          posterText({
            floor: canvas.minText,
            name: item.title,
            onSurface: true,
            value: item.title,
            // Small card title: tracked caps at this size blow past the column width.
            role: { ...fonts.chip, letterSpacing: Math.min(fonts.chip.letterSpacing, 0.04) },
            x: textX,
            y: rowY + rowH * 0.16,
            width: textW2,
            maxFontSize: Math.round(rowH * 0.22),
            maxLines: 1,
            fill: palette.glow,
            align: 'left',
          })
        );
        push(
          children,
          posterText({
            floor: canvas.minText,
            name: `${item.title} value`,
            onSurface: true,
            value: item.value,
            role: fonts.display,
            x: textX,
            y: after(title, rowY + rowH * 0.4),
            width: textW2,
            maxFontSize: Math.round(rowH * 0.3),
            maxLines: 1,
            fill: palette.lightInk,
            align: 'left',
          })
        );
      });
      if (canvas.isStory) gridTop = cardY;
    }
  }

  const pillH = canvas.s(pick(canvas, { square: 0.062, story: 0.07, wide: 0.07 }));
  if (gridTop - pillH - canvas.s(0.03) > topBottom + canvas.s(0.02)) {
    const namePill = pill({
      floor: canvas.minText,
      name: 'Property name',
      label: facts.propertyName,
      role: fonts.display,
      x: pad,
      y: gridTop - pillH - canvas.s(0.03),
      height: pillH,
      maxWidth: W * 0.7,
      fill: palette.field,
      ink: mixHexToward(palette.accent, { r: 0, g: 0, b: 0 }, 0.35),
    });
    children.push(...namePill.children);
  }

  addLegibilityScrims(canvas, children, {
    top: { color: palette.scrimDark, alpha: 0.62 },
    bottom: { color: palette.scrimDark, alpha: 0.9 },
  });
  return { background: palette.deep, children };
}

// ---------------------------------------------------------------------------
// 4. minimal-title: "The Upper Room"
// ---------------------------------------------------------------------------

function buildMinimalTitle(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, fonts, palette } = ctx;
  const { width: W, pad } = canvas;
  const children: PolotnoChild[] = [];
  const photo = fullBleedPhoto(ctx, 0.62);
  if (photo) {
    children.push(photo);
  }
  const textW = pick(canvas, { square: W * 0.8, story: W * 0.84, wide: W * 0.64 });
  const textX = (W - textW) / 2;
  let cursor = pick(canvas, { square: pad * 1.1, story: pad * 2.4, wide: pad });
  const leafSize = canvas.s(0.05);
  children.push(
    iconElement({
      icon: 'leaf',
      x: W / 2 - leafSize / 2,
      y: cursor,
      size: leafSize,
      color: palette.fieldInk,
      strokeWidth: 1.2,
    })
  );
  cursor += leafSize + canvas.s(0.018);
  const headline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Headline',
      value: spec.copy.headline,
      role: fonts.display,
      x: textX,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(pick(canvas, { square: 0.105, story: 0.12, wide: 0.1 })),
      maxLines: 3,
      minFontSize: canvas.s(0.04),
      fill: palette.fieldInk,
    })
  );
  cursor = after(headline, cursor, canvas.s(0.012));
  push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Eyebrow',
      value: spec.copy.eyebrow || spec.copy.accent,
      role: fonts.eyebrow,
      x: textX,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(0.03),
      maxLines: 2,
      fill: palette.fieldInk,
    })
  );
  addLegibilityScrims(canvas, children, { top: { color: palette.scrimLight, alpha: 0.9 } });
  return { background: palette.field, children };
}

// ---------------------------------------------------------------------------
// 5. magazine-cover: Kame "Slow mornings"
// ---------------------------------------------------------------------------

function buildMagazineCover(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, facts, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const children: PolotnoChild[] = [];
  const photo = fullBleedPhoto(ctx, 0.55);
  if (photo) children.push(photo);
  const warmShade = mixHexToward(palette.accent, { r: 40, g: 24, b: 12 }, 0.6);
  const shadeRgb = parseHexRgb(warmShade) ?? palette.scrimDark;

  const textW = pick(canvas, { square: W * 0.6, story: W * 0.8, wide: W * 0.5 });
  let cursor = pick(canvas, { square: pad * 1.1, story: pad * 2.2, wide: pad });
  const headline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Headline',
      value: spec.copy.headline,
      role: fonts.display,
      x: pad,
      y: cursor,
      width: textW,
      maxFontSize: canvas.s(pick(canvas, { square: 0.15, story: 0.18, wide: 0.14 })),
      maxLines: 3,
      minFontSize: canvas.s(0.04),
      fill: palette.lightInk,
      align: 'left',
      effect: 'soft-shadow',
    })
  );
  cursor = after(headline, cursor);
  const script = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Script accent',
      value: spec.copy.accent,
      role: fonts.script,
      x: pad + W * 0.04,
      allowOverlap: true,
      y: cursor - (headline ? headline.fitted.fontSize * 0.3 : 0),
      width: textW,
      maxFontSize: canvas.s(pick(canvas, { square: 0.15, story: 0.17, wide: 0.13 })),
      maxLines: 2,
      fill: '#ffffff',
      align: 'left',
      effect: 'soft-shadow',
    })
  );
  cursor = after(script, cursor, canvas.s(0.008));

  const brand = facts.brandName || facts.propertyName;
  const atSize = canvas.s(0.045);
  // "at BRAND" only renders when the wordmark fits; a wrapped wordmark reads as a typo.
  const wordmark = posterText({
    floor: canvas.minText,
    name: 'Brand',
    value: brand,
    role: WORDMARK_ROLE,
    x: pad + atSize * 1.5,
    y: cursor,
    width: textW - atSize * 1.5,
    maxFontSize: canvas.s(0.062),
    maxLines: 1,
    optional: true,
    fill: palette.accent,
    align: 'left',
    effect: 'outline-shadow',
    outlineColor: '#ffffff',
  });
  const at = wordmark
    ? posterText({
        floor: canvas.minText,
        name: 'At',
        value: 'at',
        role: fonts.eyebrow,
        x: pad,
        y: cursor + atSize * 0.18,
        width: atSize * 1.6,
        maxFontSize: atSize,
        maxLines: 1,
        fill: palette.lightInk,
        align: 'left',
      })
    : null;
  push(children, at);
  push(children, wordmark);
  cursor = Math.max(after(at, cursor), after(wordmark, cursor)) + canvas.s(0.018);
  children.push(
    rect({
      name: 'Rule',
      x: pad,
      y: cursor,
      width: textW * 0.9,
      height: Math.max(1.5, canvas.s(0.002)),
      fill: palette.lightInk,
      opacity: 0.8,
    })
  );
  cursor += canvas.s(0.018);
  push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Eyebrow',
      value: spec.copy.eyebrow || facts.location || '',
      role: fonts.eyebrow,
      x: pad,
      y: cursor,
      width: textW * 0.9,
      maxFontSize: canvas.s(0.036),
      maxLines: 2,
      fill: palette.lightInk,
      align: 'center',
    })
  );

  // Bottom glass strip with inline icon + label items, tagline under it.
  const stripRole = { ...fonts.chip, letterSpacing: Math.min(fonts.chip.letterSpacing, 0.05) };
  let features = spec.features.slice(0, canvas.isWide ? 3 : 4);
  let bottom = H - canvas.safeBottom - pad * 0.9;
  const tagline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Tagline',
      value: spec.copy.tagline,
      role: fonts.body,
      x: pad,
      y: bottom,
      anchor: 'bottom',
      width: W - pad * 2,
      maxFontSize: canvas.s(0.032),
      maxLines: 1,
      fill: palette.lightInk,
    })
  );
  bottom = tagline ? tagline.y - canvas.s(0.02) : bottom;
  const logoSize = canvas.s(0.17);
  const hasLogo = spec.include.logo && Boolean(facts.logoUrl);
  if (features.length > 0) {
    const stripH = canvas.s(pick(canvas, { square: 0.085, story: 0.08, wide: 0.1 }));
    const stripW = W - pad * 2 - (hasLogo && !canvas.isStory ? logoSize * 0.55 : 0);
    const stripY = bottom - stripH;
    const iconSize = stripH * 0.4;
    const labelWidth = (count: number) => (stripW - stripH * 0.4) / count - iconSize - stripH * 0.2;
    // Fewer, readable items beat four squeezed ones.
    while (
      features.length > 2 &&
      features.some(
        (feature) =>
          fitText(feature.label, stripRole, {
            maxWidth: labelWidth(features.length),
            maxFontSize: canvas.minText,
            minFontSize: canvas.minText,
            maxLines: 1,
          }).overflow
      )
    ) {
      features = features.slice(0, -1);
    }
    // Items sized to their labels; the strip hugs them with capped, even gaps.
    const labelGap = stripH * 0.12;
    const placed = features.map((feature) => {
      const fitted = fitText(feature.label, stripRole, {
        maxWidth: labelWidth(features.length),
        maxFontSize: Math.max(Math.round(stripH * 0.3), canvas.minText),
        minFontSize: canvas.minText,
        maxLines: 1,
      });
      const textWidth = Math.ceil(fitted.width);
      return { feature, fitted, width: iconSize + labelGap + textWidth, textWidth };
    });
    const fontSize = Math.min(...placed.map((item) => item.fitted.fontSize));
    const inner = stripW - stripH * 0.7;
    const used = placed.reduce((sum, item) => sum + item.width, 0);
    const spacing =
      placed.length > 1
        ? Math.min(stripH * 0.9, Math.max(0, (inner - used) / (placed.length - 1)))
        : 0;
    const panelWidth = Math.min(stripW, used + spacing * (placed.length - 1) + stripH * 0.7);
    const panelX = canvas.isWide ? pad : pad + (stripW - panelWidth) / 2;
    children.push(
      glassPanel({
        name: 'Feature strip',
        x: panelX,
        y: stripY,
        width: panelWidth,
        height: stripH,
        tint: shadeRgb,
        alpha: 0.42,
        radius: stripH / 2,
      })
    );
    let itemX = panelX + stripH * 0.35;
    for (const item of placed) {
      children.push(
        iconElement({
          icon: item.feature.icon,
          x: itemX,
          y: stripY + (stripH - iconSize) / 2,
          size: iconSize,
          color: '#ffffff',
        })
      );
      const label = posterText({
        floor: canvas.minText,
        name: `Feature ${item.feature.label}`,
        value: item.feature.label,
        role: stripRole,
        x: itemX + iconSize + labelGap,
        y: stripY,
        width: item.textWidth + stripH * 0.3,
        maxFontSize: fontSize,
        minFontSize: fontSize,
        maxLines: 1,
        fill: '#ffffff',
        align: 'left',
        onSurface: true,
      });
      if (label) {
        label.child.y = Math.round(stripY + (stripH - label.height) / 2);
        children.push(label.child);
      }
      itemX += item.width + spacing;
    }
    bottom = stripY;
  }
  if (hasLogo && facts.logoUrl) {
    children.push(
      logoElement({
        url: facts.logoUrl,
        x: W - pad * 0.6 - logoSize,
        y: canvas.isStory ? bottom - logoSize - canvas.s(0.02) : bottom - logoSize * 0.45,
        size: logoSize,
      })
    );
  }
  addLegibilityScrims(canvas, children, {
    top: { color: shadeRgb, alpha: 0.62 },
    bottom: { color: shadeRgb, alpha: 0.72 },
  });
  return { background: palette.deep, children };
}

// ---------------------------------------------------------------------------
// 6. feature-sticker: Kame "Game on, stay in"
// ---------------------------------------------------------------------------

function splitHeadline(headline: string): [string, string] {
  const comma = headline.indexOf(',');
  if (comma > 0) return [headline.slice(0, comma + 1).trim(), headline.slice(comma + 1).trim()];
  const words = headline.split(' ');
  if (words.length < 2) return [headline, ''];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}

function buildFeatureSticker(ctx: PosterBuildContext): PosterBuildResult {
  const { canvas, spec, facts, fonts, palette } = ctx;
  const { width: W, height: H, pad } = canvas;
  const children: PolotnoChild[] = [];
  const photo = fullBleedPhoto(ctx, 0.62);
  if (photo) children.push(photo);

  let cursor = pick(canvas, { square: pad * 0.7, story: pad * 1.8, wide: pad * 0.6 });
  if (spec.include.logo && facts.logoUrl) {
    const logoSize = canvas.s(pick(canvas, { square: 0.12, story: 0.15, wide: 0.12 }));
    children.push(
      logoElement({ url: facts.logoUrl, x: W / 2 - logoSize / 2, y: cursor, size: logoSize })
    );
    cursor += logoSize + canvas.s(0.005);
  }
  const [lineA, lineB] = splitHeadline(spec.copy.headline);
  const headW = W - pad * 3;
  const headSize = canvas.s(pick(canvas, { square: 0.11, story: 0.13, wide: 0.1 }));
  const common = {
    role: fonts.display,
    width: headW,
    maxLines: 1,
    minFontSize: canvas.s(0.045),
    effect: 'outline-shadow' as const,
    outlineColor: '#ffffff',
    shadowColor: palette.fieldInk,
  };
  const a = posterText({
    floor: canvas.minText,
    ...common,
    name: 'Headline',
    value: lineA,
    x: (W - headW) / 2,
    y: cursor,
    maxFontSize: headSize,
    fill: palette.accent,
  });
  const b = lineB
    ? posterText({
        floor: canvas.minText,
        ...common,
        name: 'Headline accent',
        value: lineB,
        x: (W - headW) / 2,
        y: cursor,
        maxFontSize: headSize,
        fill: palette.secondary,
      })
    : null;
  // Same size for both halves so the two-tone line reads as one headline.
  const size = Math.min(a?.fitted.fontSize ?? headSize, b?.fitted.fontSize ?? headSize);
  if (a) {
    a.child.fontSize = size;
    a.child.height = Math.ceil(size * fonts.display.lineHeight * 1.04);
    children.push(a.child);
    const ornament = size * 0.6;
    children.push(
      burstOrnament({
        x: pad * 0.6,
        y: cursor + size * 0.2,
        size: ornament,
        color: palette.accent,
        mirror: true,
      }),
      burstOrnament({
        x: W - pad * 0.6 - ornament,
        y: cursor + size * 0.2,
        size: ornament,
        color: palette.accent,
      })
    );
    cursor += size * fonts.display.lineHeight;
  }
  if (b) {
    b.child.fontSize = size;
    b.child.height = Math.ceil(size * fonts.display.lineHeight * 1.04);
    b.child.y = Math.round(cursor);
    children.push(b.child);
    cursor += size * fonts.display.lineHeight;
  }
  cursor += canvas.s(0.012);
  const eyebrow = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Eyebrow',
      value: spec.copy.eyebrow,
      role: fonts.eyebrow,
      x: pad,
      y: cursor,
      width: W - pad * 2,
      maxFontSize: canvas.s(0.034),
      maxLines: 2,
      fill: palette.fieldInk,
    })
  );
  const topBottom = after(eyebrow, cursor);

  // Sticker on the right, vertically between headline and the bottom card.
  const badgeD = canvas.s(pick(canvas, { square: 0.26, story: 0.34, wide: 0.3 }));
  const badgeFill = mixHexToward(palette.accent, { r: 0, g: 0, b: 0 }, 0.3);
  children.push(
    ...stickerBadge({
      floor: canvas.minText,
      text: spec.copy.badge,
      centerX: W - pad - badgeD / 2,
      centerY: Math.max(
        topBottom + badgeD * 0.62,
        H * pick(canvas, { square: 0.42, story: 0.4, wide: 0.55 })
      ),
      diameter: badgeD,
      fill: badgeFill,
      ink: readableOn(badgeFill),
      role: fonts.chip,
      sparkleColor: palette.accent,
    })
  );

  // Footer: location pill (+ tagline under it) centered at the bottom.
  let bottom = H - canvas.safeBottom - pad * 0.6;
  const tagline = push(
    children,
    posterText({
      floor: canvas.minText,
      name: 'Tagline',
      value: spec.copy.tagline,
      role: fonts.body,
      x: pad,
      y: bottom,
      anchor: 'bottom',
      width: W - pad * 2,
      maxFontSize: canvas.s(0.026),
      maxLines: 1,
      fill: palette.fieldInk,
    })
  );
  bottom = tagline ? tagline.y - canvas.s(0.01) : bottom;
  if (spec.include.location && facts.location) {
    const locH = canvas.s(pick(canvas, { square: 0.056, story: 0.05, wide: 0.068 }));
    const branded =
      facts.brandName && !facts.location.toLowerCase().includes(facts.brandName.toLowerCase())
        ? `${facts.brandName}, ${facts.location}`
        : facts.location;
    const loc = locationPill(branded, {
      floor: canvas.minText,
      name: 'Location',
      role: fonts.chip,
      centerX: W / 2,
      y: bottom - locH,
      height: locH,
      maxWidth: W - pad * 2,
      fill: palette.secondary,
      ink: palette.onSecondary,
      icon: 'map-pin',
    });
    children.push(...loc.children);
    if (loc.height > 0) bottom -= locH + canvas.s(0.025);
  }

  // "Perfect for" card bottom-left, script sign-off bottom-right.
  const features = spec.features.slice(0, 4);
  const cardW = pick(canvas, { square: W * 0.56, story: W - pad * 2, wide: W * 0.5 });
  if (features.length > 0) {
    const iconSize = canvas.s(pick(canvas, { square: 0.06, story: 0.075, wide: 0.06 }));
    const cardPad = canvas.s(0.02);
    const probe = iconRow({
      floor: canvas.minText,
      features,
      x: 0,
      y: 0,
      width: cardW - cardPad * 2,
      iconSize,
      iconColor: palette.accent,
      labelColor: palette.fieldInk,
      onSurface: true,
      labelRole: fonts.chip,
      maxPerRow: 4,
      labelScale: 0.3,
    });
    const titleH = canvas.s(0.045);
    const cardH = probe.height + cardPad * 2 + titleH * 0.6;
    const cardY = bottom - cardH;
    if (cardY > topBottom + canvas.s(0.04)) {
      children.push(
        rect({
          name: 'Feature card',
          x: pad,
          y: cardY,
          width: cardW,
          height: cardH,
          fill: palette.field,
          opacity: 0.95,
          cornerRadius: canvas.s(0.028),
          stroke: palette.accent,
          strokeWidth: Math.max(1.5, canvas.s(0.002)),
        })
      );
      if (spec.copy.listTitle) {
        const title = pill({
          floor: canvas.minText,
          name: 'List title',
          label: spec.copy.listTitle,
          role: fonts.chip,
          x: pad + cardPad,
          y: cardY - titleH / 2,
          height: titleH,
          maxWidth: cardW * 0.7,
          fill: palette.accent,
          ink: palette.onAccent,
        });
        children.push(...title.children);
      }
      children.push(
        ...iconRow({
          floor: canvas.minText,
          features,
          x: pad + cardPad,
          y: cardY + cardPad + titleH * 0.5,
          width: cardW - cardPad * 2,
          iconSize,
          iconColor: palette.accent,
          labelColor: palette.fieldInk,
          onSurface: true,
          labelRole: fonts.chip,
          maxPerRow: 4,
          labelScale: 0.3,
        }).children
      );
      if (!canvas.isStory && !canvas.isWide && spec.copy.accent) {
        const signX = pad + cardW + canvas.s(0.03);
        const sign = posterText({
          floor: canvas.minText,
          name: 'Script accent',
          value: spec.copy.accent,
          role: fonts.script,
          x: signX,
          y: cardY + cardH * 0.1,
          width: W - signX - pad,
          maxFontSize: canvas.s(0.06),
          maxLines: 2,
          fill: palette.fieldInk,
        });
        if (sign) {
          children.push(sign.child);
          const heart = canvas.s(0.035);
          children.push(
            iconElement({
              icon: 'heart',
              x: W - pad - heart,
              y: sign.y + sign.height,
              size: heart,
              color: palette.accent,
              strokeWidth: 2,
            })
          );
        }
      }
    }
  }

  addLegibilityScrims(canvas, children, {
    top: { color: palette.scrimLight, alpha: 0.92 },
    bottom: { color: palette.scrimLight, alpha: 0.9 },
  });
  return { background: palette.field, children };
}

export const POSTER_ARCHETYPES: Record<
  PosterArchetypeId,
  (ctx: PosterBuildContext) => PosterBuildResult
> = {
  'wave-duo': buildWaveDuo,
  'sky-headline': buildSkyHeadline,
  'night-glass': buildNightGlass,
  'minimal-title': buildMinimalTitle,
  'magazine-cover': buildMagazineCover,
  'feature-sticker': buildFeatureSticker,
};

/** Default type system per archetype, used when the director doesn't pick one. */
export const POSTER_ARCHETYPE_DEFAULT_FONTS: Record<PosterArchetypeId, PosterFontPairing['id']> = {
  'wave-duo': 'cozy-cafe',
  'sky-headline': 'tropical-script',
  'night-glass': 'night-brush',
  'minimal-title': 'editorial-calm',
  'magazine-cover': 'magazine-cover',
  'feature-sticker': 'playful-pop',
};
