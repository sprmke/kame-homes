import { ChevronLeft } from 'lucide-react';

import { Lines } from '../concepts';
import { ease, pop, reveal, rise, SETTLED } from '../motion';
import { Box, Cta, Diamond, Frame, Sub, useFrameCtx, Wordmark } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { Scaled, TopBar } from './shared';

/**
 * 09 · Group chat. Relatable pain first: the team chat fills with the same five questions.
 * Then one booking card answers all of them. Light chat, dark answer card.
 */

const msgs = [
  { who: 'Joy · Cleaner', text: 'What time is checkout on Monday?' },
  { who: 'Ben · Co-host', text: 'Did the Saturday guest send the receipt?' },
  { who: 'Joy · Cleaner', text: 'Also who has the GAF? Admin is asking' },
  { who: 'Ben · Co-host', text: "Guard says parking isn't approved??" },
  { who: 'Joy · Cleaner', text: 'Hello?' },
];

const MSG_AT = 18;
const MSG_STEP = 13;
const CARD_AT = MSG_AT + MSG_STEP * msgs.length + 24;

export const CHAT_W = 620;
export const CHAT_H = 720;

function ChatWindow({ frame }: { frame: number }) {
  const shown = msgs.filter((_, i) => frame >= MSG_AT + i * MSG_STEP).length;
  const unread = frame >= SETTLED ? 48 : 3 + Math.round(ease(frame, MSG_AT, CARD_AT) * 45);
  const dim = frame >= SETTLED ? 0 : ease(frame, CARD_AT - 6, CARD_AT + 14);
  return (
    <div
      style={{
        width: CHAT_W,
        height: CHAT_H,
        borderRadius: 40,
        background: c.white,
        border: `2px solid ${c.line}`,
        overflow: 'hidden',
        color: c.ink,
        opacity: 1 - dim * 0.45,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '26px 28px',
          borderBottom: `2px solid ${c.line}`,
        }}
      >
        <ChevronLeft size={34} color={c.muted} />
        <div style={{ display: 'flex' }}>
          {['J', 'B', 'Y'].map((l, i) => (
            <span
              key={l}
              style={{
                width: 50,
                height: 50,
                borderRadius: 99,
                marginLeft: i ? -14 : 0,
                border: `3px solid ${c.white}`,
                background: ['hsl(42 70% 86%)', 'hsl(200 40% 86%)', c.tint][i],
                display: 'grid',
                placeItems: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: c.inkSoft,
              }}
            >
              {l}
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Unit 2604 team
          </div>
          <div style={{ fontSize: 20, color: c.muted, marginTop: 2 }}>Joy, Ben, you</div>
        </div>
        <span
          style={{
            minWidth: 64,
            height: 44,
            padding: '0 14px',
            borderRadius: 99,
            background: c.coral,
            color: c.white,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            boxSizing: 'border-box',
          }}
        >
          {unread}
        </span>
      </div>
      <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msgs.map((m, i) =>
          i < shown || frame >= SETTLED ? (
            <div key={i} style={pop(frame, MSG_AT + i * MSG_STEP, 10)}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c.muted, margin: '0 0 6px 6px' }}>
                {m.who}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '14px 20px',
                  borderRadius: '26px 26px 26px 8px',
                  background: 'hsl(150 6% 93%)',
                  fontSize: 25,
                  fontWeight: 500,
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}
              >
                {m.text}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

const answers = [
  ['Receipt', '₱8,400 verified'],
  ['GAF', 'Approved by admin'],
  ['Parking', 'B2, slot 41'],
  ['Check-out', 'Mon, 11 AM'],
];

export const CARD_W = 540;
export const CARD_H = 470;

function AnswerCard({ frame }: { frame: number }) {
  return (
    <div style={rise(frame, CARD_AT, 120, 30)}>
      <div
        style={{
          width: CARD_W,
          borderRadius: 40,
          background: c.graphite,
          color: c.white,
          padding: '30px 34px',
          boxSizing: 'border-box',
          boxShadow: `0 50px 80px -40px color-mix(in srgb, ${c.paper} 20%, #08120f)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            <Diamond size={14} color={c.mint} /> Booking KH-2381
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: c.night,
              background: c.mint,
              borderRadius: 99,
              padding: '7px 14px',
            }}
          >
            Team can see
          </span>
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.035em', marginTop: 18 }}>
          Maria Santos
        </div>
        <div style={{ fontSize: 21, color: c.nightSub, marginTop: 4 }}>
          Unit 2604 · Oct 18 to 20
        </div>
        <div style={{ marginTop: 18 }}>
          {answers.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '13px 0',
                borderTop: `2px solid ${c.graphiteLine}`,
                ...reveal(frame, CARD_AT + 14 + i * 7, 14, 16),
              }}
            >
              <Diamond size={14} color={c.mint} />
              <span style={{ fontSize: 22, color: c.nightSub, width: 140 }}>{k}</span>
              <span style={{ fontSize: 23, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const head = (lines: string[], size: number, accent = 2) => (
    <Lines lines={lines} accentFrom={accent} size={size} frame={frame} delay={2} />
  );
  const tall = ['Your group chat', "isn't a", 'booking system.'];

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 120}>
          {head(tall, 112)}
        </Box>
        <Scaled x={M} y={top + 560} scale={1.2}>
          <ChatWindow frame={frame} />
        </Scaled>
        <Scaled x={W - M - CARD_W * 1.2 + 30} y={top + 1060} scale={1.2}>
          <AnswerCard frame={frame} />
        </Scaled>
      </>
    );
  }
  if (kind === 'portrait') {
    return (
      <>
        <TopBar />
        <Box x={M} y={176}>
          {head(tall, 100)}
        </Box>
        <Scaled x={M} y={530} scale={0.92}>
          <ChatWindow frame={frame} />
        </Scaled>
        <Scaled x={W - M - CARD_W * 0.92 + 20} y={860} scale={0.92}>
          <AnswerCard frame={frame} />
        </Scaled>
      </>
    );
  }
  if (kind === 'square') {
    return (
      <>
        <Box x={M} y={M}>
          {head(['Your group chat', "isn't a booking system."], 74, 1)}
        </Box>
        <Scaled x={M} y={290} scale={0.86}>
          <ChatWindow frame={frame} />
        </Scaled>
        <Scaled x={W - M - CARD_W * 0.86 + 20} y={560} scale={0.86}>
          <AnswerCard frame={frame} />
        </Scaled>
        <Box x={M} y={H - M - 30}>
          <Wordmark />
        </Box>
      </>
    );
  }
  // landscape
  const s = Math.min(0.98, (H - 120) / CHAT_H);
  const hsz = Math.round(92 * Math.min(1, H / 1080) ** 0.6);
  return (
    <>
      <Box x={M} y={Math.round((H - (hsz * 3 + 250)) / 2)}>
        {head(['Your group chat', "isn't a booking", 'system.'], hsz)}
        <Sub size={30} style={{ marginTop: 30, maxWidth: 620, ...reveal(frame, 30) }}>
          Give the team the booking instead. Receipt, GAF, parking and check-out in one place.
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
      <Scaled x={W - M - CHAT_W * s - 200} y={(H - CHAT_H * s) / 2} scale={s}>
        <ChatWindow frame={frame} />
      </Scaled>
      <Scaled x={W - M - CARD_W * s + 40} y={H - CARD_H * s - 30} scale={s}>
        <AnswerCard frame={frame} />
      </Scaled>
    </>
  );
}

export function GroupChatConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <ChatBody frame={frame} />
    </Frame>
  );
}

export const GROUP_CHAT_VIDEO = CARD_AT + 90;
