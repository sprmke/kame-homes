import { motion } from 'framer-motion';

import { SLIDING_PILL_SPRING, type SlidingPillBounds } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

type Props = {
  bounds: SlidingPillBounds;
  className?: string;
};

/** Match HeroSearch ActiveSegmentPill — animate left/top/width/height on absolute layer. */
export function SlidingActivePill({ bounds, className }: Props) {
  return (
    <motion.div
      aria-hidden
      className={cn('pointer-events-none absolute z-0', className)}
      style={{ position: 'absolute' }}
      initial={false}
      animate={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
      transition={SLIDING_PILL_SPRING}
    />
  );
}
