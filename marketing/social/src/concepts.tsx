import type { CSSProperties, ReactNode } from 'react';

import {
  CalendarDays,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  ReceiptText,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { Bento } from './bento';
import { Phone, PHONE_H, PHONE_W, Push } from './device';
import { maskUp, reveal, rise, SETTLED } from './motion';
import { Path, pathOnDark, pathOnBrand, STAGES } from './path';
import {
  Box,
  Cta,
  Diamond,
  Fit,
  Footer,
  Frame,
  Kicker,
  SITE,
  Sub,
  useFrameCtx,
  Wordmark,
} from './primitives';
import { FinanceScreen, InboxScreen, LockScreen } from './screens';
import { c, STORY_SAFE, tones, type Format, type FormatKind, type ToneName } from './theme';

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

/** Display lines with hand-set breaks. Lines from `accentFrom` on take the tone accent. */
export function Lines({
  lines,
  size,
  accentFrom = 99,
  frame = SETTLED,
  delay = 0,
  style,
}: {
  lines: string[];
  size?: number;
  accentFrom?: number;
  frame?: number;
  delay?: number;
  style?: CSSProperties;
}) {
  const { hs, t } = useFrameCtx();
  const s = size ?? hs;
  return (
    <div style={style}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{ overflow: 'hidden', paddingBottom: s * 0.16, marginBottom: -s * 0.16 }}
        >
          <div
            style={{
              fontSize: s,
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: '-0.045em',
              whiteSpace: 'nowrap',
              color: i >= accentFrom ? t.accent : t.fg,
              ...maskUp(frame, delay + i * 6),
            }}
          >
            {l}
          </div>
        </div>
      ))}
    </div>
  );
}

type PerKind<T> = Record<FormatKind, T>;

/* ------------------------------------------------------------------ *
 * Phone concepts: lock screen, inbox, finance
 * ------------------------------------------------------------------ */

interface PhoneConceptCopy {
  tone: ToneName;
  tall: string[]; // 3-line break for narrow formats
  wide: string[]; // 2-line break for square
  accentTall: number;
  accentWide: number;
  sub: string;
  screen: (frame: number, startAt: number) => ReactNode;
  screenBg: string;
}

const lockCopy: PhoneConceptCopy = {
  tone: 'tint',
  tall: ['Your rentals,', 'handled', 'overnight.'],
  wide: ['Your rentals,', 'handled overnight.'],
  accentTall: 1,
  accentWide: 1,
  sub: 'Receipts checked, approvals filed and guests briefed while you sleep.',
  screen: (f, s) => <LockScreen frame={f} startAt={s} />,
  screenBg: c.brandDeep,
};

const inboxCopy: PhoneConceptCopy = {
  tone: 'night',
  tall: ['Reply before', 'they ask', 'twice.'],
  wide: ['Reply before', 'they ask twice.'],
  accentTall: 1,
  accentWide: 1,
  sub: 'Messenger, Instagram and web chat in one inbox, with a reply drafted for you.',
  screen: (f, s) => <InboxScreen frame={f} startAt={s} />,
  screenBg: c.white,
};

const financeCopy: PhoneConceptCopy = {
  tone: 'white',
  tall: ['Know your', 'real', 'profit.'],
  wide: ['Know your', 'real profit.'],
  accentTall: 1,
  accentWide: 1,
  sub: 'Income records itself from every booking. Add expenses, export the report.',
  screen: (f, s) => <FinanceScreen frame={f} startAt={s} />,
  screenBg: c.paper,
};

