import { ArrowRight } from 'lucide-react';

import { Lines } from '../concepts';
import { SETTLED } from '../motion';
import { Path, pathOnBrand } from '../path';
import { Box, Cta, Diamond, Frame, Kicker, SITE, Sub, useFrameCtx, Wordmark } from '../primitives';
import { c, type Format } from '../theme';

/**
 * 13 · Checklist carousel. Educational, save-worthy: five things every guest needs before
 * check-in, each with how Kame Space covers it. Cover and end on brand, tips on paper.
 * Value first, product second, so the post earns saves and shares, not only impressions.
 */

const tips = [
  {
    lines: ['Dates and total,', 'in writing.'],
    why: 'A confirmation they can screenshot ends most "how much again?" messages.',
    kame: 'Approve the booking and the confirmation email goes out with the dates and total.',
  },
  {
    lines: ['Building approval,', 'sorted early.'],
    why: 'Condo admins want the guest form before arrival. A late form means a guest stuck in the lobby.',
    kame: 'Kame fills in the GAF for the building and files the approval reply to the booking.',
  },
  {
    lines: ['Parking,', 'down to the slot.'],
    why: 'Level, slot number and what to show the guard at the ramp.',
    kame: "Parking rides on the booking, and the slot shows up in the guest's stay guide.",
  },
  {
    lines: ['Check-in steps', 'and house rules.'],
    why: 'One link they can open in the lobby beats twenty messages to scroll through.',
    kame: 'A stay guide link goes out when the booking is ready for check-in.',
  },
  {
    lines: ['How the deposit', 'comes back.'],
    why: 'Say when and how before they ask. It sets the tone for the review.',
    kame: 'After checkout, guests get a refund form: GCash, bank or cash pickup.',
  },
];

export const CHECKLIST_SLIDES = tips.length + 2;

function Progress({ at }: { at: number }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      {tips.map((_, i) => (
        <span
          key={i}
          style={{
            width: 18,
            height: 18,
            transform: 'rotate(45deg)',
            borderRadius: 4,
            boxSizing: 'border-box',
            background: i <= at ? c.brand : 'transparent',
            border: `3px solid ${i <= at ? c.brand : c.line}`,
          }}
        />
      ))}
    </div>
  );
}

function TipBody({ i }: { i: number }) {
  const { W, H, M, t } = useFrameCtx();
  const tip = tips[i];
  return (
    <>
      <Box
        x={M}
        y={M}
        w={W - M * 2}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Kicker>Before check-in</Kicker>
        <Progress at={i} />
      </Box>
      <Box x={M - 8} y={170}>
        <div
          style={{
            fontSize: 300,
            fontWeight: 800,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            color: t.accent,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(i + 1).padStart(2, '0')}
        </div>
      </Box>
      <Box x={M} y={500}>
        <Lines lines={tip.lines} size={92} />
        <Sub size={35} style={{ marginTop: 40, maxWidth: 880 }}>
          {tip.why}
        </Sub>
      </Box>
      <Box
        x={M}
        y={0}
        w={W - M * 2}
        style={{
          top: 'auto',
          bottom: M,
          borderRadius: 36,
          background: c.white,
          border: `2px solid ${t.line}`,
          padding: '34px 40px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 24,
            fontWeight: 700,
            color: c.brandDeep,
          }}
        >
          <Diamond size={14} color={c.brand} /> In Kame Space
        </div>
        <div
          style={{
            fontSize: 33,
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            marginTop: 16,
            textWrap: 'pretty',
          }}
        >
          {tip.kame}
        </div>
      </Box>
    </>
  );
}

function trackNodes(W: number, M: number) {
  const span = W - M * 2;
  return tips.map((_, k) => ({ at: M + 20 + (k * (span - 40)) / (tips.length - 1) }));
}

function CoverBody() {
  const { W, H, M, t } = useFrameCtx();
  return (
    <>
      <Box
        x={M}
        y={M}
        w={W - M * 2}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Wordmark />
        <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>Save for later</span>
      </Box>
      <Box x={M} y={200}>
        <Kicker>For condo hosts</Kicker>
        <Lines
          lines={['5 things', 'every guest', 'needs before', 'check-in.']}
          accentFrom={3}
          size={124}
          style={{ marginTop: 34 }}
        />
      </Box>
      <Path
        x={0}
        y={1020}
        length={W}
        nodes={trackNodes(W, M)}
        active={0}
        colors={pathOnBrand}
        node={44}
      />
      <Box
        x={M}
        y={H - M - 40}
        w={W - M * 2}
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          fontSize: 30,
          fontWeight: 700,
          color: t.fg,
        }}
      >
        Swipe <ArrowRight size={32} strokeWidth={2.6} />
      </Box>
    </>
  );
}

function EndBody() {
  const { W, H, M, t } = useFrameCtx();
  return (
    <>
      <Box x={M} y={M}>
        <Wordmark />
      </Box>
      <Box x={M} y={210}>
        <Lines lines={['Kame Space', 'sends all five.']} accentFrom={1} size={118} />
        <Sub size={32} style={{ marginTop: 40, maxWidth: 860 }}>
          Confirmation, GAF, parking, stay guide and refund form, each at the right step of every
          booking.
        </Sub>
      </Box>
      <Path
        x={0}
        y={900}
        length={W}
        nodes={trackNodes(W, M)}
        active={tips.length - 1}
        colors={pathOnBrand}
        node={44}
        fillFrom={0}
      />
      <Box x={M} y={H - M - 84} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <Cta />
        <span style={{ fontSize: 28, fontWeight: 600, color: t.sub }}>{SITE}</span>
      </Box>
    </>
  );
}

export function ChecklistSlide({ index, format }: { index: number; format: Format }) {
  const last = index === CHECKLIST_SLIDES - 1;
  const brand = index === 0 || last;
  return (
    <Frame format={format} tone={brand ? 'brand' : 'paper'}>
      {index === 0 ? <CoverBody /> : last ? <EndBody /> : <TipBody i={index - 1} />}
    </Frame>
  );
}

/** Not animated; kept so the slide matches the concept signature in the studio. */
export const CHECKLIST_FRAME = SETTLED;
