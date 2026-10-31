import { z } from 'zod';

/**
 * Normalizes `<input type="number">` values for Zod.
 * Empty must not coerce to `0` on required fields (that would skip "required").
 */
function preprocessMoneyInput(value: unknown, emptyAs: 'undefined' | 'zero'): unknown {
  if (value === '' || value === null || value === undefined) {
    return emptyAs === 'zero' ? 0 : undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return emptyAs === 'zero' ? 0 : undefined;
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Required peso field: rejects empty/null, allows `0` (free bookings). */
export function requiredNonNegativeMoney(options: { requiredError: string; minError?: string }) {
  return z.preprocess(
    (v) => preprocessMoneyInput(v, 'undefined'),
    z
      .number({
        required_error: options.requiredError,
        invalid_type_error: 'Enter a valid amount',
      })
      .min(0, options.minError ?? 'Must be ≥ 0')
  );
}

/** Required peso field: rejects empty/null, `0`, and negatives. */
export function requiredPositiveMoney(options: { requiredError: string; positiveError?: string }) {
  return z.preprocess(
    (v) => preprocessMoneyInput(v, 'undefined'),
    z
      .number({
        required_error: options.requiredError,
        invalid_type_error: 'Enter a valid amount',
      })
      .positive(options.positiveError ?? 'Must be greater than 0')
  );
}

/** Optional peso field: empty input becomes `0`. */
export function optionalNonNegativeMoney() {
  return z.preprocess((v) => preprocessMoneyInput(v, 'zero'), z.number().min(0, 'Must be ≥ 0'));
}