function PhoneBody({ copy, frame }: { copy: PhoneConceptCopy; frame: number }) {
  const { kind, W, H, M, t } = useFrameCtx();
  const phoneIn = rise(frame, 10, 180, 40);
  const screenAt = 34;
  const phone = (scale: number, x: number, y: number) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      <div style={phoneIn}>
        <Phone screen={copy.screenBg} shadowOn={t.bg}>
          {copy.screen(frame, screenAt)}
        </Phone>
      </div>
    </div>
  );

  if (kind === 'vertical') {
    const sc = 1.5;
    return (
      <>
        <Box
          x={M}
          y={STORY_SAFE.top}
          w={W - M * 2}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Wordmark />
          <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>{SITE}</span>
        </Box>
        <Box x={M} y={STORY_SAFE.top + 90}>
          <Lines lines={copy.tall} accentFrom={copy.accentTall} size={118} frame={frame} />
        </Box>
        {phone(sc, (W - PHONE_W * sc) / 2, STORY_SAFE.top + 500)}
      </>
    );
  }
  if (kind === 'portrait') {
    const sc = 1.24;
    return (
      <>
        <Box
          x={M}
          y={M}
          w={W - M * 2}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Wordmark />
          <span style={{ fontSize: 26, fontWeight: 600, color: t.sub }}>{SITE}</span>
        </Box>
        <Box x={M} y={190}>
          <Lines lines={copy.tall} accentFrom={copy.accentTall} frame={frame} />
        </Box>
        <Box x={M} y={620} w={360}>
          <Sub size={30} style={reveal(frame, 30)}>
            {copy.sub}
          </Sub>
        </Box>
        <Box x={M} y={H - M - 84} style={reveal(frame, 40)}>
          <Cta />
        </Box>
        {phone(sc, W - M - PHONE_W * sc + 30, 590)}
      </>
    );
  }
  if (kind === 'square') {
    const sc = 1.05;
    return (
      <>
        <Box x={M} y={M}>
          <Lines lines={copy.wide} accentFrom={copy.accentWide} size={90} frame={frame} />
        </Box>
        <Box x={M} y={M + 230} w={420}>
          <Sub size={28} style={reveal(frame, 30)}>
            {copy.sub}
          </Sub>
        </Box>
        <Box x={M} y={H - M - 30}>
          <Wordmark />
        </Box>
        {phone(sc, W - M - PHONE_W * sc + 10, 400)}
      </>
    );
  }
  // landscape (16:9, link ad, email)
  const sc = Math.min(1.36, (H * 1.12) / PHONE_H);
  const blockH = 3 * 0.98 * 128 + 36 + 100 + 48 + 84;
  const y0 = Math.max(M * 0.8, (H - blockH) / 2 + 16);
  return (
    <>
      <Box x={M} y={y0}>
        <Lines lines={copy.tall} accentFrom={copy.accentTall} frame={frame} />
        <Sub size={32} style={{ marginTop: 36, maxWidth: 680, ...reveal(frame, 30) }}>
          {copy.sub}
        </Sub>
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 34,
            ...reveal(frame, 40),
          }}
        >
          <Cta />
          <Wordmark size={28} />
        </div>
      </Box>
      {phone(sc, W - M - PHONE_W * sc - 60, Math.round(H * 0.11))}
    </>
  );
}

function makePhoneConcept(copy: PhoneConceptCopy) {
  return function Concept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
    return (
      <Frame format={format} tone={copy.tone}>
        <PhoneBody copy={copy} frame={frame} />
      </Frame>
    );
  };
}

export const LockConcept = makePhoneConcept(lockCopy);
export const InboxConcept = makePhoneConcept(inboxCopy);
export const FinanceConcept = makePhoneConcept(financeCopy);

/* ------------------------------------------------------------------ *
 * The Path: "Nothing slips."
 * ------------------------------------------------------------------ */

function PathBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const lines = ['Every booking.', 'One path.', 'Nothing slips.'];
  const pathAt = 40;

  if (kind === 'vertical' || kind === 'portrait') {
    const vertical = kind === 'vertical';
    const top = vertical ? STORY_SAFE.top : M;
    const hy = vertical ? top + 90 : 170;
    const size = vertical ? 124 : 112;
    const py = vertical ? 790 : 610;
    const gap = vertical ? 108 : 104;
    const nodes = STAGES.map((s, i) => ({ at: 40 + i * gap, label: s.label, note: s.note }));
    return (
      <>
        <Box x={M} y={top}>
          <Wordmark />
        </Box>
        <Box x={M} y={hy}>
          <Lines lines={lines} accentFrom={2} size={size} frame={frame} />
        </Box>
        <Path
          x={M + 24}
          y={py}
          length={H - py + 40}
          nodes={nodes}
          active={2}
          colors={pathOnBrand}
          vertical
          labelSize={vertical ? 40 : 36}
          frame={frame}
          startAt={pathAt}
          step={16}
        />
        {vertical ? null : (
          <Box x={W - M - 330} y={H - M - 84} style={reveal(frame, 60)}>
            <Cta />
          </Box>
        )}
      </>
    );
  }
  if (kind === 'square') {
    const span = W - M * 2;
    const nodes = STAGES.map((s, i) => ({ at: M + 16 + (i * (span - 150)) / 5, label: s.label }));
    return (
      <>
        <Box x={M} y={M + 40}>
          <Lines lines={['One path.', 'Nothing slips.']} accentFrom={1} size={110} frame={frame} />
        </Box>
        <Path
          x={0}
          y={590}
          length={W}
          nodes={nodes}
          active={2}
          colors={pathOnBrand}
          labelSize={25}
          node={40}
          frame={frame}
          startAt={pathAt}
          step={14}
          fillFrom={0}
        />
        <Footer />
      </>
    );
  }
  const span = W - M * 2;
  const py = Math.round(H * 0.66);
  const nodes = STAGES.map((s, i) => ({
    at: M + 20 + (i * (span - 230)) / 5,
    label: s.label,
    note: s.note,
  }));
  return (
    <>
      <Box x={M} y={Math.round(H * 0.11)}>
        <Lines
          lines={['Every booking. One path.', 'Nothing slips.']}
          accentFrom={1}
          frame={frame}
        />
      </Box>
      <Path
        x={0}
        y={py}
        length={W}
        nodes={nodes}
        active={2}
        colors={pathOnBrand}
        labelSize={32}
        node={48}
        frame={frame}
        startAt={pathAt}
        step={14}
        fillFrom={0}
      />
      <Footer />
    </>
  );
}

