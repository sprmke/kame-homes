import { ArrowRight } from 'lucide-react';

import { Lines } from '../concepts';
import { useCopy } from '../copy';
import { featureSpecs } from '../features/registry';
import { SETTLED } from '../motion';
import { Box, Cta, fit, Frame, Kicker, Sub, useFrameCtx } from '../primitives';
import type { Format, ToneName } from '../theme';
import { PhoneAt, TopBar } from '../angles/shared';
import { JOBS } from './crew';
import { pose } from './poses';
import { KameAt } from './shared';

/**
 * 22 · Meet Kame carousel (portrait 4:5). Cover, one slide per job (Kame with the prop on
 * the left, the module's real screen on the right), then a close. The jobs and their
 * modules are the same as the crew lineup (21), so the two posts read as one series.
 */

const SLIDES: { slug: string; lines: string[]; sub: string }[] = [
  {
    slug: '05-ai-receptionist',
    lines: ['Kame greets', 'your guests.'],
    sub: 'Parking, check-in and house rules, answered from your house guide at any hour.',
  },
  {
    slug: '02-receipt-check',
    lines: ['Kame checks', 'every receipt.'],
    sub: 'Amount, reference and date are matched to the booking. Anything off waits for you.',
  },
  {
    slug: '13-stay-guide',
    lines: ['Kame sends', 'check-in info.'],
    sub: 'Door code, Wi-Fi, parking and house rules go out when the stay is ready.',
  },
  {
    slug: '11-telegram-alerts',
    lines: ['Kame pings', 'your team.'],
    sub: 'New bookings, guest messages and maintenance go to the right Telegram group.',
  },
  {
    slug: '17-finance',
    lines: ['Kame tracks', 'your profit.'],
    sub: 'Every paid booking is recorded. Add expenses and see what is left.',
  },
];

export const MEET_SLIDES = SLIDES.length + 2;

function SwipePill() {
  const { t } = useFrameCtx();
  const copy = useCopy();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        height: 84,
        padding: '0 38px',
        borderRadius: 999,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        background: t.fg,
        color: t.bg,
      }}
    >
      {copy.swipe} <ArrowRight size={32} strokeWidth={2.6} />
    </span>
  );
}

function Cover() {
  const { W, H, M } = useFrameCtx();
  const lines = ['Five jobs', 'Kame takes', 'off your plate.'];
  return (
    <>
      <TopBar />
      <Box x={M} y={M + 104}>
        <Kicker>Meet Kame</Kicker>
      </Box>
      <Box x={M} y={M + 160}>
        <Lines lines={lines} accentFrom={1} size={fit(lines, 116, W - M * 2)} />
      </Box>
      <Box x={M} y={H - M - 84}>
        <SwipePill />
      </Box>
      <KameAt
        x={W - 640}
        y={H - 740}
        w={640}
        h={740}
        pose={pose('wave', SETTLED, { still: true })}
      />
    </>
  );
}

function Job({ index }: { index: number }) {
  const { W, H, M } = useFrameCtx();
  const s = SLIDES[index];
  const spec = featureSpecs.find((f) => f.slug === s.slug)!;
  const job = JOBS[index];
  return (
    <>
      <TopBar right={`${index + 1} / ${SLIDES.length}`} />
      <Box x={M} y={M + 104}>
        <Kicker>{spec.module}</Kicker>
      </Box>
      <Box x={M} y={M + 160}>
        <Lines lines={s.lines} accentFrom={1} size={fit(s.lines, 112, W - M * 2)} />
      </Box>
      <Box x={M} y={M + 410} w={W - M * 2}>
        <Sub size={30}>{s.sub}</Sub>
      </Box>
      <PhoneAt
        x={W - 419 - 70}
        y={690}
        scale={1}
        frame={SETTLED}
        screenBg={spec.screenBg}
        screen={spec.screen(SETTLED, 0)}
      />
      <KameAt
        x={10}
        y={H - 600}
        w={520}
        h={600}
        pose={pose(job.name, SETTLED, {
          prop: job.prop,
          seed: index + 1,
          still: true,
          with: { yaw: 42, headYaw: 6 },
        })}
      />
    </>
  );
}

function Close() {
  const { W, H, M } = useFrameCtx();
  const lines = ['Let Kame', 'take it', 'from here.'];
  return (
    <>
      <TopBar />
      <Box x={M} y={M + 120}>
        <Lines lines={lines} accentFrom={1} size={fit(lines, 116, W - M * 2)} />
      </Box>
      <Box x={M} y={H - M - 84}>
        <Cta />
      </Box>
      <KameAt
        x={W - 620}
        y={H - 700}
        w={620}
        h={700}
        pose={pose('cheer', SETTLED, { still: true })}
      />
    </>
  );
}

export function MeetSlide({ index, format }: { index: number; format: Format }) {
  const last = MEET_SLIDES - 1;
  const tone: ToneName = index === 0 || index === last ? 'sand' : 'paper';
  return (
    <Frame format={format} tone={tone}>
      {index === 0 ? <Cover /> : index === last ? <Close /> : <Job index={index - 1} />}
    </Frame>
  );
}
