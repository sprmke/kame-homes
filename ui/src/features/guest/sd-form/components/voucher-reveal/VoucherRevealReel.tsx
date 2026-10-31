import { useEffect, useMemo, useRef } from 'react';

import { Percent, Ticket } from 'lucide-react';

import {
  formatVoucherDiscountMaxLabel,
  formatVoucherPrizeLabel,
  pickPreWinnerTeasers,
  type Voucher,
} from '@/features/guest/sd-form/lib/voucher';
import { prefersReducedMotion } from '@/features/guest/sd-form/lib/voucherRevealMotion';

import { cn } from '@/lib/utils';

const STRIP_LENGTH = 36;
const WINNING_INDEX = 30;
/** Viewport + each strip row height — must fit chip padding + text or adjacent rows clip. */
export const REEL_ROW_HEIGHT_PX = 112;
const REEL_CHIP_HEIGHT_PX = 96;
const REEL_DURATION_MS = 10000;
/** Brief beat after the reel lands before showing the won card. */
const REEL_SETTLE_PAUSE_MS = 500;

/** Shell width matches voucher chips so the frame does not span full page width. */
export const REEL_SHELL_WIDTH_CLASS = 'mx-auto w-full max-w-sm';

/** Alternating flat chip surfaces — exported for settings preview. */
export const VOUCHER_REEL_CHIP_TONES = [
  'bg-card border-border/70 shadow-sm',
  'bg-muted/40 border-border/60',
] as const;

/** WAAPI keyframes: quick blur, then crawl through the last few rows. Exported for settings preview. */
export function buildReelKeyframes(offsetPx: number): Keyframe[] {
  const y = (fraction: number) => `translate3d(0, ${-offsetPx * fraction}px, 0)`;

  return [
    { transform: y(0), offset: 0 },
    { transform: y(0.58), offset: 0.1 },
    { transform: y(0.8), offset: 0.2 },
    { transform: y(0.9), offset: 0.3 },
    { transform: y(0.933), offset: 0.38 },
    { transform: y(0.967), offset: 0.48 },
    { transform: y(0.983), offset: 0.58 },
    { transform: y(0.992), offset: 0.68 },
    { transform: y(0.997), offset: 0.8 },
    { transform: y(0.999), offset: 0.9 },
    { transform: y(1), offset: 1 },
  ];
}

function pseudoRandomVoucher(seed: number, pool: ReadonlyArray<Voucher>): Voucher {
  return pool[(seed * 7 + 3) % pool.length] ?? pool[0]!;
}

export function buildVoucherReelStrip(winner: Voucher, pool: ReadonlyArray<Voucher>): Voucher[] {
  const strip: Voucher[] = [];
  for (let i = 0; i < STRIP_LENGTH; i++) {
    strip.push(pseudoRandomVoucher(i + 1, pool));
  }
  if (WINNING_INDEX >= 3) {
    const [third, second, first] = pickPreWinnerTeasers(winner, pool);
    strip[WINNING_INDEX - 3] = third;
    strip[WINNING_INDEX - 2] = second;
    strip[WINNING_INDEX - 1] = first;
  }
  strip[WINNING_INDEX] = winner;
  return strip;
}

function ReelChip({ voucher, index }: { voucher: Voucher; index: number }) {
  const isFreeStay = voucher.amount >= 100 || voucher.code === 'FREE-STAY';

  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 sm:px-4',
        VOUCHER_REEL_CHIP_TONES[index % VOUCHER_REEL_CHIP_TONES.length]
      )}
      style={{ height: REEL_CHIP_HEIGHT_PX }}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-lg border',
          isFreeStay
            ? 'border-primary/25 bg-primary/10 text-primary'
            : 'border-border/70 bg-muted/50 text-muted-foreground'
        )}
        aria-hidden
      >
        {isFreeStay ? <Ticket className="size-4" /> : <Percent className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="text-muted-foreground min-w-0 truncate font-mono text-xs font-semibold tracking-wide sm:text-sm">
          {voucher.code}
        </span>
        <span className="text-foreground shrink-0 text-sm font-bold tabular-nums sm:text-base">
          {formatVoucherPrizeLabel(voucher)}
        </span>
      </div>
    </div>
  );
}

