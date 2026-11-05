import { Check } from 'lucide-react';

import { ease, reveal, SETTLED } from '../motion';
import { Box, SITE, Wordmark, Frame, useFrameCtx } from '../primitives';
import { c, STORY_SAFE, tones, type Format } from '../theme';

/**
 * F02 · Noon vs Ngayon. The "then and now" split Filipino pages use all the time.
 * Noon on paper, struck through in coral. Ngayon on the brand plane, each line checked.
 * Items pair up row by row: the old habit, then what Kame Space does instead.
 */

const noon = ['Resibo sa GC', 'Excel na luma na', 'Gising nang 2 AM', 'Double booking'];
const ngayon = [
  'Resibo, verified na',
  'Live na booking list',
  'AI ang sumasagot',
  'Synced sa Airbnb',
];

const ROW_AT = 18;
const ROW_STEP = 12;
const NOW_AT = ROW_AT + ROW_STEP * noon.length + 20;
export const NOON_VIDEO = NOW_AT + ROW_STEP * ngayon.length + 70;

function Label({
  text,
  size,
  color,
  frame,
  delay,
}: {
  text: string;
  size: number;
  color: string;
  frame: number;
  delay: number;
}) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: '-0.05em',
        lineHeight: 1,
        color,
        ...reveal(frame, delay),
      }}
    >
      {text}
    </div>
  );
}

function Rows({
  items,
  now,
  size,
  gap,
  frame,
  at,
}: {
  items: string[];
  now: boolean;
  size: number;
  gap: number;
  frame: number;
  at: number;
}) {
  const ink = now ? c.white : c.inkSoft;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {items.map((txt, i) => {
        const d = at + i * ROW_STEP;
        const strike = ease(frame, d + 8, d + 18);
        return (
          <div
            key={txt}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: size * 0.45,
              ...reveal(frame, d, 20, 16),
            }}
          >
            <span
              style={{
                width: size * 1.05,
                height: size * 1.05,
                flex: 'none',
                borderRadius: size * 0.3,
                display: 'grid',
                placeItems: 'center',
                background: now ? c.white : 'transparent',
                border: now ? 'none' : `${Math.max(3, size * 0.07)}px solid ${c.line}`,
                boxSizing: 'border-box',
                color: c.brandDeep,
              }}
            >
              {now ? <Check size={size * 0.68} strokeWidth={3} /> : null}
            </span>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span
                style={{
                  fontSize: size,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  whiteSpace: 'nowrap',
                  color: ink,
                }}
              >
                {txt}
              </span>
              {now ? null : (
                <span
                  style={{
                    position: 'absolute',
                    left: -4,
                    top: '52%',
                    height: Math.max(4, size * 0.08),
                    width: `calc(${strike * 100}% + 8px)`,
                    background: c.coral,
                    borderRadius: 6,
                  }}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NoonBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const b = tones.brand;

  if (kind === 'vertical' || kind === 'portrait') {
    const vertical = kind === 'vertical';
    const top = vertical ? STORY_SAFE.top : M;
    const split = vertical ? 830 : 640;
    const label = vertical ? 130 : 124;
    const row = vertical ? 44 : 42;
    const gap = vertical ? 22 : 20;
    return (
      <>
        <Box x={M} y={top}>
          <Wordmark />
        </Box>
        <Box x={M} y={top + (vertical ? 66 : 90)}>
          <Label text="Noon" size={label} color={c.ink} frame={frame} delay={2} />
          <div style={{ marginTop: vertical ? 36 : 30 }}>
            <Rows items={noon} now={false} size={row} gap={gap} frame={frame} at={ROW_AT} />
          </div>
        </Box>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: split,
            width: W,
            height: H - split,
            background: b.bg,
          }}
        />
        <Box x={M} y={split + (vertical ? 50 : 56)}>
          <Label text="Ngayon" size={label} color={b.accent} frame={frame} delay={NOW_AT - 8} />
          <div style={{ marginTop: vertical ? 36 : 30 }}>
            <Rows items={ngayon} now size={row} gap={gap} frame={frame} at={NOW_AT} />
          </div>
        </Box>
        {vertical ? null : (
          <Box
            x={M}
            y={H - M - 30}
            w={W - M * 2}
            style={{ display: 'flex', justifyContent: 'flex-end', ...reveal(frame, NOW_AT + 40) }}
          >
            <span style={{ fontSize: 26, fontWeight: 600, color: b.sub }}>{SITE}</span>
          </Box>
        )}
      </>
    );
  }

  // square and landscape: side by side
  const half = W / 2;
  const square = kind === 'square';
  const label = square ? 104 : 176;
  const row = square ? 30 : 56;
  const gap = square ? 18 : 30;
  const blockH = label + (square ? 30 : 40) + noon.length * (row * 1.05 + gap);
  const y0 = Math.round((H - blockH) / 2) + (square ? 10 : 0);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: half,
          top: 0,
          width: half,
          height: H,
          background: b.bg,
        }}
      />
      <Box x={M} y={square ? M : Math.max(40, M * 0.5)}>
        <Wordmark size={square ? 28 : 30} />
      </Box>
      <Box x={M} y={y0}>
        <Label text="Noon" size={label} color={c.ink} frame={frame} delay={2} />
        <div style={{ marginTop: square ? 30 : 40 }}>
          <Rows items={noon} now={false} size={row} gap={gap} frame={frame} at={ROW_AT} />
        </div>
      </Box>
      <Box x={half + (square ? 56 : M * 0.75)} y={y0}>
        <Label text="Ngayon" size={label} color={b.accent} frame={frame} delay={NOW_AT - 8} />
        <div style={{ marginTop: square ? 30 : 40 }}>
          <Rows items={ngayon} now size={row} gap={gap} frame={frame} at={NOW_AT} />
        </div>
      </Box>
      <Box
        x={half}
        y={square ? H - M - 30 : H - Math.max(40, M * 0.5) - 30}
        w={half - (square ? M : M * 0.75)}
        style={{ display: 'flex', justifyContent: 'flex-end', ...reveal(frame, NOW_AT + 40) }}
      >
        <span style={{ fontSize: 26, fontWeight: 600, color: b.sub }}>{SITE}</span>
      </Box>
    </>
  );
}

export function NoonNgayonConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <NoonBody frame={frame} />
    </Frame>
  );
}
