import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, Cta, fit, Frame, Sub, useFrameCtx } from '../primitives';
import { STORY_SAFE, type Format } from '../theme';
import { TopBar } from '../angles/shared';
import { timeline } from './poses';
import { KameAt } from './shared';

/**
 * 17 · Meet Kame. The mascot introduces itself and its job in one line. Kame waves in,
 * then settles into a proud stance. Sand plane: Kame's own warm world.
 */

export const MEET_VIDEO = 150;
const LINES = ["Hi, I'm Kame.", 'I do the admin.'];
const SUB = 'Bookings, receipts, building approvals and guest questions, handled while you host.';

const kamePose = (frame: number) =>
  frame >= SETTLED
    ? timeline(0, [{ at: 0, name: 'wave' }])
    : timeline(frame, [
        { at: 0, name: 'idle' },
        { at: 16, name: 'wave' },
        { at: 112, name: 'proud', with: { eyes: 'happy' } },
      ]);

function MeetBody({ frame }: { frame: number }) {
  const { kind, W, H, M, hs } = useFrameCtx();
  const pose = kamePose(frame);
  const head = (size: number) => (
    <Lines lines={LINES} accentFrom={1} size={size} frame={frame} delay={10} />
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          {head(fit(LINES, 132, W - M * 2))}
        </Box>
        <Box x={M} y={top + 380} w={W - M * 2}>
          <Sub size={34} style={reveal(frame, 26)}>
            {SUB}
          </Sub>
        </Box>
        <Box x={M} y={top + 540} style={reveal(frame, 34)}>
          <Cta />
        </Box>
        <KameAt
          x={20}
          y={top + 650}
          w={W - 40}
          h={H - (top + 650) - 40}
          pose={pose}
          frame={frame}
          delay={2}
        />
      </>
    );
  }

  if (kind === 'portrait') {
    const kw = 640;
    const kh = 820;
    return (
      <>
        <TopBar />
        <Box x={M} y={M + 120}>
          {head(fit(LINES, hs, W - M * 2))}
        </Box>
        <Box x={M} y={M + 390} w={430}>
          <Sub size={30} style={reveal(frame, 26)}>
            {SUB}
          </Sub>
        </Box>
        <Box x={M} y={H - M - 84} style={reveal(frame, 34)}>
          <Cta />
        </Box>
        <KameAt x={W - kw + 30} y={H - kh - 10} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
      </>
    );
  }

  if (kind === 'square') {
    const kw = 560;
    const kh = 640;
    return (
      <>
        <TopBar />
        <Box x={M} y={M + 104}>
          {head(fit(LINES, 100, W - M * 2))}
        </Box>
        <Box x={M} y={M + 330} w={420}>
          <Sub size={28} style={reveal(frame, 26)}>
            {SUB}
          </Sub>
        </Box>
        <Box x={M} y={H - M - 84} style={reveal(frame, 34)}>
          <Cta />
        </Box>
        <KameAt x={W - kw + 20} y={H - kh} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
      </>
    );
  }

  // landscape, link, email: copy left, Kame right.
  const short = H < 1000;
  const kh = H - (short ? 40 : 90);
  const kw = Math.round(kh * 0.95);
  return (
    <>
      <TopBar y={short ? M * 0.6 : M} />
      <Box x={M} y={short ? H * 0.25 : H * 0.27}>
        {head(Math.round(hs * (short ? 1.0 : 1.02)))}
        <div style={{ width: 760, marginTop: short ? 30 : 44 }}>
          <Sub size={short ? 30 : 34} style={reveal(frame, 26)}>
            {SUB}
          </Sub>
        </div>
        <div style={{ marginTop: short ? 34 : 52, ...reveal(frame, 34) }}>
          <Cta />
        </div>
      </Box>
      <KameAt
        x={W - kw - (short ? 70 : 110)}
        y={H - kh}
        w={kw}
        h={kh}
        pose={pose}
        frame={frame}
        delay={2}
      />
    </>
  );
}

export function MeetConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="sand">
      <MeetBody frame={frame} />
    </Frame>
  );
}
