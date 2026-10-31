/** Shared motion tokens for parking E2E surfaces (guest status, forms, host detail). */

export const PARKING_FLOW_EASE = [0.16, 1, 0.3, 1] as const;

export function parkingFlowTransition(reduceMotion: boolean | null, duration = 0.35) {
  return reduceMotion ? { duration: 0 } : { duration, ease: PARKING_FLOW_EASE };
}

export const parkingFlowFadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export const parkingFlowStep = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
};
