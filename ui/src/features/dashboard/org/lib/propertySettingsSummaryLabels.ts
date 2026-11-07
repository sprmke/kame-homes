/**
 * Settings summary rows ("28 amenities selected") tell a host nothing about
 * what is inside the card. Naming the first few items is far more scannable,
 * but amenity and house-rule labels vary a lot in width ("WiFi" vs
 * "Smart Lock/Keyless Entry"), so a fixed count truncates on phone. Collapse on
 * whichever limit is reached first: item count or character budget.
 */

/** Hard cap on named items in a summary row before the `+N` pill. */
export const SETTINGS_SUMMARY_MAX_ITEMS = 3;

/**
 * Soft character budget for the joined label line. Sized so three short
 * amenity names ("WiFi · Air Conditioning · TV") fit on one line at 375px next
 * to the `+N` pill and **Manage**, while longer house-rule labels such as
 * "Check-in: After 14:00 · Checkout: Before 12:00" wrap to a second line
 * instead of ellipsizing (an ellipsis next to `+N` double-signals overflow).
 */
export const SETTINGS_SUMMARY_MAX_CHARS = 48;

const LABEL_SEPARATOR = ' · ';

export type SettingsSummaryLabels = {
  /** Labels to render, in the host's saved order. */
  shown: string[];
  /** How many selected labels did not fit. */
  hiddenCount: number;
};

export function summarizeSettingsLabels(
  labels: readonly string[],
  options?: { maxItems?: number; maxChars?: number }
): SettingsSummaryLabels {
  const maxItems = Math.max(1, options?.maxItems ?? SETTINGS_SUMMARY_MAX_ITEMS);
  const maxChars = Math.max(1, options?.maxChars ?? SETTINGS_SUMMARY_MAX_CHARS);
  const candidates = labels.map((label) => label.trim()).filter(Boolean);

  const shown: string[] = [];
  let length = 0;

  for (const label of candidates) {
    if (shown.length >= maxItems) break;
    const nextLength =
      shown.length === 0 ? label.length : length + LABEL_SEPARATOR.length + label.length;
    // Always keep the first label, even when a single long name exceeds the budget.
    if (shown.length > 0 && nextLength > maxChars) break;
    shown.push(label);
    length = nextLength;
  }

  return { shown, hiddenCount: candidates.length - shown.length };
}
