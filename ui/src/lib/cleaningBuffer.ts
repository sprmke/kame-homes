/**
 * Minimum cleaning time required between one guest's checkout and the next
 * guest's check-in on a same-day turnover. Required — at least 1 hour, always
 * enforced. Stored as `cleaningBufferMinutes` in `properties.settings`.
 */

export const CLEANING_BUFFER_MIN_MINUTES = 60;
export const CLEANING_BUFFER_MAX_MINUTES = 360;
export const CLEANING_BUFFER_STEP_MINUTES = 30;

/** Applied when a property has no valid `cleaningBufferMinutes` saved yet. */
export const DEFAULT_CLEANING_BUFFER_MINUTES = CLEANING_BUFFER_MIN_MINUTES;

export type CleaningBufferOption = {
  value: number;
  label: string;
};

function formatBufferLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hoursLabel = hours > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '';
  const minutesLabel = remainingMinutes > 0 ? `${remainingMinutes} minutes` : '';
  return [hoursLabel, minutesLabel].filter(Boolean).join(' ');
}

/** 1h–6h in 30-min steps. */
export const CLEANING_BUFFER_OPTIONS: CleaningBufferOption[] = Array.from(
  {
    length:
      (CLEANING_BUFFER_MAX_MINUTES - CLEANING_BUFFER_MIN_MINUTES) / CLEANING_BUFFER_STEP_MINUTES +
      1,
  },
  (_, i) => {
    const value = CLEANING_BUFFER_MIN_MINUTES + i * CLEANING_BUFFER_STEP_MINUTES;
    return { value, label: formatBufferLabel(value) };
  }
);

export function isValidCleaningBufferMinutes(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CLEANING_BUFFER_MIN_MINUTES &&
    value <= CLEANING_BUFFER_MAX_MINUTES &&
    (value - CLEANING_BUFFER_MIN_MINUTES) % CLEANING_BUFFER_STEP_MINUTES === 0
  );
}

/** Normalizes a raw settings value to a valid buffer, falling back to the 1-hour minimum. */
export function normalizeCleaningBufferMinutes(value: number | null | undefined): number {
  if (value == null || !isValidCleaningBufferMinutes(value)) return DEFAULT_CLEANING_BUFFER_MINUTES;
  return value;
}
