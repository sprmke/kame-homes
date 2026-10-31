import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, Diamond, fit, Frame, useFrameCtx } from '../primitives';
import { STORY_SAFE, type Format } from '../theme';
import { TopBar } from '../angles/shared';
import type { Prop } from './Kame';
import { pose, type PoseName } from './poses';
import { KameAt } from './shared';

/**
 * 21 · One turtle, every job. A character lineup: five poses, each one a real module.
 * The format borrows the mascot "sticker sheet" that big consumer brands post, but every
 * pose is tied to product truth.
 */

export const CREW_VIDEO = 160;
const LINES = ['One turtle.', 'Every job.'];

export const JOBS: { name: PoseName; prop: Prop; title: string; module: string }[] = [
  { name: 'wave', prop: 'none', title: 'Greets guests', module: 'AI receptionist' },
  { name: 'show', prop: 'receipt', title: 'Checks receipts', module: 'AI receipt check' },
  { name: 'show', prop: 'key', title: 'Sends check-in info', module: 'Stay guide' },
  { name: 'hold', prop: 'phone', title: 'Pings your team', module: 'Telegram alerts' },
  { name: 'show', prop: 'coin', title: 'Tracks your profit', module: 'Finance' },
];

function Job({
  i,
  x,
  y,
  w,
  kh,
  size,
  frame,
}: {
  i: number;
  x: number;
  y: number;
  w: number;
  kh: number;
  size: number;
  frame: number;
}) {
  const { t } = useFrameCtx();
  const j = JOBS[i];
  const delay = 12 + i * 10;
  return (
    <>
      <KameAt
        x={x}
        y={y}
        w={w}
        h={kh}
        pose={pose(j.name, frame, { prop: j.prop, seed: i + 1, still: frame >= SETTLED })}
        frame={frame}
        delay={delay}
      />
      <Box
        x={x}
        y={y + kh + 6}
        w={w}
        style={{ textAlign: 'center', ...reveal(frame, delay + 10, 14) }}
      >
        <div
          style={{
            fontSize: size,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
          }}
        >
          {j.title}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: size * 0.3,
            marginTop: size * 0.25,
            fontSize: size * 0.72,
            fontWeight: 600,
            color: t.sub,
            whiteSpace: 'nowrap',
          }}
        >
          <Diamond size={size * 0.34} color={t.mark} />
          {j.module}
        </div>
      </Box>
    </>
  );
}

/** Lay out the five jobs as rows of `perRow` (centered), starting at `y`. */
function Grid({
  frame,
  y,
  perRow,
  cw,
  kh,
  rowH,
  size,
}: {
  frame: number;
  y: number;
  perRow: number[];
  cw: number;
  kh: number;
  rowH: number;
  size: number;
}) {
  const { W } = useFrameCtx();
  let i = 0;
  return (
    <>
      {perRow.map((n, r) => {
        const x0 = (W - n * cw) / 2;
        return Array.from({ length: n }, (_, k) => {
          const idx = i++;
          return (
            <Job
              key={idx}
              i={idx}
              x={x0 + k * cw}
              y={y + r * rowH}
              w={cw}
              kh={kh}
              size={size}
              frame={frame}
            />
          );
        });
      })}
    </>
  );
}

function CrewBody({ frame }: { frame: number }) {
  const { kind, W, H, M, hs } = useFrameCtx();
  const head = (size: number) => (
    <Lines lines={LINES} accentFrom={1} size={size} frame={frame} delay={2} />
  );

  if (kind === 'landscape') {
    const short = H < 1000;
    const cw = (W - M * 2) / 5;
    // Box aspect close to the character's, so labels sit right under the feet.
    const kh = Math.round(cw * 1.08);
    return (
      <>
        <TopBar y={short ? M * 0.6 : M} />
        <Box x={M} y={short ? 150 : 200}>
          {head(Math.round(hs * (short ? 0.72 : 0.8)))}
        </Box>
        <Grid
          frame={frame}
          y={H - kh - (short ? 110 : 140)}
          perRow={[5]}
          cw={cw}
          kh={kh}
          rowH={0}
          size={short ? 30 : 34}
        />
      </>
    );
  }

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          {head(fit(LINES, 132, W - M * 2))}
        </Box>
        <Grid frame={frame} y={top + 380} perRow={[2, 3]} cw={330} kh={290} rowH={380} size={30} />
      </>
    );
  }

  const sq = kind === 'square';
  return (
    <>
      <TopBar />
      <Box x={M} y={M + 100}>
        {head(sq ? 96 : hs)}
      </Box>
      <Grid
        frame={frame}
        y={sq ? M + 300 : M + 350}
        perRow={[2, 3]}
        cw={sq ? 300 : 320}
        kh={sq ? 250 : 320}
        rowH={sq ? 340 : 440}
        size={sq ? 27 : 30}
      />
    </>
  );
}

export function CrewConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="sand">
      <CrewBody frame={frame} />
    </Frame>
  );
}
