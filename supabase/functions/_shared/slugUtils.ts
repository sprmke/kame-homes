/** URL-friendly slug from display name. */
export function slugifyName(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 64) || 'item'
  );
}

/** Append numeric suffix when base slug is taken. */
export function withSlugSuffix(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const suffix = `-${attempt + 1}`;
  const maxBase = Math.max(1, 64 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}
