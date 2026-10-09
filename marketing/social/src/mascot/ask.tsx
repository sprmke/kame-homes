import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, fit, Frame, Sub, useFrameCtx } from '../primitives';
import { STORY_SAFE, type Format } from '../theme';
import { TopBar } from '../angles/shared';
import { timeline } from './poses';
import { Bubble, KameAt, Speaker, stagger } from './shared';

/**
 * 20 · Ask Kame. The AI receptionist is Kame (the live receptionist uses the turtle as
 * its avatar), so this is product truth: a guest asks, Kame answers from the house guide.
 */

export const ASK_VIDEO = 200;
const LINES = ['Guests ask.', 'Kame answers.'];
const SUB = 'Parking, check-in and house rules, answered from your house guide at any hour.';

const CHAT: { from: 'guest' | 'kame'; text: string; at: number }[] = [
  { from: 'guest', text: 'Hi! Where do I park when we arrive?', at: 30 },
  { from: 'kame', text: 'Guest parking is on B2, slot 41. Show the guard your booking code.', at: 70 },
  { from: 'guest', text: 'And what time is check-in?', at: 118 },
  { from: 'kame', text: 'From 2 PM. Your door code arrives the morning of your stay.', at: 150 },
];

const kamePose = (frame: number) =>
  frame >= SETTLED
    ? // frame 13 lands mid-syllable with eyes open, so the still shows Kame speaking
      timeline(13, [{ at: 0, name: 'talk' }])
    : timeline(frame, [
        { at: 0, name: 'idle' },
        { at: 64, name: 'talk' },
        { at: 112, name: 'idle', with: { headYaw: -8 } },
        { at: 146, name: 'talk' },
        { at: 196, name: 'idle', with: { eyes: 'happy' } },
      ]);

function Chat({
  frame,
  x,
  y,
  w,
  scale,
  count = 4,
}: {
  frame: number;
  x: number;
  y: number;
  w: number;
  scale: number;
  count?: number;
}) {
  return (
    <Box x={x} y={y} w={w} style={{ display: 'flex', flexDirection: 'column', gap: 22 * scale }}>
      {CHAT.slice(0, count).map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: m.from === 'kame' ? 'flex-end' : 'flex-start',
            ...(frame >= SETTLED ? {} : stagger(frame, m.at, 0, 0, 20)),
          }}
        >
          <Speaker kame={m.from === 'kame'} scale={scale}>
            {m.from === 'kame' ? 'Kame' : 'Guest'}
          </Speaker>
          <Bubble from={m.from} w={w * 0.82} scale={scale}>
            {m.text}
          </Bubble>
        </div>
      ))}
    </Box>
  );
}

function AskBody({ frame }: { frame: number }) {
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
        <Chat frame={frame} x={M} y={top + 510} w={W - M * 2} scale={0.98} />
        <KameAt x={300} y={1400} w={480} h={510} pose={pose} frame={frame} delay={2} />
      </>
    );
  }

  if (kind === 'portrait') {
    const kw = 420;
    const kh = 540;
    return (
      <>
        <TopBar />
        <Box x={M} y={M + 104}>{head(fit(LINES, hs, W - M * 2))}</Box>
        <Chat frame={frame} x={M} y={M + 380} w={620} scale={0.86} />
        <KameAt x={W - kw + 10} y={H - kh - 10} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
        <Box x={M} y={H - M - 76} w={560}>
          <Sub size={26} style={reveal(frame, 18)}>{SUB}</Sub>
        </Box>
      </>
    );
  }

  if (kind === 'square') {
    const kw = 400;
    const kh = 480;
    return (
      <>
        <TopBar />
        <Box x={M} y={M + 104}>{head(fit(LINES, 100, W - M * 2))}</Box>
        <Chat frame={frame} x={M} y={M + 340} w={W - M * 2} scale={0.86} count={2} />
        <KameAt x={W - kw} y={H - kh} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
        <Box x={M} y={H - M - 76} w={520}>
          <Sub size={26} style={reveal(frame, 18)}>{SUB}</Sub>
        </Box>
      </>
    );
  }

  const short = H < 1000;
  const kh = H - (short ? 50 : 90);
  const kw = 600;
  return (
    <>
      <TopBar y={short ? M * 0.6 : M} />
      <Box x={M} y={H * (short ? 0.26 : 0.28)}>
        {head(Math.round(hs * (short ? 0.68 : 0.74)))}
        <div style={{ width: 540, marginTop: 32 }}>
          <Sub size={short ? 26 : 30} style={reveal(frame, 18)}>
            {SUB}
          </Sub>
        </div>
      </Box>
      <Chat
        frame={frame}
        x={790}
        y={H * (short ? 0.16 : 0.2)}
        w={560}
        scale={short ? 0.74 : 0.84}
      />
      <KameAt x={W - kw - 30} y={H - kh} w={kw} h={kh} pose={pose} frame={frame} delay={2} />
    </>
  );
}

export function AskConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="white">
      <AskBody frame={frame} />
    </Frame>
  );
}
