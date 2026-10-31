export const ADMIN_PAGE_SIZES = [31, 50, 100] as const;

export const ADMIN_DEFAULT_PAGE_SIZE = ADMIN_PAGE_SIZES[0];

export type PageItem = number | 'ellipsis';

/** Coerce URL/page-size control values to an allowed admin list size. */
export function normalizeAdminPageLimit(value: number): number {
  return (ADMIN_PAGE_SIZES as readonly number[]).includes(value) ? value : ADMIN_DEFAULT_PAGE_SIZE;
}

/** Page number strip with ellipses (shared by bookings + finance lists). */
export function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: PageItem[] = [1];

  if (current > 3) items.push('ellipsis');

  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  for (let p = lo; p <= hi; p++) items.push(p);

  if (current < total - 2) items.push('ellipsis');

  items.push(total);
  return items;
}
