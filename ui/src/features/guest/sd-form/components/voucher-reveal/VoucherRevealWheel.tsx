import { useEffect, useMemo, useRef } from 'react';

import { type Voucher } from '@/features/guest/sd-form/lib/voucher';
import { prefersReducedMotion } from '@/features/guest/sd-form/lib/voucherRevealMotion';

import { cn } from '@/lib/utils';

const WHEEL_SIZE_PX = 280;
const SPIN_ROUNDS = 5;
const SPIN_DURATION_MS = 7000;
const SETTLE_PAUSE_MS = 400;

const SEGMENT_FILLS = [
  '#10b981',
  '#0ea5e9',
  '#f59e0b',
  '#f43f5e',
  '#f97316',
  '#14b8a6',
  '#8b5cf6',
] as const;

export const WHEEL_SHELL_WIDTH_CLASS = 'mx-auto w-full max-w-sm';

function sortPool(pool: ReadonlyArray<Voucher>): Voucher[] {
  return [...pool].sort((a, b) => a.amount - b.amount || a.code.localeCompare(b.code));
}

function winnerIndex(segments: ReadonlyArray<Voucher>, winner: Voucher): number {
  const byCode = segments.findIndex((s) => s.code === winner.code);
  if (byCode >= 0) return byCode;
  const byAmount = segments.findIndex((s) => s.amount === winner.amount);
  return byAmount >= 0 ? byAmount : 0;
}

/** Degrees to rotate so segment `i` center lands under the top pointer. */
export function wheelTargetRotationDeg(segmentCount: number, index: number): number {
  if (segmentCount <= 0) return 0;
  const segmentAngle = 360 / segmentCount;
  const centerFromStart = index * segmentAngle + segmentAngle / 2;
  return SPIN_ROUNDS * 360 + (360 - centerFromStart);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArc, 0, end.x, end.y, 'Z'].join(
    ' '
  );
}

export function WheelPlaceholder({ prizePool }: { prizePool: ReadonlyArray<Voucher> }) {
  const segments = useMemo(() => sortPool(prizePool), [prizePool]);
  return (
    <div
      className={cn('relative mx-auto', WHEEL_SHELL_WIDTH_CLASS)}
      style={{ width: WHEEL_SIZE_PX }}
    >
      <WheelSvg segments={segments} muted />
      <Pointer />
    </div>
  );
}

export function VoucherRevealWheel({
  winner,
  prizePool,
  onSpinComplete,
}: {
  winner: Voucher;
  prizePool: ReadonlyArray<Voucher>;
  onSpinComplete: () => void;
}) {
  const segments = useMemo(() => sortPool(prizePool), [prizePool]);
  const index = winnerIndex(segments, winner);
  const wheelRef = useRef<HTMLDivElement>(null);
  const completeFired = useRef(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;

    completeFired.current = false;
    el.style.transform = 'rotate(0deg)';

    const reducedMotion = prefersReducedMotion();
    const single = segments.length <= 1;
    const target = single ? 0 : wheelTargetRotationDeg(segments.length, index);
    const duration =
      reducedMotion || single ? (single && !reducedMotion ? 600 : 1) : SPIN_DURATION_MS;

    const finish = () => {
      if (completeFired.current) return;
      completeFired.current = true;
      el.style.transform = `rotate(${target}deg)`;
      window.setTimeout(
        () => onSpinCompleteRef.current(),
        reducedMotion || single ? 0 : SETTLE_PAUSE_MS
      );
    };

    let animation: Animation | null = null;
    let raf1 = 0;
    let raf2 = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (single && !reducedMotion) {
          el.style.transition = `transform ${duration}ms ease-out`;
          el.style.transform = 'scale(1.04)';
          window.setTimeout(() => {
            el.style.transform = 'scale(1)';
            finish();
          }, duration);
          return;
        }
        animation = el.animate(
          reducedMotion
            ? [{ transform: `rotate(${target}deg)` }]
            : [{ transform: 'rotate(0deg)' }, { transform: `rotate(${target}deg)` }],
          {
            duration,
            easing: reducedMotion ? 'linear' : 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'forwards',
          }
        );
        animation.onfinish = finish;
      });
    });

    const fallback = window.setTimeout(finish, duration + SETTLE_PAUSE_MS + 400);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      animation?.cancel();
      window.clearTimeout(fallback);
      el.style.transition = '';
    };
  }, [index, segments.length]);

  return (
    <div
      className={cn('relative mx-auto', WHEEL_SHELL_WIDTH_CLASS)}
      style={{ width: WHEEL_SIZE_PX }}
      role="img"
      aria-label="Spinning prize wheel"
    >
      <div ref={wheelRef} className="will-change-transform">
        <WheelSvg segments={segments} />
      </div>
      <Pointer />
    </div>
  );
}

function Pointer() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-0.5"
      aria-hidden
    >
      <div className="border-t-primary border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent drop-shadow-sm" />
    </div>
  );
}

function WheelSvg({ segments, muted }: { segments: ReadonlyArray<Voucher>; muted?: boolean }) {
  const n = Math.max(1, segments.length);
  const segmentAngle = 360 / n;
  const cx = WHEEL_SIZE_PX / 2;
  const cy = WHEEL_SIZE_PX / 2;
  const r = WHEEL_SIZE_PX / 2 - 4;

  return (
    <svg
      width={WHEEL_SIZE_PX}
      height={WHEEL_SIZE_PX}
      viewBox={`0 0 ${WHEEL_SIZE_PX} ${WHEEL_SIZE_PX}`}
      className={cn(
        'border-primary/40 bg-card shadow-primary/10 rounded-full border-2 shadow-lg',
        muted && 'opacity-80'
      )}
    >
      {Array.from({ length: n }, (_, i) => {
        const start = i * segmentAngle;
        const end = (i + 1) * segmentAngle;
        const mid = start + segmentAngle / 2;
        const labelPos = polarToCartesian(cx, cy, r * 0.62, mid);
        const prize = segments[i];
        const label = prize ? (prize.amount >= 100 ? 'Free' : `${prize.amount}%`) : '-';
        return (
          <g key={prize?.code ?? i}>
            <path
              d={describeSlice(cx, cy, r, start, end)}
              fill={SEGMENT_FILLS[i % SEGMENT_FILLS.length]}
              opacity={muted ? 0.55 : 0.9}
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[11px] font-bold"
              style={{ fontSize: n > 6 ? 10 : 12 }}
            >
              {label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={28} className="fill-card stroke-primary/30" strokeWidth={2} />
    </svg>
  );
}
