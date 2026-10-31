import { type RefObject } from 'react';

import { useTransform } from 'framer-motion';

import { useShowcaseScrollProgress } from '@/features/guest/marketing/showcase/templates/aurora/useShowcaseScrollProgress';
import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';

type MotionIntensity = PropertyShowcaseConfig['motion']['intensity'];
export type AuroraSectionParallaxLayer = 'intro' | 'content' | 'accent';

const LAYER_DEPTH: Record<AuroraSectionParallaxLayer, number> = {
  intro: 0.38,
  content: 0.62,
  accent: 0.92,
};

/** Scroll-linked, spring-smoothed parallax for Aurora sections below the hero. */
export function useAuroraSectionParallax(
  ref: RefObject<HTMLElement | null>,
  options: {
    enabled: boolean;
    intensity: MotionIntensity;
    contained: boolean;
    embed: boolean;
    layer: AuroraSectionParallaxLayer;
  }
) {
  const bold = options.intensity === 'bold';
  const depth = options.contained ? 0.72 : 1;
  const travel = (bold ? 72 : 52) * depth * LAYER_DEPTH[options.layer];

  const progress = useShowcaseScrollProgress(ref, {
    mode: 'section',
    embed: options.embed,
    contained: options.contained,
    enabled: options.enabled,
    spring: {
      stiffness: options.contained ? 128 : 84,
      damping: options.contained ? 26 : 19,
      mass: 0.44,
    },
  });

  const y = useTransform(progress, [0, 0.45, 1], [`${travel}px`, '0px', `-${travel}px`]);
  const opacity = useTransform(progress, [0, 0.1, 0.88, 1], [0.42, 1, 1, 0.55]);

  return {
    enabled: options.enabled,
    y,
    opacity,
  };
}
