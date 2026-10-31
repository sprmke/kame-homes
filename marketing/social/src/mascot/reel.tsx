import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, Diamond, fit, Frame, useFrameCtx } from '../primitives';
import { STORY_SAFE, type Format } from '../theme';
import { TopBar } from '../angles/shared';
import type { Prop } from './Kame';
import { timeline, type Beat, type PoseName } from './poses';
import { KameAt } from './shared';

/**
 * 23 · Kame reel. One continuous Kame on the sand plane; every beat it switches job (pose,
 * prop, line of copy, module chip) with a small hop, like a character changing hats.
 * Problem first, then five jobs, then the payoff. Video only (story, square).
 */

const BEATS: { at: number; name: PoseName; prop?: Prop; lines: string[]; module?: string }[] = [
  { at: 0, name: 'idle', lines: ['Hosting is', 'a lot of admin.'] },
  { at: 66, name: 'wave', lines: ["Hi, I'm Kame.", "I'll take it."] },
  {
    at: 126,
    name: 'show',
    prop: 'receipt',
    lines: ['I check', 'every receipt.'],
    module: 'AI receipt check',
  },
  { at: 178, name: 'talk', lines: ['I answer', 'your guests.'], module: 'AI receptionist' },
  { at: 230, name: 'show', prop: 'key', lines: ['I send', 'check-in info.'], module: 'Stay guide' },
  {
    at: 282,
    name: 'hold',
    prop: 'phone',
    lines: ['I ping', 'your team.'],
    module: 'Telegram alerts',
  },
  { at: 334, name: 'show', prop: 'coin', lines: ['I track', 'your profit.'], module: 'Finance' },
  { at: 386, name: 'cheer', lines: ['You keep', 'the guests.'] },
];

export const REEL_VIDEO = 456;

const beatAt = (frame: number) => {
  let i = 0;
  while (i < BEATS.length - 1 && frame >= BEATS[i + 1].at) i++;
  return i;
};

const kameBeats: Beat[] = BEATS.map((b) => ({ at: b.at, name: b.name, prop: b.prop }));

function Chip({ children }: { children: string }) {
  const { t } = useFrameCtx();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        height: 64,
        padding: '0 28px',
        borderRadius: 99,
        background: t.surface,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: t.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <Diamond size={14} color={t.mark} />
      {children}
    </span>
  );
}

function ReelBody({ frame: raw }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  // A still of the reel shows the receipt beat.
  const frame = raw >= SETTLED ? BEATS[2].at + 40 : raw;
  const i = beatAt(frame);
  const b = BEATS[i];
  const local = frame - b.at;
  const pose = timeline(frame, kameBeats, { blend: 10, hopOnChange: true });

  const text = (x: number, y: number, size: number) => (
    <Box x={x} y={y} key={i}>
      <Lines lines={b.lines} accentFrom={1} size={size} frame={local} delay={0} />
      {b.module ? (
        <div style={{ marginTop: size * 0.42, ...reveal(local, 8, 16) }}>
          <Chip>{b.module}</Chip>
        </div>
      ) : null}
    </Box>
  );
  const allLines = BEATS.flatMap((x) => x.lines);

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        {text(M, top + 110, fit(allLines, 132, W - M * 2))}
        <KameAt x={40} y={760} w={W - 80} h={1080} pose={pose} frame={raw} delay={0} dur={20} />
      </>
    );
  }

  // square
  return (
    <>
      <TopBar />
      {text(M, M + 104, fit(allLines, 96, W - M * 2))}
      <KameAt x={W - 600} y={H - 640} w={600} h={640} pose={pose} frame={raw} delay={0} dur={20} />
    </>
  );
}

export function ReelConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="sand">
      <ReelBody frame={frame} />
    </Frame>
  );
}
