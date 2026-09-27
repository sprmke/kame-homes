import { SHOWCASE_PREVIEW_MOCK_MESSAGE } from '@/features/guest/marketing/showcase/lib/showcaseSectionMock';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Prefer auto — follows `data-showcase-surface` / palette ink. */
  variant?: 'default' | 'onDark' | 'auto';
};

/**
 * Preview-only badge. Uses palette CSS vars when available so it stays readable
 * on light and dark custom surfaces (never amber-900 on a dark page).
 */
export function ShowcasePreviewMockBanner({ className, variant = 'auto' }: Props) {
  const forceOnDark = variant === 'onDark';
  const forceOnLight = variant === 'default';

  return (
    <span
      role="status"
      className={cn(
        'showcase-mock-badge inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.12em]',
        forceOnDark && 'showcase-mock-badge--on-dark',
        forceOnLight && 'showcase-mock-badge--on-light',
        className
      )}
    >
      {SHOWCASE_PREVIEW_MOCK_MESSAGE}
    </span>
  );
}