export function SlotReelPlaceholder({ prizePool }: { prizePool: ReadonlyArray<Voucher> }) {
  const hasFree = prizePool.some((v) => v.amount >= 100 || v.code === 'FREE-STAY');
  return (
    <div className="bg-muted/25 border-border/80 relative w-full overflow-hidden rounded-2xl border p-3 shadow-md">
      <div className="relative overflow-hidden rounded-xl" style={{ height: REEL_ROW_HEIGHT_PX }}>
        <div
          className="border-primary/25 bg-primary/[0.04] pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-lg border"
          style={{ height: REEL_CHIP_HEIGHT_PX }}
          aria-hidden
        />
        <div className="flex h-full items-center justify-center px-2">
          <div className="bg-card border-border/70 flex h-[96px] w-full items-center gap-3 rounded-xl border px-4 shadow-sm">
            <span className="border-border/70 bg-muted/50 text-muted-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-lg border">
              <Percent className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-foreground text-sm font-semibold sm:text-base">
                {formatVoucherDiscountMaxLabel(prizePool)}
              </p>
              {hasFree ? (
                <p className="text-primary text-xs font-semibold uppercase tracking-wide sm:text-sm">
                  or free stay
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoucherRevealReel({
  winner,
  prizePool,
  onSpinComplete,
}: {
  winner: Voucher;
  prizePool: ReadonlyArray<Voucher>;
  onSpinComplete: () => void;
}) {
  const strip = useMemo(() => buildVoucherReelStrip(winner, prizePool), [winner, prizePool]);

  return <SlotReel key={winner.code} strip={strip} onSpinComplete={onSpinComplete} />;
}

function SlotReel({ strip, onSpinComplete }: { strip: Voucher[]; onSpinComplete: () => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const completeFired = useRef(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const offsetPx = WINNING_INDEX * REEL_ROW_HEIGHT_PX;

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    completeFired.current = false;
    el.style.transform = 'translate3d(0, 0, 0)';

    const reducedMotion = prefersReducedMotion();
    const duration = reducedMotion ? 1 : REEL_DURATION_MS;

    const finish = () => {
      if (completeFired.current) return;
      completeFired.current = true;
      el.style.transform = `translate3d(0, -${offsetPx}px, 0)`;
      window.setTimeout(
        () => {
          onSpinCompleteRef.current();
        },
        reducedMotion ? 0 : REEL_SETTLE_PAUSE_MS
      );
    };

    let animation: Animation | null = null;
    let raf1 = 0;
    let raf2 = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        animation = el.animate(
          reducedMotion
            ? [{ transform: `translate3d(0, -${offsetPx}px, 0)` }]
            : buildReelKeyframes(offsetPx),
          {
            duration,
            easing: 'linear',
            fill: 'forwards',
          }
        );
        animation.onfinish = finish;
      });
    });

    const fallback = window.setTimeout(finish, duration + REEL_SETTLE_PAUSE_MS + 400);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      animation?.cancel();
      window.clearTimeout(fallback);
    };
  }, [offsetPx]);

  return (
    <div
      className={cn(
        'bg-muted/25 border-border/80 relative overflow-hidden rounded-2xl border p-3 shadow-md',
        REEL_SHELL_WIDTH_CLASS
      )}
      role="img"
      aria-label="Spinning voucher reel"
    >
      <div
        className="border-primary/25 bg-primary/[0.04] pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2 rounded-lg border"
        style={{ height: REEL_CHIP_HEIGHT_PX }}
        aria-hidden
      />
      <div
        className="border-primary/35 pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 border-b border-t"
        style={{ height: REEL_ROW_HEIGHT_PX }}
        aria-hidden
      />
      <div className="from-muted/25 pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b to-transparent" />
      <div className="from-muted/25 pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t to-transparent" />
      <div className="relative overflow-hidden rounded-xl" style={{ height: REEL_ROW_HEIGHT_PX }}>
        <div ref={stripRef} className="flex flex-col will-change-transform">
          {strip.map((v, i) => (
            <div
              key={`${v.code}-${i}`}
              className="box-border flex w-full shrink-0 items-center px-0.5 py-2"
              style={{ height: REEL_ROW_HEIGHT_PX }}
            >
              <ReelChip voucher={v} index={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
