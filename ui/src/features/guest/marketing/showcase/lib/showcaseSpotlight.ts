import type { PropertyShowcaseConfig } from '@/features/guest/marketing/showcase/types/showcase';

/**
 * Monolith hero cursor spotlight — same gate as kinetic motion: OS reduced-motion
 * and Subtle intensity only (not embed / Page Editor preview).
 */
export function resolveShowcaseSpotlightEnabled(
  config: PropertyShowcaseConfig,
  reducedMotion: boolean
): boolean {
  if (reducedMotion) return false;
  return config.motion.intensity !== 'subtle';
}

export function spotlightPositionFromClientRect(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

export const MONOLITH_SPOTLIGHT_REST = { x: 50, y: 42 };
