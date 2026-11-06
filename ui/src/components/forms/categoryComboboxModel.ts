/** Pure option logic for the creatable category combobox (unit-tested, no DOM). */

export function normalizeCategoryValue(value: string): string {
  return value.trim();
}

/** Suggestions matching the typed text. An empty query returns every suggestion. */
export function filterCategorySuggestions(suggestions: readonly string[], query: string): string[] {
  const needle = normalizeCategoryValue(query).toLowerCase();
  if (!needle) return [...suggestions];
  return suggestions.filter((item) => item.toLowerCase().includes(needle));
}

/**
 * Canonical suggestion for a typed value (case-insensitive), or null when the
 * text is a new custom category. Keeps presets in one casing so filters and
 * charts do not split "rent" and "Rent".
 */
export function resolveCategorySuggestion(
  suggestions: readonly string[],
  value: string
): string | null {
  const needle = normalizeCategoryValue(value).toLowerCase();
  if (!needle) return null;
  return suggestions.find((item) => item.toLowerCase() === needle) ?? null;
}

/** Whether the draft should offer a "Use …" row for a custom category. */
export function shouldOfferCustomCategory(suggestions: readonly string[], draft: string): boolean {
  const normalized = normalizeCategoryValue(draft);
  return normalized.length > 0 && resolveCategorySuggestion(suggestions, normalized) === null;
}

/** What the form should store for a typed draft: canonical preset casing or the trimmed text. */
export function resolveCategoryValue(suggestions: readonly string[], draft: string): string {
  const normalized = normalizeCategoryValue(draft);
  if (!normalized) return '';
  return resolveCategorySuggestion(suggestions, normalized) ?? normalized;
}
