import { Lines } from '../concepts';
import { ease, reveal, SETTLED } from '../motion';
import { Box, Cta, Diamond, Frame, Kicker, Sub, useFrameCtx, Wordmark } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { TopBar } from './shared';

/**
 * 10 · A day, handled. Day-in-the-life timeline: what ran in the background on one
 * Saturday, with the module that did it. Times are Asia/Manila, sample data only.
 */

interface Ev {
  t: string;
  k: string;
  s: string;
  m: string;
}

const day: Ev[] = [
  { t: '2:14 AM', k: 'Receipt verified', s: '₱8,400 matched to KH-2381', m: 'Receipt check' },
  { t: '6:00 AM', k: 'Rates set', s: 'Next weekend priced for demand', m: 'Smart Pricing' },
  { t: '7:00 AM', k: 'Stay guide sent', s: 'Maria has her check-in steps', m: 'Bookings' },
  { t: '11:48 AM', k: 'Reply drafted', s: 'Early check-in, on Messenger', m: 'Inbox' },
  { t: '1:20 PM', k: 'Guest call answered', s: 'Parking is B2, slot 41', m: 'Receptionist' },
  { t: '4:00 PM', k: 'Cleaner pinged', s: 'Turnover for Unit 2604', m: 'Telegram' },
  { t: '9:10 PM', k: 'Airbnb booking synced', s: 'Oct 24 to 26 blocked', m: 'Channel sync' },
  { t: '11:30 PM', k: 'Income recorded', s: '₱8,400 added to October', m: 'Finance' },
];

const ROW_AT = 26;
const ROW_STEP = 16;

function Timeline({
  rows,
  w,
  rowH,
  k = 1,
  frame,
  tail = 0,
}: {
  rows: Ev[];
  w: number;
  rowH: number;
  k?: number;
  frame: number;
  /** Extra line length past the last row (bleeds off the canvas). */
  tail?: number;
}) {
  const { t } = useFrameCtx();
  const timeW = 168 * k;
  const nodeX = timeW + 22 * k;
  const textX = nodeX + 44 * k;
  const fill = ease(frame, ROW_AT, ROW_AT + ROW_STEP * rows.length + 6);
  const lineLen = rowH * (rows.length - 1);
  return (
    <div style={{ position: 'relative', width: w, height: rowH * rows.length + tail }}>
      <div
        style={{
          position: 'absolute',
          left: nodeX - 2 * k,
          top: rowH / 2,
          width: 4 * k,
          height: lineLen + tail,
          background: t.line,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: nodeX - 2 * k,
          top: rowH / 2,
          width: 4 * k,
          height: lineLen * fill,
          background: c.brand,
          borderRadius: 4,
        }}
      />
      {rows.map((r, i) => {
        const at = ROW_AT + i * ROW_STEP;
        return (
          <div
            key={r.t}
            style={{
              position: 'absolute',
              left: 0,
              top: i * rowH,
              width: w,
              height: rowH,
              display: 'flex',
              alignItems: 'center',
              ...reveal(frame, at, 16, 18),
            }}
          >
            <span
              style={{
                width: timeW,
                fontSize: 27 * k,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: t.sub,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {r.t}
            </span>
            <span
              style={{
                position: 'absolute',
                left: nodeX - 13 * k,
                top: rowH / 2 - 13 * k,
                width: 26 * k,
                height: 26 * k,
                display: 'grid',
                placeItems: 'center',
                background: t.bg,
              }}
            >
              <Diamond size={20 * k} color={c.brand} />
            </span>
            <div
              style={{
                position: 'absolute',
                left: textX,
                right: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 33 * k,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.k}
                </div>
                <div
                  style={{
                    fontSize: 24 * k,
                    fontWeight: 500,
                    color: t.sub,
                    marginTop: 4 * k,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.s}
                </div>
              </div>
              <span
                style={{
                  flex: 'none',
                  fontSize: 21 * k,
                  fontWeight: 700,
                  color: c.brandDeep,
                  background: c.tint,
                  borderRadius: 99,
                  padding: `${8 * k}px ${16 * k}px`,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.m}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const pick = (ids: number[]) => ids.map((i) => day[i]);

function DayBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const kicker = <Kicker style={reveal(frame, 0, 12)}>Saturday, October 18</Kicker>;
  const head = (size: number, lines = ['Saturday,', 'handled.']) => (
    <Lines lines={lines} accentFrom={1} size={size} frame={frame} delay={4} />
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          {kicker}
        </Box>
        <Box x={M} y={top + 170}>
          {head(140)}
        </Box>
        <Box x={M} y={top + 470}>
          <Timeline
            rows={pick([0, 2, 3, 4, 6])}
            w={W - M * 2}
            rowH={124}
            k={1.16}
            frame={frame}
            tail={900}
          />
        </Box>
      </>
    );
  }
  if (kind === 'portrait') {
    return (
      <>
        <TopBar />
        <Box x={M} y={180}>
          {kicker}
        </Box>
        <Box x={M} y={236}>
          {head(116)}
        </Box>
        <Box x={M} y={540}>
          <Timeline
            rows={pick([0, 2, 3, 4, 5, 6])}
            w={W - M * 2}
            rowH={112}
            frame={frame}
            tail={400}
          />
        </Box>
      </>
    );
  }
  if (kind === 'square') {
    return (
      <>
        <Box x={M} y={M}>
          {kicker}
        </Box>
        <Box x={M} y={M + 56}>
          {head(96, ['Saturday, handled.'])}
        </Box>
        <Box x={M} y={290}>
          <Timeline rows={pick([0, 2, 3, 4, 6])} w={W - M * 2} rowH={124} k={0.96} frame={frame} />
        </Box>
        <Box x={M} y={H - M - 30}>
          <Wordmark />
        </Box>
      </>
    );
  }
  // landscape: copy left, full day right
  const rows = H >= 1000 ? day : pick([0, 2, 3, 4, 5, 6]);
  const rowH = Math.min(112, Math.floor((H - 100) / rows.length));
  const k = Math.min(1, rowH / 108);
  const hsz = Math.round(128 * Math.min(1, H / 1080) ** 0.6);
  return (
    <>
      <Box x={M} y={Math.round((H - (hsz * 2 + 340)) / 2)}>
        {kicker}
        <div style={{ marginTop: 30 }}>{head(hsz)}</div>
        <Sub size={30} style={{ marginTop: 34, maxWidth: 560, ...reveal(frame, 30) }}>
          Receipts, replies, rates and reminders, done while you were out.
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
      <Box x={W - M - 940} y={Math.round((H - rowH * rows.length) / 2)}>
        <Timeline rows={rows} w={940} rowH={rowH} k={k} frame={frame} />
      </Box>
    </>
  );
}

export function DayConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="white">
      <DayBody frame={frame} />
    </Frame>
  );
}

export const DAY_VIDEO = ROW_AT + ROW_STEP * day.length + 80;
