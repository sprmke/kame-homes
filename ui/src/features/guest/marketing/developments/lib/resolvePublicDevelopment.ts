/** Public development a property or parking belongs to (from the detail API). */
export type ResolvedPublicDevelopment = {
  slug: string;
  name: string;
  locationLabel: string;
};

export function developmentDetailPath(slug: string): string {
  return `/developments/${encodeURIComponent(slug)}`;
}
