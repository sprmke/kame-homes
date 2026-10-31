/**
 * Server-side mirror of ui/src/lib/cleaningBuffer.ts — minimum cleaning time
 * required between one guest's checkout and the next guest's check-in on a
 * same-day turnover. Required — at least 1 hour, always enforced. Kept in
 * sync per the forms skill's client/server validation rule.
 */

export const CLEANING_BUFFER_MIN_MINUTES = 60;
export const CLEANING_BUFFER_MAX_MINUTES = 360;
export const CLEANING_BUFFER_STEP_MINUTES = 30;

/** Applied when a property has no valid `cleaningBufferMinutes` saved yet. */
export const DEFAULT_CLEANING_BUFFER_MINUTES = CLEANING_BUFFER_MIN_MINUTES;

export function isValidCleaningBufferMinutes(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CLEANING_BUFFER_MIN_MINUTES &&
    value <= CLEANING_BUFFER_MAX_MINUTES &&
    (value - CLEANING_BUFFER_MIN_MINUTES) % CLEANING_BUFFER_STEP_MINUTES === 0
  );
}

/** Minutes from `prevTime` to `nextTime` (both 24h `HH:mm`); negative if `nextTime` is earlier. */
export function minutesBetweenTimes(prevTime: string, nextTime: string): number {
  const [ah, am] = prevTime.split(':').map(Number);
  const [bh, bm] = nextTime.split(':').map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return 0;
  return bh * 60 + bm - (ah * 60 + am);
}
