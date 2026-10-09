import { Check, X } from 'lucide-react';

import { Lines } from '../concepts';
import { reveal, SETTLED } from '../motion';
import { Box, Cta, Diamond, Frame, Kicker, Sub, useFrameCtx, Wordmark } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { TopBar } from './shared';

/**
 * 11 · Versus. Comparison table: the chat-and-spreadsheet way vs Kame Homes, one job
 * per row. The Kame column is a solid brand plane, the old column stays quiet.
 */

const rows: [string, string, string][] = [
  ['Receipts', 'Checked by eye', 'Matched by AI'],
  ['Building GAF', 'Email threads', 'Filed to the booking'],
  ['Airbnb dates', 'Copied by hand', 'Two-way sync'],
  ['Guest questions', 'You, at 2 AM', 'Answered day or night'],
  ['Deposits', 'From memory', 'Guest refund form'],
  ['Profit', 'Month-end sheet', 'Recorded per booking'],
];

const ROW_AT = 24;
const ROW_STEP = 9;

function Table({
  w,
  rowH,
  k = 1,
  n = rows.length,
  frame,
}: {
  w: number;
  rowH: number;
  k?: number;
  n?: number;
  frame: number;
}) {
  const { t } = useFrameCtx();
  const c1 = w * 0.27;
  const c2 = w * 0.31;
  const c3 = w - c1 - c2;
  const headH = rowH * 0.9;
  const list = rows.slice(0, n);
  const h = headH + rowH * list.length;
  return (
    <div style={{ position: 'relative', width: w, height: h + 20 * k }}>
      <div
        style={{
          position: 'absolute',
          left: c1 + c2,
          top: 0,
          width: c3,
          height: h + 20 * k,
          background: c.brand,
          borderRadius: 30 * k,
          ...reveal(frame, 10, 30, 24),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: headH,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ width: c1 }} />
        <span
          style={{ width: c2, fontSize: 23 * k, fontWeight: 600, color: t.sub, lineHeight: 1.2 }}
        >
          Group chat
          <br />+ spreadsheet
        </span>
        <span
          style={{
            width: c3,
            paddingLeft: 30 * k,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 12 * k,
            fontSize: 30 * k,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: c.white,
          }}
        >
          <Diamond size={18 * k} color={c.white} /> Kame Homes
        </span>
      </div>
      {list.map(([label, old, kame], i) => (
        <div
          key={label}
          style={{
            position: 'absolute',
            left: 0,
            top: headH + i * rowH,
            width: w,
            height: rowH,
            display: 'flex',
            alignItems: 'center',
            ...reveal(frame, ROW_AT + i * ROW_STEP, 14, 18),
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: c3,
              top: 0,
              height: 2,
              background: t.line,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: c1 + c2 + 30 * k,
              right: 30 * k,
              top: 0,
              height: 2,
              background: c.brandTrack,
            }}
          />
          <span style={{ width: c1, fontSize: 27 * k, fontWeight: 700, letterSpacing: '-0.025em' }}>
            {label}
          </span>
          <span
            style={{
              width: c2,
              display: 'flex',
              alignItems: 'center',
              gap: 10 * k,
              fontSize: 24 * k,
              fontWeight: 500,
              color: c.muted,
            }}
          >
            <X size={22 * k} strokeWidth={2.6} color={c.coral} style={{ flex: 'none' }} /> {old}
          </span>
          <span
            style={{
              width: c3,
              paddingLeft: 30 * k,
              paddingRight: 20 * k,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 12 * k,
              fontSize: 25 * k,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              color: c.white,
            }}
          >
            <Check size={24 * k} strokeWidth={3} color={c.onBrand} style={{ flex: 'none' }} />{' '}
            {kame}
          </span>
        </div>
      ))}
    </div>
  );
}

function VersusBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const kicker = <Kicker style={reveal(frame, 0, 12)}>Same work, two ways</Kicker>;
  const head = (size: number, lines = ['Same rentals.', 'Less admin.']) => (
    <Lines lines={lines} accentFrom={1} size={size} frame={frame} delay={4} />
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          {head(124)}
        </Box>
        <Box x={M} y={top + 400}>
          <Table w={W - M * 2} rowH={98} k={1.04} frame={frame} />
        </Box>
      </>
    );
  }
  if (kind === 'portrait') {
    return (
      <>
        <TopBar />
        <Box x={M} y={176}>
          {kicker}
        </Box>
        <Box x={M} y={232}>
          {head(108)}
        </Box>
        <Box x={M} y={500}>
          <Table w={W - M * 2} rowH={98} k={0.96} frame={frame} />
        </Box>
        <Box x={M} y={H - M - 84} style={reveal(frame, 80)}>
          <Cta />
        </Box>
      </>
    );
  }
  if (kind === 'square') {
    return (
      <>
        <Box x={M} y={M}>
          {head(84, ['Same rentals. Less admin.'])}
        </Box>
        <Box x={M} y={M + 140}>
          <Table w={W - M * 2} rowH={104} k={0.92} n={5} frame={frame} />
        </Box>
        <Box x={M} y={H - M - 30}>
          <Wordmark />
        </Box>
      </>
    );
  }
  // landscape
  const n = H >= 1000 ? 6 : 5;
  const rowH = Math.min(108, Math.floor((H - 200) / (n + 1)));
  const k = Math.min(1.04, rowH / 100);
  const hsz = Math.round(128 * Math.min(1, H / 1080) ** 0.6);
  return (
    <>
      <Box x={M} y={Math.round((H - (hsz * 2 + 330)) / 2)}>
        {kicker}
        <div style={{ marginTop: 30 }}>{head(hsz)}</div>
        <Sub size={30} style={{ marginTop: 34, maxWidth: 520, ...reveal(frame, 30) }}>
          Every job you do by hand today has a place in Kame Homes.
        </Sub>
        <div
          style={{
            marginTop: 44,
            display: 'flex',
            gap: 34,
            alignItems: 'center',
            ...reveal(frame, 40),
          }}
        >
          <Cta />
          <Wordmark size={28} />
        </div>
      </Box>
      <Box x={W - M - 1000} y={Math.round((H - (rowH * (n + 0.9) + 20)) / 2)}>
        <Table w={1000} rowH={rowH} k={k} n={n} frame={frame} />
      </Box>
    </>
  );
}

export function VersusConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <VersusBody frame={frame} />
    </Frame>
  );
}
