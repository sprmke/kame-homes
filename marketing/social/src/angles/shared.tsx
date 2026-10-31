import type { CSSProperties, ReactNode } from 'react';

import { Phone } from '../device';
import { rise } from '../motion';
import { Box, SITE, useFrameCtx, Wordmark } from '../primitives';

/** Wordmark left, site (or custom) right, across the top margin. */
export function TopBar({ y, right }: { y?: number; right?: ReactNode }) {
  const { W, M, t } = useFrameCtx();
  return (
    <Box
      x={M}
      y={y ?? M}
      w={W - M * 2}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Wordmark />
      <span style={{ fontSize: 26, fontWeight: 600, color: t.sub, whiteSpace: 'nowrap' }}>
        {right ?? SITE}
      </span>
    </Box>
  );
}

/** A phone placed at design coordinates, scaled from its top-left, rising in once. */
export function PhoneAt({
  x,
  y,
  scale,
  screen,
  screenBg,
  frame,
  delay = 10,
  style,
}: {
  x: number;
  y: number;
  scale: number;
  screen: ReactNode;
  screenBg: string;
  frame: number;
  delay?: number;
  style?: CSSProperties;
}) {
  const { t } = useFrameCtx();
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        ...style,
      }}
    >
      <div style={rise(frame, delay, 180, 40)}>
        <Phone screen={screenBg} shadowOn={t.bg}>
          {screen}
        </Phone>
      </div>
    </div>
  );
}

/** Scale a fixed-size block from its top-left. */
export function Scaled({
  x,
  y,
  scale,
  children,
  style,
}: {
  x: number;
  y: number;
  scale: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
