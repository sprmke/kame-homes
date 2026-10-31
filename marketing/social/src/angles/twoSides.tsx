import { Lines } from '../concepts';
import { PHONE_W } from '../device';
import { ReceiptCheckScreen } from '../features/bookingScreens';
import { GuestUploadScreen } from '../features/stayScreens';
import { reveal, SETTLED } from '../motion';
import { Box, Cta, Diamond, Frame, Sub, useFrameCtx, Wordmark } from '../primitives';
import { c, STORY_SAFE, type Format } from '../theme';
import { PhoneAt, TopBar } from './shared';

/**
 * 12 · Two sides. The same moment on two phones: the guest uploads a receipt, the host's
 * phone shows it matched to the booking. Product truth from both ends of the transaction.
 */

const GUEST_AT = 30;
const HOST_AT = 70;

function Tag({
  children,
  x,
  y,
  frame,
  delay,
}: {
  children: string;
  x: number;
  y: number;
  frame: number;
  delay: number;
}) {
  return (
    <Box x={x} y={y} style={reveal(frame, delay, 12)}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          height: 52,
          padding: '0 22px',
          borderRadius: 99,
          background: c.white,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: c.ink,
          whiteSpace: 'nowrap',
        }}
      >
        <Diamond size={12} color={c.brand} />
        {children}
      </span>
    </Box>
  );
}

function Phones({
  x,
  y,
  s,
  gap,
  frame,
}: {
  x: number;
  y: number;
  s: number;
  gap: number;
  frame: number;
}) {
  const w = PHONE_W * s;
  return (
    <>
      <Tag x={x} y={y - 72} frame={frame} delay={14}>
        Guest's phone
      </Tag>
      <Tag x={x + w + gap} y={y - 72} frame={frame} delay={20}>
        Your phone
      </Tag>
      <PhoneAt
        x={x}
        y={y}
        scale={s}
        frame={frame}
        delay={8}
        screenBg={c.white}
        screen={<GuestUploadScreen frame={frame} startAt={GUEST_AT} />}
      />
      <PhoneAt
        x={x + w + gap}
        y={y}
        scale={s}
        frame={frame}
        delay={16}
        screenBg={c.paper}
        screen={<ReceiptCheckScreen frame={frame} startAt={HOST_AT} />}
      />
    </>
  );
}

const SUB = 'The receipt is matched to the booking before you open the app.';

function TwoSidesBody({ frame }: { frame: number }) {
  const { kind, W, H, M } = useFrameCtx();
  const head = (size: number, lines = ['They upload.', 'Kame checks.']) => (
    <Lines lines={lines} accentFrom={1} size={size} frame={frame} delay={2} />
  );

  if (kind === 'vertical') {
    const top = STORY_SAFE.top;
    const s = 1.04;
    const gap = 40;
    return (
      <>
        <TopBar y={top} />
        <Box x={M} y={top + 110}>
          {head(132)}
        </Box>
        <Box x={M} y={top + 410} w={W - M * 2}>
          <Sub size={34} style={reveal(frame, 24)}>
            {SUB}
          </Sub>
        </Box>
        <Phones x={(W - (PHONE_W * s * 2 + gap)) / 2} y={top + 640} s={s} gap={gap} frame={frame} />
      </>
    );
  }
  if (kind === 'portrait') {
    const s = 0.95;
    const gap = 40;
    return (
      <>
        <TopBar />
        <Box x={M} y={170}>
          {head(108)}
        </Box>
        <Box x={M} y={420} w={W - M * 2}>
          <Sub size={30} style={reveal(frame, 24)}>
            {SUB}
          </Sub>
        </Box>
        <Phones x={(W - (PHONE_W * s * 2 + gap)) / 2} y={600} s={s} gap={gap} frame={frame} />
      </>
    );
  }
  if (kind === 'square') {
    const s = 0.88;
    const gap = 36;
    return (
      <>
        <Box x={M} y={M}>
          {head(84)}
        </Box>
        <Box
          x={W - M - 260}
          y={M + 18}
          w={260}
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <Wordmark />
        </Box>
        <Phones x={(W - (PHONE_W * s * 2 + gap)) / 2} y={350} s={s} gap={gap} frame={frame} />
      </>
    );
  }
  // landscape
  const s = Math.min(1.0, (H * 0.94) / 878);
  const gap = 40;
  const px = W - M - PHONE_W * s * 2 - gap + 20;
  const hsz = Math.round(120 * Math.min(1, H / 1080) ** 0.6);
  return (
    <>
      <Box x={M} y={Math.round((H - (hsz * 2 + 330)) / 2)}>
        {head(hsz)}
        <Sub size={30} style={{ marginTop: 36, maxWidth: 560, ...reveal(frame, 24) }}>
          {SUB}
        </Sub>
        <div
          style={{
            marginTop: 44,
            display: 'flex',
            gap: 34,
            alignItems: 'center',
            ...reveal(frame, 34),
          }}
        >
          <Cta />
          <Wordmark size={28} />
        </div>
      </Box>
      <Phones x={px} y={Math.round(H * 0.13)} s={s} gap={gap} frame={frame} />
    </>
  );
}

export function TwoSidesConcept({ format, frame = SETTLED }: { format: Format; frame?: number }) {
  return (
    <Frame format={format} tone="tint">
      <TwoSidesBody frame={frame} />
    </Frame>
  );
}

export const TWO_SIDES_VIDEO = HOST_AT + 140;
