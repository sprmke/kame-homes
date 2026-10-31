import type { ReactNode } from 'react';

import { Lines } from '../concepts';
import { Phone, PHONE_W } from '../device';
import { BookingFlowScreen } from '../features/bookingScreens';
import { BookingSiteScreen } from '../features/guestScreens';
import { MaintenanceScreen } from '../features/opsScreens';
import { DepositRefundScreen, StayGuideScreen } from '../features/stayScreens';
import { ease, reveal, rise, SETTLED } from '../motion';
import { Path, pathOnPaper } from '../path';
import { FinanceScreen } from '../screens';
import { Box, Frame, Kicker, Sub, useFrameCtx } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { TopBar } from './shared';

/**
 * 16 · Journey. The flagship walkthrough: one booking from the guest's first tap to income
 * recorded, six real screens, the Path advancing one stage per scene. Video only.
 */

const SCENE = 112;

interface Scene {
  stage: string;
  note: string;
  bg: string;
  screen: (frame: number, startAt: number) => ReactNode;
}

const scenes: Scene[] = [
  {
    stage: 'Booked.',
    note: 'The guest picks dates on your own booking site.',
    bg: c.white,
    screen: (f, s) => <BookingSiteScreen frame={f} startAt={s} />,
  },
  {
    stage: 'Documents.',
    note: 'Receipt checked and building approval filed for you.',
    bg: c.paper,
    screen: (f, s) => <BookingFlowScreen frame={f} startAt={s} />,
  },
  {
    stage: 'Check-in.',
    note: 'The stay guide goes out with everything they need.',
    bg: c.white,
    screen: (f, s) => <StayGuideScreen frame={f} startAt={s} />,
  },
  {
    stage: 'Check-out.',
    note: 'The turnover clean lands on the team schedule.',
    bg: c.paper,
    screen: (f, s) => <MaintenanceScreen frame={f} startAt={s} />,
  },
  {
    stage: 'Deposit.',
    note: 'Review, a voucher for next time and the refund form.',
    bg: c.paper,
    screen: (f, s) => <DepositRefundScreen frame={f} startAt={s} />,
  },
  {
    stage: 'Completed.',
    note: 'Income is recorded. Nothing slipped.',
    bg: c.paper,
    screen: (f, s) => <FinanceScreen frame={f} startAt={s} />,
  },
];

export const JOURNEY_VIDEO = SCENE * scenes.length + 20;

function PhoneStack({ frame, x, y, s }: { frame: number; x: number; y: number; s: number }) {
  const { t } = useFrameCtx();
  const i = Math.min(scenes.length - 1, Math.floor(frame / SCENE));
  const start = i * SCENE;
  const fade = i === 0 ? 1 : ease(frame, start, start + 10);
  const prev = scenes[i - 1];
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
      <div style={rise(frame, 4, 180, 40)}>
        <Phone screen={scenes[i].bg} shadowOn={t.bg}>
          {prev && fade < 1 ? (
            <div style={{ position: 'absolute', inset: 0 }}>
              {prev.screen(frame, start - SCENE + 8)}
            </div>
          ) : null}
          <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
            {scenes[i].screen(frame, start + 8)}
          </div>
        </Phone>
      </div>
    </div>
  );
}

function StageCopy({ frame, size, sub }: { frame: number; size: number; sub: number }) {
  const i = Math.min(scenes.length - 1, Math.floor(frame / SCENE));
  const local = frame - i * SCENE;
  return (
    <div key={i}>
      <Lines lines={[scenes[i].stage]} accentFrom={0} size={size} frame={local} />
      <Sub size={sub} style={{ marginTop: 22, maxWidth: 820, ...reveal(local, 8, 16, 16) }}>
        {scenes[i].note}
      </Sub>
    </div>
  );
}

function JourneyBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const f = frame >= SETTLED ? JOURNEY_VIDEO - 1 : frame;
  const active = Math.min(scenes.length - 1, Math.floor(f / SCENE));
  const span = W - M * 2;
  const nodes = scenes.map((_, i) => ({ at: M + 20 + (i * (span - 40)) / (scenes.length - 1) }));
  const path = (y: number, len = W, node = 40, list = nodes) => (
    <Path
      x={0}
      y={y}
      length={len}
      nodes={list}
      active={active}
      colors={pathOnPaper}
      node={node}
      frame={SETTLED}
    />
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    const s = 1.3;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 100}>
          <Kicker style={reveal(f, 0, 12)}>One booking, start to finish</Kicker>
        </Box>
        <Box x={M} y={top + 170}>
          <StageCopy frame={f} size={128} sub={34} />
        </Box>
        {path(top + 470)}
        <PhoneStack frame={f} x={(W - PHONE_W * s) / 2} y={top + 600} s={s} />
      </>
    );
  }
  // landscape: copy and path left, phone right
  const s = Math.min(1.12, (H * 1.05) / 878);
  const leftW = W - M * 2 - PHONE_W * s - 120;
  const lnodes = scenes.map((_, i) => ({ at: M + 20 + (i * (leftW - 40)) / (scenes.length - 1) }));
  return (
    <>
      <Box x={M} y={M}>
        <Kicker style={reveal(f, 0, 12)}>One booking, start to finish</Kicker>
      </Box>
      <Box x={M} y={Math.round(H * 0.27)}>
        <StageCopy frame={f} size={140} sub={34} />
      </Box>
      {path(Math.round(H * 0.74), M + leftW + 40, 40, lnodes)}
      <PhoneStack frame={f} x={W - M - PHONE_W * s} y={Math.round(H * 0.1)} s={s} />
    </>
  );
}

export function JourneyConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <JourneyBody frame={frame} />
    </Frame>
  );
}
