import type { CSSProperties, ReactNode } from 'react';

import { BatteryFull, Signal, Wifi } from 'lucide-react';

import { Diamond } from './primitives';
import { c, FONT } from './theme';

/**
 * Phone drawn in CSS. Screen content is authored in iPhone points (393 × 852) and scaled,
 * so app UI keeps real mobile proportions at any phone size.
 */
export const SCREEN_W = 393;
export const SCREEN_H = 852;
const BEZEL = 13;
export const PHONE_W = SCREEN_W + BEZEL * 2; // 419
export const PHONE_H = SCREEN_H + BEZEL * 2; // 878

export function Phone({
  children,
  screen = c.white,
  shadowOn = c.paper,
  style,
}: {
  children: ReactNode;
  screen?: string;
  /** Background the phone sits on; the shadow is tinted from it, never pure black. */
  shadowOn?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H, ...style }}>
      {/* side buttons */}
      <span
        style={{
          position: 'absolute',
          left: -3,
          top: 170,
          width: 4,
          height: 58,
          borderRadius: 3,
          background: '#1b2321',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: -3,
          top: 245,
          width: 4,
          height: 58,
          borderRadius: 3,
          background: '#1b2321',
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: -3,
          top: 210,
          width: 4,
          height: 92,
          borderRadius: 3,
          background: '#1b2321',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 68,
          background: '#0d1312',
          boxShadow: `0 0 0 2px #2a3331 inset, 0 60px 90px -40px color-mix(in srgb, ${shadowOn} 30%, #08120f), 0 24px 40px -24px color-mix(in srgb, ${shadowOn} 20%, #08120f)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: BEZEL,
          top: BEZEL,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 55,
          overflow: 'hidden',
          background: screen,
          fontFamily: FONT,
        }}
      >
        {children}
        {/* dynamic island */}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: 11,
            width: 122,
            height: 36,
            marginLeft: -61,
            borderRadius: 20,
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}

export function StatusBar({ dark = false, time = '9:41' }: { dark?: boolean; time?: string }) {
  const col = dark ? c.white : c.ink;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 54,
        padding: '18px 30px 0 44px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        color: col,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.01em',
      }}
    >
      <span>{time}</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <Signal size={16} strokeWidth={2.6} />
        <Wifi size={16} strokeWidth={2.6} />
        <BatteryFull size={22} strokeWidth={2} />
      </span>
    </div>
  );
}

/** App icon: teal squircle with the diamond mark. */
export function AppIcon({ size = 38 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: c.brand,
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
      }}
    >
      <Diamond size={size * 0.36} color={c.white} />
    </span>
  );
}

/** iOS-style lock screen notification. */
export function Push({
  title,
  body,
  time = 'now',
  style,
}: {
  title: string;
  body: string;
  time?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 11,
        padding: '13px 14px',
        borderRadius: 22,
        background: 'hsl(150 10% 97% / 0.9)',
        color: c.ink,
        boxShadow: '0 1px 0 hsl(0 0% 100% / 0.6) inset',
        ...style,
      }}
    >
      <AppIcon size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.015em',
          }}
        >
          <span>{title}</span>
          <span style={{ fontWeight: 500, color: c.muted, fontSize: 13 }}>{time}</span>
        </div>
        <div
          style={{
            fontSize: 14.5,
            lineHeight: 1.3,
            marginTop: 2,
            letterSpacing: '-0.01em',
            color: c.inkSoft,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}
