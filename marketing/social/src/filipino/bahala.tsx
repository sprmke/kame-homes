import { Check } from 'lucide-react';

import { Lines } from '../concepts';
import { pop, reveal, SETTLED } from '../motion';
import { Box, Cta, Frame, Sub, useFrameCtx, Wordmark } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { Scaled, TopBar } from '../angles/shared';
import { BRAND_LINE } from './copy';

/**
 * F01 · Kame na bahala. The Filipino host's real pain: "Hi po" messages that keep coming
 * past midnight. Each one resolves to what Kame Space already did (status chips are app UI,
 * so they stay in English like the product). Then the brand line lands.
 */

const msgs = [
  {
    name: 'Carla',
    time: '11:42 PM',
    text: 'Hi po! Available pa po ba this Saturday?',
    done: 'Booked direct',
  },
  {
    name: 'Mark',
    time: '12:08 AM',
    text: 'Na-send ko na po yung resibo, pa-check po',
    done: 'Receipt verified',
  },
  {
    name: 'Jen',
    time: '12:31 AM',
    text: 'Ate, ano po ang Wi-Fi password?',
    done: 'Stay guide sent',
  },
  {
    name: 'Paolo',
    time: '1:15 AM',
    text: 'Approved na po ba yung GAF namin?',
    done: 'GAF approved',
  },
  {
    name: 'Ria',
    time: '2:04 AM',
    text: 'Kailan po ma-refund yung deposit?',
    done: 'Refund form sent',
  },
];

const AVATAR = [
  'hsl(42 70% 86%)',
  'hsl(200 40% 86%)',
  c.tint,
  'hsl(18 60% 88%)',
  'hsl(260 30% 89%)',
];

const MSG_AT = 12;
const MSG_STEP = 15;
const DONE_AT = MSG_AT + MSG_STEP * msgs.length + 14;
const DONE_STEP = 9;
const LINE_AT = DONE_AT + DONE_STEP * msgs.length + 6;
export const BAHALA_VIDEO = LINE_AT + 80;

export const THREAD_W = 640;
export const THREAD_H = 806;

function Thread({ frame }: { frame: number }) {
  const shown = msgs.filter((_, i) => frame >= MSG_AT + i * MSG_STEP).length;
  const resolved = msgs.filter((_, i) => frame >= DONE_AT + i * DONE_STEP).length;
  const open = shown - resolved;
  return (
    <div
      style={{
        width: THREAD_W,
        height: THREAD_H,
        borderRadius: 40,
        background: c.white,
        border: `2px solid ${c.line}`,
        overflow: 'hidden',
        color: c.ink,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '26px 30px',
          borderBottom: `2px solid ${c.line}`,
        }}
      >
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Messages</div>
          <div style={{ fontSize: 20, color: c.muted, marginTop: 2 }}>Unit 2604 · tonight</div>
        </div>
        <span
          style={{
            minWidth: 64,
            height: 46,
            padding: '0 16px',
            borderRadius: 99,
            background: open > 0 ? c.coral : c.brand,
            color: c.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 22,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            boxSizing: 'border-box',
          }}
        >
          {open > 0 ? open : <Check size={26} strokeWidth={3} />}
        </span>
      </div>
      <div style={{ padding: '6px 30px' }}>
        {msgs.map((m, i) => {
          const isDone = frame >= DONE_AT + i * DONE_STEP;
          return (
            <div
              key={m.name}
              style={{
                display: 'flex',
                gap: 18,
                padding: '18px 0',
                borderTop: i ? `2px solid ${c.line}` : 'none',
                opacity: i < shown ? 1 : 0,
                ...(i < shown ? pop(frame, MSG_AT + i * MSG_STEP, 10) : {}),
              }}
            >
              <span
                style={{
                  width: 54,
                  height: 54,
                  flex: 'none',
                  borderRadius: 99,
                  background: AVATAR[i],
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  color: c.inkSoft,
                }}
              >
                {m.name[0]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{m.name}</span>
                  <span
                    style={{ fontSize: 19, color: c.muted, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {m.time}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 500,
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    marginTop: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.text}
                </div>
                <div style={{ height: 40, marginTop: 10 }}>
                  {isDone ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        height: 38,
                        padding: '0 14px 0 10px',
                        borderRadius: 99,
                        background: c.tint,
                        color: c.brandDeep,
                        fontSize: 19,
                        fontWeight: 700,
                        ...pop(frame, DONE_AT + i * DONE_STEP, 10),
                      }}
                    >
                      <Check size={20} strokeWidth={3} />
                      {m.done}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PAIN = ['Hatinggabi na,', 'may "Hi po" pa?'];

function Head({ size, frame, gap = 0 }: { size: number; frame: number; gap?: number }) {
  return (
    <>
      <Lines lines={PAIN} size={size} frame={frame} delay={2} />
      <div style={{ marginTop: gap }}>
        <Lines lines={[BRAND_LINE]} accentFrom={0} size={size} frame={frame} delay={LINE_AT} />
      </div>
    </>
  );
}

function BahalaBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    const s = 1.25;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          <Head size={96} frame={frame} />
        </Box>
        <Scaled x={(W - THREAD_W * s) / 2} y={top + 470} scale={s}>
          <Thread frame={frame} />
        </Scaled>
      </>
    );
  }
  if (kind === 'portrait') {
    const s = 0.94;
    return (
      <>
        <TopBar />
        <Box x={M} y={176}>
          <Head size={88} frame={frame} />
        </Box>
        <Scaled x={W - M - THREAD_W * s + 30} y={500} scale={s}>
          <Thread frame={frame} />
        </Scaled>
      </>
    );
  }
  if (kind === 'square') {
    const s = 0.72;
    return (
      <>
        <Box x={M} y={M}>
          <Lines lines={PAIN} size={76} frame={frame} delay={2} />
        </Box>
        <Scaled x={W - M - THREAD_W * s + 30} y={290} scale={s}>
          <Thread frame={frame} />
        </Scaled>
        <Box x={M} y={H - M - 30 - 60 - 2 * 84}>
          <Lines
            lines={['Kame na', 'bahala.']}
            accentFrom={0}
            size={84}
            frame={frame}
            delay={LINE_AT}
          />
        </Box>
        <Box x={M} y={H - M - 30}>
          <Wordmark />
        </Box>
      </>
    );
  }
  // landscape (16:9, link)
  const s = Math.min(1.1, (H - 120) / THREAD_H);
  const hsz = Math.round(100 * Math.min(1, H / 1080) ** 0.6);
  const short = H < 800;
  return (
    <>
      <Box x={M} y={Math.round((H - (hsz * 3 + (short ? 120 : 280))) / 2)}>
        <Head size={hsz} frame={frame} />
        {short ? null : (
          <Sub size={30} style={{ marginTop: 34, maxWidth: 640, ...reveal(frame, LINE_AT + 10) }}>
            Resibo, Wi-Fi, GAF at refund. May sagot at status na ang bawat isa.
          </Sub>
        )}
        <div
          style={{
            marginTop: short ? 34 : 44,
            display: 'flex',
            gap: 34,
            alignItems: 'center',
            ...reveal(frame, LINE_AT + 16),
          }}
        >
          <Cta />
          <Wordmark size={28} />
        </div>
      </Box>
      <Scaled x={W - M - THREAD_W * s} y={(H - THREAD_H * s) / 2} scale={s}>
        <Thread frame={frame} />
      </Scaled>
    </>
  );
}

export function BahalaConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <BahalaBody frame={frame} />
    </Frame>
  );
}
