import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Path, pathOnPaper, STAGES } from '../path';
import { Box, fit, Frame, Sub, useFrameCtx } from '../primitives';
import { STORY_SAFE, type Format } from '../theme';
import { TopBar } from '../angles/shared';
import { timeline } from './poses';
import { KameAt } from './shared';

/**
 * 18 · Kame carries the admin. The brand line ("a turtle carries its home") on the brand
 * device: Kame stands on the Path at check-in, with the steps behind it done. Narrow
 * formats crop the Path to three stages and let it bleed off both edges.
 */

export const CARRY_VIDEO = 170;
const LINES = ['Kame carries', 'the admin.'];
const SUB = 'Every booking takes the same six steps. Kame moves each one forward so nothing slips.';
/** Kame's stage on the Path (Check-in). */
const AT = 2;

const kamePose = (frame: number) =>
  frame >= SETTLED
    ? timeline(0, [{ at: 0, name: 'proud' }])
    : timeline(
        frame,
        [
          { at: 0, name: 'idle' },
          { at: 70, name: 'proud' },
        ],
        { hopOnChange: true }
      );

/**
 * The Path with Kame standing on node `AT`. `xs` maps visible stages to x positions
 * (relative to the line start at `lineX`); Kame's feet land on the line.
 */
function PathWithKame({
  frame,
  y,
  lineX,
  length,
  stages,
  xs,
  kameH,
  labelSize,
  node,
}: {
  frame: number;
  y: number;
  lineX: number;
  length: number;
  stages: number[];
  xs: number[];
  kameH: number;
  labelSize: number;
  node: number;
}) {
  const kx = lineX + xs[stages.indexOf(AT)];
  const kw = kameH * 0.9;
  // The fit box puts Kame's feet ~9% above its bottom edge.
  const feet = 0.91;
  return (
    <>
      <Path
        x={lineX}
        y={y}
        length={length}
        nodes={stages.map((s, i) => ({ at: xs[i], label: STAGES[s].label, note: STAGES[s].note }))}
        active={stages.indexOf(AT)}
        colors={pathOnPaper}
        thickness={12}
        node={node}
        labelSize={labelSize}
        frame={frame}
        startAt={20}
        step={16}
        fillFrom={0}
      />
      <KameAt
        x={kx - kw / 2}
        y={y - kameH * feet}
        w={kw}
        h={kameH}
        pose={kamePose(frame)}
        frame={frame}
        delay={40}
      />
    </>
  );
}

function CarryBody({ frame }: { frame: number }) {
  const { kind, W, H, M, hs } = useFrameCtx();
  const head = (size: number) => (
    <Lines lines={LINES} accentFrom={1} size={size} frame={frame} delay={4} />
  );

  if (kind === 'landscape') {
    const short = H < 1000;
    const lineY = Math.round(H * (short ? 0.76 : 0.78));
    const span = W - M * 2 - 160;
    const xs = STAGES.map((_, i) => M + 40 + (span * i) / (STAGES.length - 1));
    return (
      <>
        <TopBar y={short ? M * 0.6 : M} />
        <Box x={M} y={short ? H * 0.17 : H * 0.18}>
          {head(Math.round(hs * (short ? 0.82 : 0.9)))}
        </Box>
        <Box x={W * 0.55} y={short ? H * 0.2 : H * 0.22} w={W * 0.45 - M}>
          <Sub size={short ? 28 : 32} style={reveal(frame, 18)}>
            {SUB}
          </Sub>
        </Box>
        <PathWithKame
          frame={frame}
          y={lineY}
          lineX={-40}
          length={W + 80}
          stages={[0, 1, 2, 3, 4, 5]}
          xs={xs.map((x) => x + 40)}
          kameH={short ? 470 : 560}
          labelSize={short ? 26 : 30}
          node={short ? 40 : 46}
        />
      </>
    );
  }

  // Narrow formats: three stages, the Path bleeds off both edges.
  // Absolute node x: 90, 470, 850 on a 1080 canvas, so the last note never clips.
  const xs = [0.083, 0.435, 0.787].map((f) => W * f + 60);
  const vertical = kind === 'vertical';
  const top = vertical ? STORY_SAFE.top : M;
  const size = vertical ? fit(LINES, 132, W - M * 2) : kind === 'portrait' ? hs : 100;
  const lineY = vertical ? 1330 : kind === 'portrait' ? H - 230 : H - 200;
  const kameH = vertical ? 720 : kind === 'portrait' ? 580 : 450;
  return (
    <>
      <TopBar y={top} />
      <Box x={M} y={top + (vertical ? 110 : 104)}>
        {head(size)}
      </Box>
      <Box x={M} y={top + (vertical ? 400 : kind === 'portrait' ? 360 : 320)} w={W - M * 2}>
        <Sub size={vertical ? 34 : 30} style={reveal(frame, 18)}>
          {SUB}
        </Sub>
      </Box>
      <PathWithKame
        frame={frame}
        y={lineY}
        lineX={-60}
        length={W + 120}
        stages={[1, 2, 3]}
        xs={xs}
        kameH={kameH}
        labelSize={vertical ? 34 : 30}
        node={vertical ? 52 : 46}
      />
    </>
  );
}

export function CarryConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <CarryBody frame={frame} />
    </Frame>
  );
}
