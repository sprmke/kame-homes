import { useEffect, useRef, useState } from 'react';

import { Sparkles } from 'lucide-react';

import { formatVoucherPrizeLabel, type Voucher } from '@/features/guest/sd-form/lib/voucher';
import { prefersReducedMotion } from '@/features/guest/sd-form/lib/voucherRevealMotion';

import { cn } from '@/lib/utils';

const FLIP_DURATION_MS = 2000;
export const FLIP_SHELL_WIDTH_CLASS = 'mx-auto w-full max-w-sm';

export function FlipPlaceholder() {
  return (
    <div className={cn(FLIP_SHELL_WIDTH_CLASS)}>
      <div className="border-primary/30 from-primary/5 via-card to-card flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed bg-gradient-to-br">
        <p className="text-primary text-4xl font-extrabold">?</p>
      </div>
    </div>
  );
}

export function VoucherRevealFlip({
  winner,
  onFlipComplete,
}: {
  winner: Voucher;
  onFlipComplete: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const completeFired = useRef(false);
  const onFlipCompleteRef = useRef(onFlipComplete);
  onFlipCompleteRef.current = onFlipComplete;

  useEffect(() => {
    completeFired.current = false;
    const reducedMotion = prefersReducedMotion();

    const finish = () => {
      if (completeFired.current) return;
      completeFired.current = true;
      onFlipCompleteRef.current();
    };

    if (reducedMotion) {
      setFlipped(true);
      const t = window.setTimeout(finish, 1);
      return () => window.clearTimeout(t);
    }

    const flipAt = window.setTimeout(() => setFlipped(true), 120);
    const doneAt = window.setTimeout(finish, FLIP_DURATION_MS);

    return () => {
      window.clearTimeout(flipAt);
      window.clearTimeout(doneAt);
    };
  }, [winner.code]);

  return (
    <div
      className={cn(FLIP_SHELL_WIDTH_CLASS)}
      style={{ perspective: 1000 }}
      role="img"
      aria-label="Flipping voucher card"
    >
      <div
        className="relative min-h-[140px] w-full transition-transform duration-[1800ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          className="border-primary/40 from-primary/10 via-card to-card absolute inset-0 flex items-center justify-center rounded-xl border-2 bg-gradient-to-br shadow-lg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className="text-primary text-5xl font-extrabold">?</p>
        </div>
        <div
          className="border-primary/40 via-card to-primary/10 absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 bg-gradient-to-br from-emerald-200/20 p-4 shadow-lg"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <Sparkles className="text-primary size-5" aria-hidden />
          <p className="text-foreground font-mono text-xl font-extrabold tracking-wider">
            {winner.code}
          </p>
          <p className="text-primary text-sm font-bold tabular-nums">
            {formatVoucherPrizeLabel(winner)}
          </p>
        </div>
      </div>
    </div>
  );
}
