import { useEffect, useMemo, useRef } from 'react';

import {
  buildReelKeyframes,
  VOUCHER_REEL_CHIP_TONES,
} from '@/features/guest/sd-form/components/voucher-reveal/VoucherRevealReel';
import { usePrefersReducedMotion } from '@/features/guest/sd-form/lib/voucherRevealMotion';

import {
  DEFAULT_VOUCHER_REVEAL_STYLE,
  VOUCHER_REVEAL_STYLES,
  voucherRevealStyleLabel,
  type VoucherRevealStyle,
} from '@/features/dashboard/org/lib/voucherRevealStyle';

import { cn } from '@/lib/utils';

import './voucherRevealStylePreview.css';

/** Scaled-down mirror of guest `SlotReel` — same easing curve, longer strip. */
const PREVIEW_REEL_ROW_HEIGHT_PX = 28;
const PREVIEW_REEL_WINNING_INDEX = 15;
const PREVIEW_REEL_SPIN_MS = 6000;
const PREVIEW_REEL_SETTLE_MS = 400;

type PreviewReelRow = { code: string; label: string };

const PREVIEW_REEL_DECOYS: PreviewReelRow[] = [
  { code: 'OFF-5', label: '5% off' },
  { code: 'OFF-30', label: '30% off' },
  { code: 'OFF-15', label: '15% off' },
  { code: 'OFF-25', label: '25% off' },
  { code: 'OFF-10', label: '10% off' },
  { code: 'OFF-35', label: '35% off' },
  { code: 'OFF-20', label: '20% off' },
  { code: 'OFF-40', label: '40% off' },
  { code: 'OFF-50', label: '50% off' },
  { code: 'FREE-STAY', label: 'Free stay' },
  { code: 'OFF-45', label: '45% off' },
  { code: 'OFF-15', label: '15% off' },
  { code: 'OFF-20', label: '20% off' },
  { code: 'OFF-25', label: '25% off' },
  { code: 'OFF-10', label: '10% off' },
  { code: 'OFF-30', label: '30% off' },
  { code: 'OFF-5', label: '5% off' },
  { code: 'OFF-35', label: '35% off' },
];

function buildPreviewReelStrip(): PreviewReelRow[] {
  const strip = [...PREVIEW_REEL_DECOYS];
  strip[PREVIEW_REEL_WINNING_INDEX] = { code: 'OFF-10', label: '10% off' };
  if (PREVIEW_REEL_WINNING_INDEX >= 3) {
    strip[PREVIEW_REEL_WINNING_INDEX - 3] = { code: 'OFF-15', label: '15% off' };
    strip[PREVIEW_REEL_WINNING_INDEX - 2] = { code: 'OFF-20', label: '20% off' };
    strip[PREVIEW_REEL_WINNING_INDEX - 1] = { code: 'OFF-25', label: '25% off' };
  }
  return strip;
}

