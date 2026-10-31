import { Lines } from '../concepts';
import { ease, maskUp, reveal, SETTLED } from '../motion';
import { Box, Frame, Kicker, Sub, useFrameCtx } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { TopBar } from './shared';

/**
 * 14 · Manifesto + kinetic reel. Type does all the work: the admin hosts never signed up
 * for, struck through, then the one thing that matters. The reel is the TikTok-native
 * version: hard cuts between flat planes, one phrase on screen at a time.
 */

export interface ManifestoCopy {
  kicker: string;
  /** Exactly four struck words (the reel timing assumes four). */
  chores: string[];
  big: string;
  sub: string;
  /** Kinetic reel beats. */
  open: string[];
  notFor: string;
  close: string[];
  closeAccent: number;
  outro: string;
}

export const manifestoEnglish: ManifestoCopy = {
  kicker: 'What you signed up for',
  chores: ['Receipts.', 'Screenshots.', 'GAF emails.', 'Spreadsheets.'],
  big: 'Guests.',
  sub: 'Kame Space handles the rest.',
  open: ['You started', 'hosting for', 'the guests.'],
  notFor: 'Not for',
  close: ['Kame Space', 'does the admin.'],
  closeAccent: 1,
  outro: 'You do the hosting.',
};

const CHORES = 4;

function Struck({ word, size, p }: { word: string; size: number; p: number }) {
  const { t } = useFrameCtx();
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          fontSize: size,
          fontWeight: 700,
          letterSpacing: '-0.045em',
          lineHeight: 1.04,
          color: t.sub,
          whiteSpace: 'nowrap',
        }}
      >
        {word}
      </span>
      <span
        style={{
          position: 'absolute',
          left: -6,
          top: '54%',
          height: Math.max(6, size * 0.07),
          width: `calc(${p * 100}% + 12px)`,
          background: c.coral,
          borderRadius: 6,
        }}
      />
    </div>
  );
}

function ManifestoBody({ copy }: { copy: ManifestoCopy }) {
  const { kind, W, H, M, t } = useFrameCtx();
  const vertical = kind === 'vertical';
  const size = vertical ? 124 : kind === 'portrait' ? 104 : 80;
  const big = vertical ? 230 : kind === 'portrait' ? 190 : 150;
  const top = vertical ? STORY_SAFE.top : M;
  return (
    <>
      {kind === 'square' ? null : <TopBar y={top} />}
      <Box x={M} y={kind === 'square' ? M : top + (vertical ? 130 : 110)}>
        <Kicker>{copy.kicker}</Kicker>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginTop: vertical ? 40 : 28,
          }}
        >
          {copy.chores.map((w) => (
            <Struck key={w} word={w} size={size} p={1} />
          ))}
        </div>
        <div
          style={{
            fontSize: big,
            fontWeight: 700,
            letterSpacing: '-0.055em',
            lineHeight: 1,
            color: t.accent,
            marginTop: vertical ? 30 : 18,
          }}
        >
          {copy.big}
        </div>
      </Box>
      <Box
        x={M}
        y={vertical ? STORY_SAFE.bottom - 60 : H - M - (kind === 'square' ? 40 : 90)}
        w={W - M * 2}
      >
        <Sub size={vertical ? 36 : 30}>{copy.sub}</Sub>
      </Box>
    </>
  );
}

export function makeManifestoConcept(copy: ManifestoCopy) {
  return function Manifesto({ format }: { format: Format; frame?: number }) {
    return (
      <Frame format={format} tone="night">
        <ManifestoBody copy={copy} />
      </Frame>
    );
  };
}

export const ManifestoConcept = makeManifestoConcept(manifestoEnglish);

/* ------------------------------------------------------------------ *
 * Kinetic reel
 * ------------------------------------------------------------------ */

const B = 74; // beat B start (paper)
const WORD = 22; // frames per chore word
const C = B + 16 + WORD * CHORES + 12; // beat C start (brand)
const D = C + 66; // beat D: last line
export const KINETIC_VIDEO = D + 70;

function KineticBody({ copy, frame }: { copy: ManifestoCopy; frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const vertical = kind === 'vertical';
  const s = vertical ? 150 : kind === 'landscape' ? 150 : 120;
  const y0 = vertical ? STORY_SAFE.top + 330 : kind === 'landscape' ? H * 0.28 : H * 0.22;

  if (frame < B) {
    return (
      <Box x={M} y={y0}>
        <Lines
          lines={copy.open}
          accentFrom={2}
          size={s}
          frame={frame}
          delay={4}
        />
      </Box>
    );
  }
  if (frame < C) {
    const f = frame - B;
    const i = Math.min(CHORES - 1, Math.max(0, Math.floor((f - 16) / WORD)));
    const local = f - 16 - i * WORD;
    return (
      <Box x={M} y={y0} w={W - M * 2}>
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontSize: s,
              fontWeight: 700,
              letterSpacing: '-0.045em',
              lineHeight: 1.04,
              ...maskUp(f, 0, 14),
            }}
          >
            {copy.notFor}
          </div>
        </div>
        <div style={{ overflow: 'hidden', paddingBottom: 20, marginTop: 4 }}>
          {f >= 16 ? (
            <div key={i} style={maskUp(local, 0, 8)}>
              <Struck word={copy.chores[i]} size={Math.min(s, Math.floor((W - M * 2) / (13 * 0.58)))} p={ease(local, 10, 18)} />
            </div>
          ) : null}
        </div>
      </Box>
    );
  }
  const f = frame - C;
  return (
    <Box x={M} y={y0}>
      <Lines
        lines={copy.close}
        accentFrom={copy.closeAccent}
        size={s * 0.92}
        frame={f}
        delay={2}
      />
      {frame >= D ? (
        <Sub size={vertical ? 64 : 52} style={{ marginTop: 50, ...reveal(frame - D, 0, 20) }}>
          {copy.outro}
        </Sub>
      ) : null}
    </Box>
  );
}

export function makeKineticConcept(copy: ManifestoCopy) {
  return function Kinetic({ format, frame = SETTLED }: { format: Format; frame?: number }) {
    const tone = frame < B ? 'night' : frame < C ? 'paper' : 'brand';
    return (
      <Frame format={format} tone={tone}>
        <KineticBody copy={copy} frame={frame} />
      </Frame>
    );
  };
}

export const KineticConcept = makeKineticConcept(manifestoEnglish);
