import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, fit, Frame, Sub, useFrameCtx } from '../primitives';
import { overnight } from '../screens';
import { STORY_SAFE, type Format } from '../theme';
import { TopBar } from '../angles/shared';
import { timeline } from './poses';
import { KameAt, NoteCard, stagger } from './shared';

/**
 * 19 · Night shift. "You sleep. Kame works." Kame on the dark plane with a phone while the
 * overnight notifications (the same ones as the lock screen concept) stack up beside it.
 */

export const NIGHT_VIDEO = 190;
const LINES = ['You sleep.', 'Kame works.'];
const SUB = 'Receipts verified, approvals filed and guests briefed overnight.';
const NOTES = overnight.slice(0, 3);
const NOTE_AT = 46;
const NOTE_GAP = 28;

const kamePose = (frame: number) =>
  frame >= SETTLED
    ? timeline(0, [{ at: 0, name: 'hold', prop: 'phone' }])
    : timeline(frame, [
        { at: 0, name: 'hold', prop: 'phone' },
        {
          at: NOTE_AT + NOTE_GAP * 3 + 10,
          name: 'hold',
          prop: 'phone',
          with: { eyes: 'happy', open: 0.4 },
        },
      ]);

function Notes({
  frame,
  x,
  y,
  w,
  gap,
  scale,
}: {
  frame: number;
  x: number;
  y: number;
  w: number;
  gap: number;
  scale: number;
}) {
  return (
    <Box x={x} y={y} w={w} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {NOTES.map((n, i) => (
        <div key={n.title} style={stagger(frame, NOTE_AT, i, NOTE_GAP, 30)}>
          <NoteCard {...n} w={w} dark scale={scale} />
        </div>
      ))}
    </Box>
  );
}

function NightBody({ frame }: { frame: number }) {
  const { kind, W, H, M, hs } = useFrameCtx();
  const pose = kamePose(frame);
  const head = (size: number) => (
    <Lines lines={LINES} accentFrom={1} size={size} frame={frame} delay={4} />
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          {head(fit(LINES, 132, W - M * 2))}
        </Box>
        <Box x={M} y={top + 400} w={W - M * 2}>
          <Sub size={34} style={reveal(frame, 18)}>
            {SUB}
          </Sub>
        </Box>
        <Notes frame={frame} x={M} y={top + 540} w={W - M * 2} gap={18} scale={1.05} />
        <KameAt x={200} y={1150} w={680} h={760} pose={pose} frame={frame} delay={2} />
      </>
    );
  }

  if (kind === 'portrait' || kind === 'square') {
    const sq = kind === 'square';
    const kw = sq ? 420 : 470;
    const kh = sq ? 520 : 600;
    return (
      <>
        <TopBar />
        <Box x={M} y={M + 104}>
          {head(sq ? 100 : hs)}
        </Box>
        <Notes
          frame={frame}
          x={M}
          y={sq ? M + 350 : M + 400}
          w={sq ? 560 : 600}
          gap={16}
          scale={sq ? 0.86 : 0.92}
        />
        <KameAt x={W - kw + 10} y={H - kh - 10} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
        {sq ? null : (
          <Box x={M} y={H - M - 80} w={520}>
            <Sub size={28} style={reveal(frame, 18)}>
              {SUB}
            </Sub>
          </Box>
        )}
      </>
    );
  }

  const short = H < 1000;
  const kh = H - (short ? 50 : 90);
  const kw = 700;
  return (
    <>
      <TopBar y={short ? M * 0.6 : M} />
      <Box x={M} y={H * (short ? 0.26 : 0.28)}>
        {head(Math.round(hs * (short ? 0.74 : 0.82)))}
        <div style={{ width: 540, marginTop: 32 }}>
          <Sub size={short ? 26 : 30} style={reveal(frame, 18)}>
            {SUB}
          </Sub>
        </div>
      </Box>
      <Notes
        frame={frame}
        x={780}
        y={H * (short ? 0.2 : 0.24)}
        w={540}
        gap={short ? 12 : 18}
        scale={short ? 0.78 : 0.86}
      />
      <KameAt x={W - kw - 10} y={H - kh} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
    </>
  );
}

export function NightConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="night">
      <NightBody frame={frame} />
    </Frame>
  );
}