function ReelStylePreview({ paused }: { paused: boolean }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const strip = useMemo(() => buildPreviewReelStrip(), []);
  const offsetPx = PREVIEW_REEL_WINNING_INDEX * PREVIEW_REEL_ROW_HEIGHT_PX;
  const viewportHeight = PREVIEW_REEL_ROW_HEIGHT_PX * 3;

  useEffect(() => {
    const el = stripRef.current;
    if (!el || paused) return;

    let cancelled = false;
    let animation: Animation | null = null;
    let settleTimer = 0;
    let raf1 = 0;
    let raf2 = 0;

    const runSpin = () => {
      if (cancelled || !stripRef.current) return;
      const node = stripRef.current;
      node.style.transform = 'translate3d(0, 0, 0)';

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (cancelled) return;
          animation = node.animate(buildReelKeyframes(offsetPx), {
            duration: PREVIEW_REEL_SPIN_MS,
            easing: 'linear',
            fill: 'forwards',
          });
          animation.onfinish = () => {
            if (cancelled) return;
            node.style.transform = `translate3d(0, -${offsetPx}px, 0)`;
            settleTimer = window.setTimeout(runSpin, PREVIEW_REEL_SETTLE_MS);
          };
        });
      });
    };

    runSpin();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      animation?.cancel();
      window.clearTimeout(settleTimer);
    };
  }, [offsetPx, paused]);

  return (
    <div
      className="bg-muted/25 border-border/80 relative w-full overflow-hidden rounded-2xl border p-2 shadow-sm"
      aria-hidden
    >
      <div
        className="border-primary/25 bg-primary/[0.04] pointer-events-none absolute inset-x-1.5 top-1/2 z-20 -translate-y-1/2 rounded border"
        style={{ height: PREVIEW_REEL_ROW_HEIGHT_PX - 4 }}
      />
      <div
        className="border-primary/35 pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 border-b border-t"
        style={{ height: PREVIEW_REEL_ROW_HEIGHT_PX }}
      />
      <div className="from-muted/25 pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b to-transparent" />
      <div className="from-muted/25 pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t to-transparent" />
      <div className="relative overflow-hidden rounded-lg" style={{ height: viewportHeight }}>
        <div
          ref={stripRef}
          className="flex flex-col will-change-transform"
          style={paused ? { transform: `translate3d(0, -${offsetPx}px, 0)` } : undefined}
        >
          {strip.map((row, index) => (
            <div
              key={`${row.code}-${index}`}
              className="box-border flex w-full shrink-0 items-center px-0.5 py-0.5"
              style={{ height: PREVIEW_REEL_ROW_HEIGHT_PX }}
            >
              <div
                className={cn(
                  'flex h-full w-full items-center justify-between gap-1 overflow-hidden rounded-md border px-1.5',
                  VOUCHER_REEL_CHIP_TONES[index % VOUCHER_REEL_CHIP_TONES.length]
                )}
              >
                <span className="text-muted-foreground min-w-0 truncate font-mono text-[7px] font-semibold tracking-wide">
                  {row.code}
                </span>
                <span className="text-foreground shrink-0 text-[7px] font-bold tabular-nums">
                  {row.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const WHEEL_SEGMENT_COLORS = [
  'hsl(var(--primary))',
  'hsl(199 89% 48%)',
  'hsl(38 92% 50%)',
  'hsl(350 89% 60%)',
  'hsl(25 95% 53%)',
  'hsl(173 58% 39%)',
] as const;

function WheelStylePreview({ paused }: { paused: boolean }) {
  const segmentCount = WHEEL_SEGMENT_COLORS.length;
  const segmentAngle = 360 / segmentCount;

  return (
    <div
      className="border-border/60 bg-muted/40 flex h-20 w-full items-center justify-center rounded-lg border"
      aria-hidden
    >
      <div className="relative size-14">
        <div className="bg-foreground/80 absolute left-1/2 top-0 z-10 h-2 w-2 -translate-x-1/2 -translate-y-0.5 rotate-45 rounded-sm" />
        <svg
          viewBox="0 0 100 100"
          className={cn('size-14', !paused && 'voucher-preview-wheel-disc')}
          role="presentation"
        >
          {WHEEL_SEGMENT_COLORS.map((fill, index) => {
            const start = index * segmentAngle;
            const end = start + segmentAngle;
            const startRad = ((start - 90) * Math.PI) / 180;
            const endRad = ((end - 90) * Math.PI) / 180;
            const x1 = 50 + 50 * Math.cos(startRad);
            const y1 = 50 + 50 * Math.sin(startRad);
            const x2 = 50 + 50 * Math.cos(endRad);
            const y2 = 50 + 50 * Math.sin(endRad);
            const largeArc = segmentAngle > 180 ? 1 : 0;
            const d = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;
            return <path key={fill} d={d} fill={fill} />;
          })}
          <circle cx="50" cy="50" r="8" fill="hsl(var(--background))" />
        </svg>
      </div>
    </div>
  );
}

function FlipStylePreview({ paused }: { paused: boolean }) {
  return (
    <div
      className="border-border/60 bg-muted/40 flex h-20 w-full items-center justify-center rounded-lg border px-3"
      style={{ perspective: 420 }}
      aria-hidden
    >
      <div
        className={cn(
          'relative h-14 w-full max-w-[4.5rem]',
          !paused && 'voucher-preview-flip-inner'
        )}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className="border-primary/35 from-primary/10 via-card to-card absolute inset-0 flex items-center justify-center rounded-md border bg-gradient-to-br shadow-sm"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <span className="text-primary text-xl font-extrabold">?</span>
        </div>
        <div
          className="border-primary/35 from-primary/15 via-card to-primary/5 absolute inset-0 flex flex-col items-center justify-center rounded-md border bg-gradient-to-br shadow-sm"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <span className="text-foreground font-mono text-[10px] font-bold tracking-wider">
            OFF-10
          </span>
        </div>
      </div>
    </div>
  );
}

function VoucherRevealStylePreview({
  style,
  paused,
}: {
  style: VoucherRevealStyle;
  paused: boolean;
}) {
  switch (style) {
    case 'wheel':
      return <WheelStylePreview paused={paused} />;
    case 'flip':
      return <FlipStylePreview paused={paused} />;
    default:
      return <ReelStylePreview paused={paused} />;
  }
}

export function VoucherRevealStylePicker({
  value,
  disabled,
  onChange,
  onInteract,
}: {
  value: VoucherRevealStyle;
  disabled?: boolean;
  onChange: (style: VoucherRevealStyle) => void;
  onInteract?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div role="radiogroup" aria-label="Reveal style" className="grid grid-cols-3 gap-2">
      {VOUCHER_REVEAL_STYLES.map((option) => {
        const selected = value === option;
        const label = voucherRevealStyleLabel(option);
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={cn(
              'flex min-h-[44px] flex-col gap-2 rounded-xl border p-2 text-left transition-all duration-200',
              selected
                ? 'border-primary/50 bg-primary/5 shadow-soft ring-primary/25 ring-2'
                : 'border-border/70 bg-card hover:border-primary/25 hover:bg-muted/30'
            )}
            onClick={() => {
              if (selected || disabled) return;
              onInteract?.();
              onChange(option);
            }}
          >
            <VoucherRevealStylePreview style={option} paused={reducedMotion} />
            <span
              className={cn(
                'text-center text-xs font-semibold',
                selected ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { DEFAULT_VOUCHER_REVEAL_STYLE };
