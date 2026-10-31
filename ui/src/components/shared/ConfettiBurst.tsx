import { useMemo } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

const CONFETTI_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

type Props = {
  /** Number of falling pieces. Default 28. */
  pieceCount?: number;
  /**
   * How far each piece travels before fading out, as a framer-motion `y` value.
   * Default `110vh` (full viewport). Use a smaller viewport unit (e.g. `70vh`)
   * when the burst is clipped to a shorter modal or card — percentages resolve
   * against the piece, not the container, so they don't work here.
   */
  fallDistance?: string;
  /** Extra classes on the absolutely-positioned overlay. */
  className?: string;
};

/**
 * Decorative confetti rain. Renders an absolutely-positioned, `pointer-events-none`
 * overlay that fills its nearest positioned ancestor, so callers own placement
 * (full-screen portal, modal, card). Pieces animate once on mount — re-mount to
 * replay. Respects `prefers-reduced-motion`.
 */
export function ConfettiBurst({ pieceCount = 28, fallDistance = '110vh', className }: Props) {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: pieceCount }, (_, id) => ({
        id,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
        delay: Math.random() * 0.35,
        duration: 1.8 + Math.random() * 1,
        drift: (Math.random() - 0.5) * 80,
        size: 6 + Math.random() * 5,
        rounded: id % 2 === 0,
      })),
    [pieceCount]
  );

  if (reduceMotion) return null;

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className={piece.rounded ? 'absolute rounded-full' : 'absolute rounded-[1px]'}
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            top: '-5%',
          }}
          initial={{ y: 0, x: 0, opacity: 0, rotate: 0 }}
          animate={{ y: fallDistance, x: piece.drift, opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
