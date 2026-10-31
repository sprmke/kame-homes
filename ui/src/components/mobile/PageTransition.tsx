import { useEffect, useState, type ReactNode } from 'react';

import { motion } from 'framer-motion';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  /** Remount key — typically `location.pathname`. */
  transitionKey: string;
  className?: string;
};

/**
 * Per-surface page transition (opacity + short slide).
 * Respects `usePrefersReducedMotion` — no animation when reduced motion is on.
 *
 * After enter settles, forces `transform: none` so Framer's leftover
 * `translateY(0)` does not create a containing block that breaks sticky chrome
 * (mobile brand hero switcher / actions).
 */
export function PageTransition({ children, transitionKey, className }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [clearTransform, setClearTransform] = useState(false);

  useEffect(() => {
    setClearTransform(false);
  }, [transitionKey]);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={transitionKey}
      className={cn(className)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => setClearTransform(true)}
      style={clearTransform ? { transform: 'none' } : undefined}
    >
      {children}
    </motion.div>
  );
}
