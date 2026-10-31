import { ArrowRight } from 'lucide-react';
import { AbsoluteFill } from 'remotion';

import { Lines } from '../concepts';
import { Phone, PHONE_W } from '../device';
import { reveal, rise, SETTLED } from '../motion';
import { Path, pathOnBrand, pathOnDark, pathOnPaper, type PathColors } from '../path';
import { useCopy } from '../copy';
import {
  Box,
  Cta,
  Diamond,
  fit,
  Frame,
  Kicker,
  SITE,
  Sub,
  useFrameCtx,
  Wordmark,
} from '../primitives';
import { c, STORY_SAFE, type Format, type Tone } from '../theme';
import { makeFeatureConcept, type FeatureSpec } from './concept';
import type { FeatureKit } from './kitCopy';

/**
 * Feature kit extras. Next to the product ad (concept.tsx), every module ships:
 * - Hook post: the pain as a big question, the answer in one line, the screen peeking in.
 * - How-it-works carousel: cover (hook) → three steps on a Path → end card with the phone.
 * - Reel: the hook question first (scroll-stopper), then the product ad, then the offer card.
 */

export type KitSpec = FeatureSpec & FeatureKit;

function PeekPhone({
  spec,
  x,
  y,
  s,
  frame,
}: {
  spec: KitSpec;
  x: number;
  y: number;
  s: number;
  frame: number;
}) {
  const { t } = useFrameCtx();
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${s})`,
        transformOrigin: '0 0',
      }}
    >
      <div style={rise(frame, 16, 180, 40)}>
        <Phone screen={spec.screenBg} shadowOn={t.bg}>
          {spec.screen(SETTLED, 0)}
        </Phone>
      </div>
    </div>
  );
}

function Answer({
  children,
  size,
  frame,
  delay = 30,
}: {
  children: string;
  size: number;
  frame: number;
  delay?: number;
}) {
  const { t } = useFrameCtx();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: size * 0.45,
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1.28,
        letterSpacing: '-0.025em',
        color: t.fg,
        textWrap: 'pretty',
        ...reveal(frame, delay),
      }}
    >
      <Diamond size={size * 0.42} color={t.mark} style={{ marginTop: size * 0.42 }} />
      <span>{children}</span>
    </div>
  );
}

function Swipe() {
  const { t } = useFrameCtx();
  const copy = useCopy();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 30,
        fontWeight: 700,
        color: t.fg,
      }}
    >
      {copy.swipe} <ArrowRight size={32} strokeWidth={2.6} />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Hook post
 * ------------------------------------------------------------------ */

function HookBody({
  spec,
  frame,
  variant = 'post',
}: {
  spec: KitSpec;
  frame: number;
  /** `cover` swaps the CTA for "Swipe"; `reel` drops the phone and CTA. */
  variant?: 'post' | 'cover' | 'reel';
}) {
  const { kind, W, H, M, t } = useFrameCtx();
  const copy = useCopy();
  const kicker = <Kicker style={reveal(frame, 0, 12)}>{spec.module}</Kicker>;
  const accentTall = spec.hook.length - 1;
  const accentWide = spec.hookWide.length - 1;

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    const size = fit(spec.hook, 150, W - M * 2);
    const linesY = top + 190;
    const ansY = linesY + spec.hook.length * size + 70;
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
        <Box x={M} y={top + 120}>
          {kicker}
        </Box>
        <Box x={M} y={linesY}>
          <Lines lines={spec.hook} accentFrom={accentTall} size={size} frame={frame} delay={4} />
        </Box>
        <Box x={M} y={ansY} w={W - M * 2 - 40}>
          <Answer size={46} frame={frame}>
            {spec.answer}
          </Answer>
        </Box>
        {variant === 'reel' ? null : (
          <>
            <Box x={M} y={STORY_SAFE.bottom - 90} style={reveal(frame, 40)}>
              <Cta size={1.1} />
            </Box>
            <PeekPhone
              spec={spec}
              x={W - M - PHONE_W * 1.3 + 40}
              y={STORY_SAFE.bottom + 40}
              s={1.3}
              frame={frame}
            />
          </>
        )}
      </>
    );
  }
  if (kind === 'portrait') {
    const size = fit(spec.hook, 122, W - M * 2);
    const linesY = 236;
    const ansY = linesY + spec.hook.length * size + 56;
    return (
      <>
        <Box
          x={M}
          y={M}
          w={W - M * 2}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Wordmark />
          <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>
            {variant === 'cover' ? copy.howItWorks : SITE}
          </span>
        </Box>
        <Box x={M} y={176}>
          {kicker}
        </Box>
        <Box x={M} y={linesY}>
          <Lines lines={spec.hook} accentFrom={accentTall} size={size} frame={frame} delay={4} />
        </Box>
        <Box x={M} y={ansY} w={W - M * 2 - 60}>
          <Answer size={38} frame={frame}>
            {spec.answer}
          </Answer>
        </Box>
        <Box x={M} y={H - M - (variant === 'cover' ? 40 : 84)} style={reveal(frame, 40)}>
          {variant === 'cover' ? <Swipe /> : <Cta />}
        </Box>
        <PeekPhone
          spec={spec}
          x={W - M - PHONE_W * 1.02 + 20}
          y={ansY + 150}
          s={1.02}
          frame={frame}
        />
      </>
    );
  }
  // square
  const size = fit(spec.hookWide, 96, W - M * 2);
  const linesY = M + 70;
  return (
    <>
      <Box
        x={M}
        y={M}
        w={W - M * 2}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        {kicker}
        <Wordmark />
      </Box>
      <Box x={M} y={linesY}>
        <Lines lines={spec.hookWide} accentFrom={accentWide} size={size} frame={frame} delay={4} />
      </Box>
      <Box x={M} y={linesY + spec.hookWide.length * size + 50} w={500}>
        <Answer size={34} frame={frame}>
          {spec.answer}
        </Answer>
      </Box>
      <Box x={M} y={H - M - 84} style={reveal(frame, 40)}>
        <Cta />
      </Box>
      <PeekPhone
        spec={spec}
        x={W - M - PHONE_W * 0.92 + 10}
        y={linesY + spec.hookWide.length * size + 40}
        s={0.92}
        frame={frame}
      />
    </>
  );
}

export function makeHookConcept(spec: KitSpec) {
  return function HookConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
    return (
      <Frame format={format} tone={spec.tone}>
        <HookBody spec={spec} frame={frame} />
      </Frame>
    );
  };
}

/* ------------------------------------------------------------------ *
 * How-it-works carousel
 * ------------------------------------------------------------------ */

export const KIT_SLIDES = 5;

function pathColors(t: Tone): PathColors {
  if (t.bg === c.brand) return pathOnBrand;
  if (t.dark) return { ...pathOnDark, bg: t.bg };
  return { ...pathOnPaper, bg: t.bg };
}

/** Balanced 1 or 2 line split for a short title. */
function splitTitle(title: string): string[] {
  if (title.length <= 12) return [title];
  const words = title.split(' ');
  let best = [title];
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < diff) {
      diff = d;
      best = [a, b];
    }
  }
  return best;
}

function StepBody({ spec, i }: { spec: KitSpec; i: number }) {
  const { W, H, M, t } = useFrameCtx();
  const copy = useCopy();
  const step = spec.steps[i];
  const Icon = step.icon;
  const brand = t.bg === c.brand;
  const tile = brand ? c.white : t.dark ? c.nightSurface : c.white;
  const ink = brand ? c.brandDeep : t.dark ? c.mint : c.brandDeep;
  const span = W - M * 2;
  const nodes = spec.steps.map((_, k) => ({ at: M + 20 + (k * (span - 40)) / 2 }));
  const pc = pathColors(t);
  const pathY = H - 250;
  const title = splitTitle(step.title);
  return (
    <>
      <Box
        x={M}
        y={M}
        w={W - M * 2}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Kicker>{spec.module}</Kicker>
        <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>{copy.stepOf(i + 1, 3)}</span>
      </Box>
      <Box x={M} y={250}>
        <span
          style={{
            width: 150,
            height: 150,
            borderRadius: 44,
            background: tile,
            border: brand || t.dark ? 'none' : `2px solid ${t.line}`,
            color: ink,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon size={68} strokeWidth={2} />
        </span>
      </Box>
      <Box x={M} y={490}>
        <Lines lines={title} accentFrom={title.length - 1} size={120} />
        <Sub size={38} style={{ marginTop: 40, maxWidth: 860 }}>
          {step.text}
        </Sub>
      </Box>
      <Path x={0} y={pathY} length={W} nodes={nodes} active={i} colors={pc} node={44} />
      {spec.steps.map((st, k) => (
        <Box
          key={st.title}
          x={k === 0 ? M : k === 1 ? W / 2 - 200 : W - M - 400}
          y={pathY + 46}
          w={400}
          style={{
            textAlign: k === 0 ? 'left' : k === 1 ? 'center' : 'right',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: k === i ? pc.label : pc.note,
            whiteSpace: 'nowrap',
          }}
        >
          {st.title}
        </Box>
      ))}
    </>
  );
}

function EndBody({ spec }: { spec: KitSpec }) {
  const { W, H, M, t } = useFrameCtx();
  const copy = useCopy();
  return (
    <>
      <Box x={M} y={M}>
        <Wordmark />
      </Box>
      <Box x={M} y={176}>
        <Kicker>{spec.module}</Kicker>
      </Box>
      <Box x={M} y={236}>
        <Lines lines={copy.tryFree} accentFrom={1} size={116} />
      </Box>
      <Box x={M} y={540} w={400}>
        <Sub size={29}>{spec.sub}</Sub>
      </Box>
      <Box x={M} y={H - M - 84 - 62} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>{SITE}</span>
        <Cta />
      </Box>
      <div
        style={{
          position: 'absolute',
          left: W - M - PHONE_W * 1.22 + 34,
          top: 560,
          transform: 'scale(1.22)',
          transformOrigin: '0 0',
        }}
      >
        <Phone screen={spec.screenBg} shadowOn={t.bg}>
          {spec.screen(SETTLED, 0)}
        </Phone>
      </div>
    </>
  );
}

export function makeKitSlide(spec: KitSpec) {
  return function KitSlide({ index, format }: { index: number; format: Format }) {
    const last = index === KIT_SLIDES - 1;
    // The closing slide flips to a contrasting plane so the carousel ends on the offer.
    const tone = last ? (spec.tone === 'brand' ? 'night' : 'brand') : spec.tone;
    return (
      <Frame format={format} tone={tone}>
        {index === 0 ? (
          <HookBody spec={spec} frame={SETTLED} variant="cover" />
        ) : index === KIT_SLIDES - 1 ? (
          <EndBody spec={spec} />
        ) : (
          <StepBody spec={spec} i={index - 1} />
        )}
      </Frame>
    );
  };
}

/* ------------------------------------------------------------------ *
 * Reel: hook first, then the product ad
 * ------------------------------------------------------------------ */

export const HOOK_FRAMES = 84;

export function makeReelConcept(spec: KitSpec) {
  const Ad = makeFeatureConcept(spec);
  return function ReelConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
    if (frame < HOOK_FRAMES) {
      return (
        <Frame format={format} tone={spec.tone}>
          <HookBody spec={spec} frame={frame} variant="reel" />
        </Frame>
      );
    }
    return (
      <AbsoluteFill>
        <Ad format={format} frame={frame - HOOK_FRAMES} />
      </AbsoluteFill>
    );
  };
}
