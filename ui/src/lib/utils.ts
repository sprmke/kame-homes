import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Custom `text-*` typography tokens (see `index.css`) look like Tailwind
 * `text-color` / `text-size` utilities. Default `twMerge` treats them as the
 * same group and drops them when a real color class follows — e.g.
 * `cn('text-stat-value', 'text-emerald-600')` → `text-emerald-600` (no bold/size).
 *
 * Register them as `font-size` so they compose with color utilities.
 */
const TYPE_SCALE_TOKENS = [
  'text-display',
  'text-page-title',
  'text-admin-page-title',
  'text-admin-page-subtitle',
  'text-card-title',
  'text-page-subtitle',
  'text-section-title',
  'text-card-description',
  'text-ui',
  'text-toolbar',
  'text-stat-value',
  'text-list-amount',
  'text-data-primary',
  'text-table-amount',
  'text-data-secondary',
  'text-meta',
  'text-table-head',
  'text-caption',
  'text-overline',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [...TYPE_SCALE_TOKENS],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
