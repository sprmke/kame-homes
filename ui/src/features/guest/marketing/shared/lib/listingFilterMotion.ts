import { useReducedMotion } from 'framer-motion';

/** Framer motion props that collapse to instant when the user prefers reduced motion. */
export function useListingFilterMotion() {
  const reduceMotion = useReducedMotion();

  return {
    reduceMotion: Boolean(reduceMotion),
    asideTransition: reduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' as const },
    asideInitial: reduceMotion ? false : { width: 0, opacity: 0 },
    asideAnimate: { width: 320, opacity: 1 },
    asideExit: reduceMotion ? undefined : { width: 0, opacity: 0 },
    sheetTransition: reduceMotion
      ? { duration: 0 }
      : { type: 'spring' as const, damping: 30, stiffness: 300 },
    sheetInitial: reduceMotion ? false : { y: '100%' },
    sheetAnimate: { y: 0 },
    sheetExit: reduceMotion ? undefined : { y: '100%' },
    fadeInitial: reduceMotion ? false : { opacity: 0 },
    fadeAnimate: { opacity: 1 },
    fadeExit: reduceMotion ? undefined : { opacity: 0 },
  };
}

export function useListingFilterMotionWidth(width: number) {
  const base = useListingFilterMotion();
  return {
    ...base,
    asideAnimate: { width, opacity: 1 },
  };
}