export function PathConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="brand">
      <PathBody frame={frame} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * Bento: "Everything your rentals need."
 * ------------------------------------------------------------------ */

function BentoBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  if (kind === 'landscape') {
    const top = Math.round(H * 0.25);
    return (
      <>
        <Box
          x={M}
          y={M - 20}
          w={W - M * 2}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
          <Lines
            lines={['Everything your rentals need.']}
            size={Math.round(H * 0.09)}
            frame={frame}
          />
          <Wordmark />
        </Box>
        <Box x={M} y={top}>
          <Bento
            w={W - M * 2}
            h={H - top - M + 30}
            layout="wide"
            s={Math.min(1, H / 1080) * 1.2}
            frame={frame}
            startAt={20}
          />
        </Box>
      </>
    );
  }
  const square = kind === 'square';
  const headH = square ? 220 : 250;
  return (
    <>
      <Box x={M} y={M}>
        <Lines
          lines={['Everything your', 'rentals need.']}
          accentFrom={1}
          size={square ? 84 : 100}
          frame={frame}
        />
      </Box>
      <Box x={M} y={M + headH}>
        <Bento
          w={W - M * 2}
          h={H - M * 2 - headH}
          layout={square ? 'square' : 'tall'}
          s={square ? 0.86 : 1}
          frame={frame}
          startAt={20}
        />
      </Box>
    </>
  );
}

export function BentoConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <BentoBody frame={frame} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * Before / after: "Five tabs open." vs "One workspace."
 * ------------------------------------------------------------------ */

const clutter: { icon: LucideIcon; label: string; x: number; y: number; r: number }[] = [
  { icon: FileSpreadsheet, label: 'Bookings_final_v3.xlsx', x: 10, y: 20, r: -5 },
  { icon: CalendarDays, label: 'Airbnb calendar', x: 150, y: 96, r: 4 },
  { icon: MessageCircle, label: 'Messenger (23)', x: 0, y: 176, r: 3 },
  { icon: ReceiptText, label: 'Receipts folder', x: 190, y: 250, r: -6 },
  { icon: Mail, label: 'GAF approval emails', x: 30, y: 330, r: -2 },
  { icon: StickyNote, label: 'Check-in notes', x: 210, y: 404, r: 5 },
];

function Clutter() {
  return (
    <div style={{ position: 'relative', width: 520, height: 480 }}>
      {clutter.map(({ icon: Icon, label, x, y, r }) => (
        <span
          key={label}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            transform: `rotate(${r}deg)`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            height: 64,
            padding: '0 24px 0 18px',
            borderRadius: 16,
            background: c.white,
            border: `1px solid ${c.line}`,
            boxShadow: '0 10px 24px -14px hsl(160 18% 14% / 0.35)',
            fontSize: 24,
            fontWeight: 600,
            color: c.inkSoft,
            whiteSpace: 'nowrap',
          }}
        >
          <Icon size={26} color={c.muted} />
          {label}
        </span>
      ))}
    </div>
  );
}

