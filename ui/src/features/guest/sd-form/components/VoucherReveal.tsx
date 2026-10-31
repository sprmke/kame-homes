import { lazy, Suspense, useMemo, useState } from 'react';

import { Camera, Loader2, Sparkles } from 'lucide-react';

import { RevealedVoucherCard } from '@/features/guest/sd-form/components/voucher-reveal/RevealedVoucherCard';
import { VoucherIntroCopy } from '@/features/guest/sd-form/components/voucher-reveal/VoucherIntroCopy';
import { FlipPlaceholder } from '@/features/guest/sd-form/components/voucher-reveal/VoucherRevealFlip';
import {
  REEL_SHELL_WIDTH_CLASS,
  SlotReelPlaceholder,
  VoucherRevealReel,
} from '@/features/guest/sd-form/components/voucher-reveal/VoucherRevealReel';
import { WheelPlaceholder } from '@/features/guest/sd-form/components/voucher-reveal/VoucherRevealWheel';
import { voucherReelPool, type Voucher } from '@/features/guest/sd-form/lib/voucher';
import {
  DEFAULT_VOUCHER_REVEAL_STYLE,
  type VoucherRevealStyle,
} from '@/features/guest/sd-form/lib/voucherRevealStyle';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const VoucherRevealWheel = lazy(() =>
  import('@/features/guest/sd-form/components/voucher-reveal/VoucherRevealWheel').then((m) => ({
    default: m.VoucherRevealWheel,
  }))
);

const VoucherRevealFlip = lazy(() =>
  import('@/features/guest/sd-form/components/voucher-reveal/VoucherRevealFlip').then((m) => ({
    default: m.VoucherRevealFlip,
  }))
);

type Phase = 'intro' | 'rolling' | 'revealed';

interface VoucherRevealProps {
  /** Pre-existing voucher (returning guests skip the animation). */
  existingVoucher?: Voucher | null;
  isClaiming: boolean;
  /** Called when the guest taps "Claim it!". Should resolve with the awarded voucher. */
  onClaim: () => Promise<Voucher>;
  /** Called when the guest taps continue after the reveal. */
  onContinue: () => void;
  /** Primary action label after the won card (SD form vs guest-review). */
  continueLabel?: string;
  /** Shown on the revealed voucher card (`guest_submissions` MM-DD-YYYY or legacy ISO). */
  primaryGuestName: string;
  checkInDate: string;
  checkOutDate: string;
  /** Property prize pool for reel decoys / copy (defaults to platform %). */
  prizePool?: ReadonlyArray<Voucher>;
  /** Property reveal animation style. */
  style?: VoucherRevealStyle;
}

function claimingLabel(style: VoucherRevealStyle): string {
  switch (style) {
    case 'wheel':
      return 'Spinning the wheel…';
    case 'flip':
      return 'Flipping…';
    default:
      return 'Spinning the reel…';
  }
}

function rollingHint(style: VoucherRevealStyle): string {
  switch (style) {
    case 'wheel':
      return 'The wheel is spinning…';
    case 'flip':
      return 'Flipping your reward…';
    default:
      return 'The reel is spinning…';
  }
}

function IntroPlaceholder({
  style,
  prizePool,
}: {
  style: VoucherRevealStyle;
  prizePool: ReadonlyArray<Voucher>;
}) {
  if (style === 'wheel') return <WheelPlaceholder prizePool={prizePool} />;
  if (style === 'flip') return <FlipPlaceholder />;
  return <SlotReelPlaceholder prizePool={prizePool} />;
}

function RollingAnimation({
  style,
  winner,
  prizePool,
  onComplete,
}: {
  style: VoucherRevealStyle;
  winner: Voucher;
  prizePool: ReadonlyArray<Voucher>;
  onComplete: () => void;
}) {
  if (style === 'wheel') {
    return (
      <Suspense fallback={<WheelPlaceholder prizePool={prizePool} />}>
        <VoucherRevealWheel winner={winner} prizePool={prizePool} onSpinComplete={onComplete} />
      </Suspense>
    );
  }
  if (style === 'flip') {
    return (
      <Suspense fallback={<FlipPlaceholder />}>
        <VoucherRevealFlip winner={winner} onFlipComplete={onComplete} />
      </Suspense>
    );
  }
  return <VoucherRevealReel winner={winner} prizePool={prizePool} onSpinComplete={onComplete} />;
}

export function VoucherReveal({
  existingVoucher,
  isClaiming,
  onClaim,
  onContinue,
  continueLabel = 'Continue to refund process',
  primaryGuestName,
  checkInDate,
  checkOutDate,
  prizePool,
  style = DEFAULT_VOUCHER_REVEAL_STYLE,
}: VoucherRevealProps) {
  const revealStyle: VoucherRevealStyle = style === 'wheel' || style === 'flip' ? style : 'reel';
  const reelPool = useMemo(() => voucherReelPool(prizePool), [prizePool]);
  const [phase, setPhase] = useState<Phase>(existingVoucher ? 'revealed' : 'intro');
  const [winner, setWinner] = useState<Voucher | null>(existingVoucher ?? null);

  const handleClaim = async () => {
    try {
      const v = await onClaim();
      setWinner(v);
      setPhase('rolling');
    } catch {
      // Caller surfaces toast. Stay in intro so the guest can retry.
    }
  };

  if (phase === 'revealed' && winner) {
    return (
      <div className="space-y-5">
        <RevealedVoucherCard
          voucher={winner}
          guestName={primaryGuestName}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
        />

        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3">
          <Camera className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
          <p className="text-sm leading-relaxed text-amber-900">
            <span className="font-semibold">Screenshot your voucher code.</span> Show it on your
            next booking.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="shadow-primary/20 min-h-[48px] w-full shadow-md"
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'rolling' && winner) {
    return (
      <div className="space-y-5">
        <VoucherIntroCopy prizePool={reelPool} style={revealStyle} />
        <RollingAnimation
          style={revealStyle}
          winner={winner}
          prizePool={reelPool}
          onComplete={() => setPhase('revealed')}
        />
        <p className="text-primary text-center text-sm font-medium" aria-live="polite">
          {rollingHint(revealStyle)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <VoucherIntroCopy prizePool={reelPool} style={revealStyle} />
      <div className={cn('space-y-5', REEL_SHELL_WIDTH_CLASS)}>
        <IntroPlaceholder style={revealStyle} prizePool={reelPool} />
        <Button
          type="button"
          className="shadow-primary/25 min-h-[52px] w-full gap-2 text-base font-semibold shadow-lg"
          onClick={handleClaim}
          disabled={isClaiming}
        >
          {isClaiming ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              {claimingLabel(revealStyle)}
            </>
          ) : (
            <>
              <Sparkles className="size-5" aria-hidden />
              Claim it!
            </>
          )}
        </Button>
        <p className="text-muted-foreground text-center text-xs">One spin per booking only.</p>
      </div>
    </div>
  );
}
