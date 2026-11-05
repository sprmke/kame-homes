import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

interface RevealProps {
  children: ReactNode;
  /** Stagger offset in seconds when several reveals sit in a row. */
  delay?: number;
  /** Travel distance in px; set 0 for a pure fade. */
  y?: number;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'section' | 'header';
}

/**
 * One in-view reveal shared across the redesigned `/for-hosts/v2` page so motion keeps a
 * single rhythm: ~0.5s ease-out, once, fully disabled under `prefers-reduced-motion`.
 */
export function Reveal({ children, delay = 0, y = 20, className, as = 'div' }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-72px' }}
      transition={{
        duration: reduceMotion ? 0 : 0.5,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}
