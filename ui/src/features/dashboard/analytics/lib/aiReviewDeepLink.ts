/**
 * AI review items carry a deep link into one property page, picked server-side from the
 * `ANALYTICS_DEEP_LINK_ROUTES` allow-list (`_shared/analyticsAiReview.ts`). The CTA names that
 * page instead of saying "Go there", so the last path segment is turned back into its nav label
 * (`.../pricing` -> `Pricing`, `.../public-pages` -> `Public Pages`).
 *
 * Returns `null` for anything that is not a plain slug segment, so the caller can fall back
 * rather than render a label built from an unexpected path.
 */
export function analyticsDeepLinkPageLabel(deepLink: string | null | undefined): string | null {
  if (!deepLink) return null;
  const path = deepLink.split(/[?#]/)[0].replace(/\/+$/, '');
  const segment = path.split('/').pop();
  if (!segment || !/^[a-z][a-z0-9-]*$/.test(segment)) return null;
  return segment
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
