import type { ReactNode } from 'react';

import { Lines } from '../concepts';
import { Phone, PHONE_H, PHONE_W } from '../device';
import { reveal, rise, SETTLED } from '../motion';
import { Box, Cta, Frame, Kicker, SITE, Sub, useFrameCtx, Wordmark } from '../primitives';
import { STORY_SAFE, type Format, type ToneName } from '../theme';

/**
 * One feature, one message, one phone. Every module in the series uses this layout so the
 * set reads as a campaign: kicker names the module, headline carries one accent phrase,
 * the phone shows the module's real mobile screen doing its job.
 */
export interface FeatureSpec {
  /** Folder / file slug, e.g. `receipt-check`. */
  slug: string;
  /** Dashboard module name shown as the kicker. */
  module: string;
  tone: ToneName;
  /** 3-line break for story, portrait and landscape. */
  tall: string[];
  /** 2-line break for square. */
  wide: string[];
  /** Lines from this index take the accent color. */
  accentTall: number;
  accentWide: number;
  sub: string;
  screenBg: string;
  screen: (frame: number, startAt: number) => ReactNode;
  /** Video body length in frames (before the end card). */
  video: number;
}

const SCREEN_AT = 34;

function FeatureBody({ spec, frame }: { spec: FeatureSpec; frame: number }) {
  const { kind, W, H, M, t } = useFrameCtx();
  const phoneIn = rise(frame, 10, 180, 40);
  const phone = (scale: number, x: number, y: number) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      <div style={phoneIn}>
        <Phone screen={spec.screenBg} shadowOn={t.bg}>
          {spec.screen(frame, SCREEN_AT)}
        </Phone>
      </div>
    </div>
  );
  const kicker = (style = {}) => (
    <Kicker style={{ ...reveal(frame, 0, 12), ...style }}>{spec.module}</Kicker>
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    const size = 116;
    const linesY = top + 150;
    const sc = 1.42;
    return (
      <>
        <Box
          x={M}
          y={top}
          w={W - M * 2}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Wordmark />
          <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>{SITE}</span>
        </Box>
        <Box x={M} y={top + 92}>
          {kicker()}
        </Box>
        <Box x={M} y={linesY}>
          <Lines
            lines={spec.tall}
            accentFrom={spec.accentTall}
            size={size}
            frame={frame}
            delay={4}
          />
        </Box>
        {phone(sc, (W - PHONE_W * sc) / 2, linesY + spec.tall.length * size + 96)}
      </>
    );
  }
  if (kind === 'portrait') {
    const sc = 1.22;
    return (
      <>
        <Box
          x={M}
          y={M}
          w={W - M * 2}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Wordmark />
          <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>{SITE}</span>
        </Box>
        <Box x={M} y={178}>
          {kicker()}
        </Box>
        <Box x={M} y={236}>
          <Lines
            lines={spec.tall}
            accentFrom={spec.accentTall}
            size={108}
            frame={frame}
            delay={4}
          />
        </Box>
        <Box x={M} y={630} w={372}>
          <Sub size={29} style={reveal(frame, 30)}>
            {spec.sub}
          </Sub>
        </Box>
        <Box x={M} y={H - M - 84} style={reveal(frame, 40)}>
          <Cta />
        </Box>
        {phone(sc, W - M - PHONE_W * sc + 34, 610)}
      </>
    );
  }
  if (kind === 'square') {
    const sc = 1.04;
    const size = 86;
    const linesY = M + 54;
    return (
      <>
        <Box x={M} y={M}>
          {kicker()}
        </Box>
        <Box x={M} y={linesY}>
          <Lines
            lines={spec.wide}
            accentFrom={spec.accentWide}
            size={size}
            frame={frame}
            delay={4}
          />
        </Box>
        <Box x={M} y={linesY + spec.wide.length * size + 44} w={420}>
          <Sub size={27} style={reveal(frame, 30)}>
            {spec.sub}
          </Sub>
        </Box>
        <Box x={M} y={H - M - 30}>
          <Wordmark />
        </Box>
        {phone(sc, W - M - PHONE_W * sc + 14, 410)}
      </>
    );
  }
  // landscape
  const sc = Math.min(1.36, (H * 1.12) / PHONE_H);
  const size = 120;
  const blockH = 60 + spec.tall.length * size + 36 + 130 + 48 + 84;
  const y0 = Math.max(M * 0.8, (H - blockH) / 2 + 10);
  return (
    <>
      <Box x={M} y={y0}>
        {kicker({ marginBottom: 34 })}
        <Lines lines={spec.tall} accentFrom={spec.accentTall} size={size} frame={frame} delay={4} />
        <Sub size={32} style={{ marginTop: 36, maxWidth: 700, ...reveal(frame, 30) }}>
          {spec.sub}
        </Sub>
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 34,
            ...reveal(frame, 40),
          }}
        >
          <Cta />
          <Wordmark size={28} />
        </div>
      </Box>
      {phone(sc, W - M - PHONE_W * sc - 60, Math.round(H * 0.11))}
    </>
  );
}

export function makeFeatureConcept(spec: FeatureSpec) {
  return function FeatureConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
    return (
      <Frame format={format} tone={spec.tone}>
        <FeatureBody spec={spec} frame={frame} />
      </Frame>
    );
  };
}