function CleanCard() {
  return (
    <div style={{ width: 520, height: 480, display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          width: 520,
          borderRadius: 32,
          background: c.white,
          color: c.ink,
          padding: 36,
          boxShadow: '0 30px 60px -30px hsl(160 20% 3% / 0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Maria Santos
            </div>
            <div style={{ fontSize: 22, color: c.muted, marginTop: 4 }}>
              Unit 2604 · Oct 18 to 20
            </div>
          </div>
          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              padding: '9px 16px',
              borderRadius: 99,
              background: c.tint,
              color: c.brandDeep,
            }}
          >
            Check-in today
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            height: 40,
            margin: '34px 0 30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 17,
              height: 6,
              background: c.line,
              borderRadius: 6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: '42%',
              top: 17,
              height: 6,
              background: c.brand,
              borderRadius: 6,
            }}
          />
          {Array.from({ length: 6 }, (_, i) => (
            <Diamond
              key={i}
              size={24}
              color={i < 3 ? c.brand : c.white}
              style={{
                position: 'relative',
                border: i < 3 ? undefined : `4px solid ${c.line}`,
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
        {['Receipt verified', 'GAF approved', 'Guide sent'].map((k) => (
          <div
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 0',
              borderTop: `1px solid ${c.line}`,
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            <Diamond size={14} color={c.brand} />
            {k}
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const sideBySide = kind === 'square' || kind === 'landscape';
  const after = tones.graphite;
  const before = tones.paper;
  const half = sideBySide ? W / 2 : H / 2;
  const pad = kind === 'landscape' ? M : M;
  const hsz =
    kind === 'landscape'
      ? Math.round(110 * Math.min(1, H / 1080) ** 0.5)
      : kind === 'square'
        ? 78
        : kind === 'vertical'
          ? 104
          : 92;

  const Panel = ({ which }: { which: 'before' | 'after' }) => {
    const t = which === 'before' ? before : after;
    const x = sideBySide && which === 'after' ? half : 0;
    const y = !sideBySide && which === 'after' ? half : 0;
    const w = sideBySide ? half : W;
    const h = sideBySide ? H : half;
    const topPad = kind === 'vertical' && which === 'before' ? STORY_SAFE.top : pad;
    const lines =
      which === 'before'
        ? sideBySide
          ? ['Five tabs', 'open.']
          : ['Five tabs open.']
        : sideBySide
          ? ['One', 'workspace.']
          : ['One workspace.'];
    const headBlock = lines.length * hsz + 60;
    const visualY = topPad + headBlock + 30;
    const visualH = h - visualY - (sideBySide ? pad + 50 : pad * 0.6);
    return (
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          background: t.bg,
          color: t.fg,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: pad, top: topPad }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 26,
              fontWeight: 600,
              color: t.sub,
              marginBottom: 18,
            }}
          >
            <Diamond size={13} color={which === 'before' ? c.muted : c.mint} />
            {which === 'before' ? 'Before' : 'With Kame Homes'}
          </div>
          {lines.map((l, i) => (
            <div
              key={l}
              style={{ overflow: 'hidden', paddingBottom: hsz * 0.16, marginBottom: -hsz * 0.16 }}
            >
              <div
                style={{
                  fontSize: hsz,
                  fontWeight: 700,
                  letterSpacing: '-0.045em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  color:
                    which === 'after' && i === lines.length - 1
                      ? c.mint
                      : which === 'before'
                        ? c.muted
                        : c.white,
                  ...maskUp(frame, (which === 'after' ? 40 : 0) + i * 6),
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: pad,
            top: visualY,
            ...reveal(frame, which === 'after' ? 56 : 14, 30),
          }}
        >
          <Fit
            w={520}
            h={480}
            boxW={w - pad * 2}
            boxH={Math.max(120, visualH)}
            alignX={sideBySide ? 'start' : 'end'}
            max={sideBySide ? 1.25 : 1.3}
          >
            {which === 'before' ? <Clutter /> : <CleanCard />}
          </Fit>
        </div>
      </div>
    );
  };

  return (
    <>
      <Panel which="before" />
      <Panel which="after" />
      {!sideBySide ? null : (
        <div style={{ position: 'absolute', right: pad, bottom: pad * 0.7, color: c.white }}>
          <WordmarkOn />
        </div>
      )}
    </>
  );
}

/** Wordmark rendered for a dark panel regardless of the frame tone. */
function WordmarkOn() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.035em',
        color: c.white,
      }}
    >
      <Diamond size={17} color={c.mint} />
      Kame Homes
    </div>
  );
}

export function SplitConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="paper">
      <SplitBody frame={frame} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * Offer card: "Start free."
 * ------------------------------------------------------------------ */

function OfferBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const vertical = kind === 'vertical';
  const landscape = kind === 'landscape';
  const top = vertical ? STORY_SAFE.top : M;
  const size = vertical
    ? 150
    : kind === 'portrait'
      ? 132
      : kind === 'square'
        ? 116
        : Math.round(150 * Math.min(1, H / 1080) ** 0.6);
  const py = vertical ? 1180 : landscape ? Math.round(H * 0.74) : Math.round(H * 0.7);
  const span = W - M * 2;
  const nodes = [0, 1, 2, 3, 4, 5].map((i) => ({ at: M + 20 + (i * (span - 40)) / 5 }));
  return (
    <>
      <Box x={M} y={top}>
        <Wordmark size={vertical ? 34 : 30} />
      </Box>
      <Box x={M} y={top + (vertical ? 150 : landscape ? Math.round(H * 0.12) : 120)}>
        <Lines lines={['Start free.', 'Set up today.']} accentFrom={1} size={size} frame={frame} />
        <Sub size={landscape ? 34 : 32} style={{ marginTop: 40, ...reveal(frame, 26) }}>
          No card to start · Works on your phone · Cancel anytime
        </Sub>
      </Box>
      <Path
        x={0}
        y={py}
        length={W}
        nodes={nodes}
        active={5}
        colors={{ ...pathOnBrand, done: c.white }}
        node={landscape ? 44 : 40}
        frame={frame}
        startAt={30}
        step={8}
        fillFrom={0}
      />
      <Box
        x={M}
        y={vertical ? STORY_SAFE.bottom - 120 : H - M - 84}
        style={{ display: 'flex', alignItems: 'center', gap: 30, ...reveal(frame, 50) }}
      >
        <Cta size={vertical ? 1.15 : 1} />
        <span style={{ fontSize: 28, fontWeight: 600, color: tones.brand.sub }}>{SITE}</span>
      </Box>
    </>
  );
}

export function OfferConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="brand">
      <OfferBody frame={frame} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * Panorama carousel: one Path runs across five portrait slides.
 * ------------------------------------------------------------------ */

export const PANO_SLIDES = 5;

function PanoSlideCopy({
  x,
  kicker,
  lines,
  sub,
}: {
  x: number;
  kicker: string;
  lines: string[];
  sub?: string;
}) {
  return (
    <Box x={x + 84} y={190}>
      <Kicker>{kicker}</Kicker>
      <Lines lines={lines} accentFrom={lines.length - 1} size={96} style={{ marginTop: 28 }} />
      {sub ? (
        <Sub size={30} style={{ marginTop: 30, maxWidth: 860 }}>
          {sub}
        </Sub>
      ) : null}
    </Box>
  );
}

function Panorama() {
  const SW = 1080;
  const py = 900;
  const nodes = [
    { at: 84 + 24 },
    { at: SW + 84 + 24, label: 'Documents', note: 'GAF and pet approval' },
    { at: SW * 2 + 84 + 24, label: 'Check-in', note: 'Guide sent' },
    { at: SW * 3 + 84 + 24, label: 'Deposit', note: 'Refund on time' },
    { at: SW * 4 + 84 + 24 },
  ];
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SW,
          height: 1350,
          background: c.brand,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: SW * 4,
          top: 0,
          width: SW,
          height: 1350,
          background: c.night,
        }}
      />
      {/* slide 1 */}
      <Box x={84} y={84}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: c.white,
          }}
        >
          <Diamond size={18} color={c.mint} /> Kame Homes
        </div>
      </Box>
      <Box x={84} y={250}>
        {['One stay,', 'start to', 'finish.'].map((l, i) => (
          <div
            key={l}
            style={{
              fontSize: 132,
              fontWeight: 700,
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
              color: i === 2 ? c.onBrand : c.white,
            }}
          >
            {l}
          </div>
        ))}
        <div style={{ marginTop: 40, fontSize: 32, fontWeight: 500, color: c.onBrandSub }}>
          Swipe to follow a booking
        </div>
      </Box>
      {/* slides 2–4 */}
      <PanoSlideCopy
        x={SW}
        kicker="Documents"
        lines={['Approvals', 'file themselves.']}
        sub="GAF and pet approvals come back by email and land on the right booking."
      />
      <PanoSlideCopy
        x={SW * 2}
        kicker="Check-in"
        lines={['Guests get the', 'guide on time.']}
        sub="Door code, Wi-Fi and house rules go out before arrival, every stay."
      />
      <PanoSlideCopy
        x={SW * 3}
        kicker="Deposit"
        lines={['Deposits back.', 'Books closed.']}
        sub="Refund reminders on schedule. Income recorded to finance on its own."
      />
      {[
        { x: SW, title: 'GAF approved', body: 'Building approved the guest form for Unit 2604. Filed to the booking.', time: '9:12 AM' },
        { x: SW * 2, title: 'Check-in guide sent', body: 'Maria S. has her door code, Wi-Fi and house rules for Friday, 3 PM.', time: '10:00 AM' },
        { x: SW * 3, title: 'Deposit refund due', body: 'Return ₱3,000 to Maria S. today. Stay income recorded to finance.', time: '11:30 AM' },
      ].map((n) => (
        <Box key={n.title} x={n.x + 84} y={1060} w={410} style={{ transform: 'scale(2.2)', transformOrigin: '0 0' }}>
          <Push title={n.title} body={n.body} time={n.time} style={{ background: c.white, boxShadow: `0 0 0 1px ${c.line}, 0 12px 24px -16px hsl(160 18% 14% / 0.3)` }} />
        </Box>
      ))}
      {/* slide 5 */}
      <Box x={SW * 4 + 84} y={250}>
        {['Start free.', 'Set up today.'].map((l, i) => (
          <div
            key={l}
            style={{
              fontSize: 120,
              fontWeight: 700,
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
              color: i === 1 ? c.mint : c.white,
            }}
          >
            {l}
          </div>
        ))}
        <div style={{ marginTop: 40, fontSize: 30, fontWeight: 500, color: c.nightSub }}>
          No card to start · Cancel anytime
        </div>
      </Box>
      {/* the path: continuous across all five slides */}
      <Path
        x={0}
        y={py}
        length={SW * 5}
        nodes={nodes}
        active={4}
        colors={{
          track: c.line,
          done: c.brand,
          bg: c.paper,
          label: c.ink,
          note: c.muted,
          mark: c.white,
        }}
        labelSize={32}
        node={50}
        fillFrom={0}
      />
      {/* recolour the path where it crosses the colored first and last slides */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: py - 5,
          width: SW,
          height: 10,
          background: c.white,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: SW * 4,
          top: py - 5,
          width: SW,
          height: 10,
          background: c.mint,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 84,
          top: py - 25,
          width: 50,
          height: 50,
          transform: 'rotate(45deg)',
          borderRadius: 10,
          background: c.white,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: SW * 4 + 84,
          top: py - 25,
          width: 50,
          height: 50,
          transform: 'rotate(45deg)',
          borderRadius: 10,
          background: c.mint,
        }}
      />
      <Box x={84} y={py + 48}>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: c.white }}>
          Booked
        </div>
        <div style={{ fontSize: 23, fontWeight: 500, color: c.onBrandSub, marginTop: 4 }}>
          Form, ID, payment
        </div>
      </Box>
      <Box x={SW * 4 + 84} y={py + 48}>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: c.white }}>
          Completed
        </div>
        <div style={{ fontSize: 23, fontWeight: 500, color: c.nightSub, marginTop: 4 }}>
          Income recorded
        </div>
      </Box>
      <Box
        x={SW * 4 + 84}
        y={1350 - 84 - 84}
        style={{ display: 'flex', alignItems: 'center', gap: 28 }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 84,
            padding: '0 38px',
            borderRadius: 999,
            background: c.white,
            color: c.night,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          Start free
        </span>
        <span style={{ fontSize: 28, fontWeight: 600, color: c.nightSub }}>{SITE}</span>
      </Box>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          style={{
            position: 'absolute',
            left: SW * n - 84 - 60,
            top: 92,
            width: 60,
            textAlign: 'right',
            fontSize: 24,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: n === 1 ? c.onBrandSub : n === 5 ? c.nightSub : c.muted,
          }}
        >
          {n}/5
        </div>
      ))}
    </>
  );
}

export function PanoSlide({ index, format }: { index: number; format: Format }) {
  return (
    <Frame format={format} tone="paper">
      <div
        style={{
          position: 'absolute',
          left: -index * 1080,
          top: 0,
          width: 1080 * PANO_SLIDES,
          height: 1350,
        }}
      >
        <Panorama />
      </div>
    </Frame>
  );
}
