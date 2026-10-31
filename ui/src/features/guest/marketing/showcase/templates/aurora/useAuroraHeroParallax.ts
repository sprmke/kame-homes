import { type RefObject } from 'react';

import { useTransform } from 'framer-motion';

import { useShowcaseScrollProgress } from '@/features/guest/marketing/showcase/templates/aurora/useShowcaseScrollProgress';
import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';

type MotionIntensity = PropertyShowcaseConfig['motion']['intensity'];

/** Static overscale so Y drift never exposes hero edges — not animated on scroll. */
export const AURORA_HERO_IMAGE_OVERSCALE = 1.08;
export const AURORA_HERO_MESH_OVERSCALE = 1.04;

/** Spring-smoothed, multi-layer scroll parallax for Aurora hero (live + editor preview). */
export function useAuroraHeroParallax(
  ref: RefObject<HTMLElement | null>,
  options: {
    enabled: boolean;
    intensity: MotionIntensity;
    contained: boolean;
    embed: boolean;
  }
) {
  const bold = options.intensity === 'bold';
  const depth = options.contained ? 0.82 : 1;

  const progress = useShowcaseScrollProgress(ref, {
    mode: 'hero',
    embed: options.embed,
    contained: options.contained,
    enabled: options.enabled,
    spring: {
      stiffness: options.contained ? 140 : 96,
      damping: options.contained ? 24 : 18,
      mass: 0.42,
    },
  });

  // Background layers drift slower; foreground copy drifts faster — depth without zoom.
  const baseTravel = (bold ? 36 : 28) * depth;
  const imageTravel = baseTravel * 0.45;
  const meshTravel = baseTravel * 0.62;
  const glowTravel = baseTravel * 0.78;
  const contentTravel = baseTravel * 1.15;

  const imageY = useTransform(progress, [0, 1], ['0%', `${imageTravel}%`]);
  const meshY = useTransform(progress, [0, 1], ['0%', `${meshTravel}%`]);
  const glowY = useTransform(progress, [0, 1], ['0%', `${glowTravel}%`]);
  const contentY = useTransform(progress, [0, 1], ['0%', `${contentTravel}%`]);
  const contentOpacity = useTransform(progress, [0, 0.42, 0.92], [1, 0.92, 0.04]);
  const overlayLift = useTransform(progress, [0, 1], [0, bold ? 0.28 : 0.2]);
  const cueOpacity = useTransform(progress, [0, 0.22], [1, 0]);

  return {
    enabled: options.enabled,
    imageY,
    meshY,
    glowY,
    contentY,
    contentOpacity,
    overlayLift,
    cueOpacity,
  };
}
