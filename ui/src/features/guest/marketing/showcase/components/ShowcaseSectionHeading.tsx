import { ShowcasePreviewMockBanner } from '@/features/guest/marketing/showcase/components/ShowcasePreviewMockBanner';

import { cn } from '@/lib/utils';

type Props = {
  heading: string;
  headingClassName?: string;
  usesPreviewMock?: boolean;
  align?: 'start' | 'center';
  className?: string;
  badgeVariant?: 'default' | 'onDark';
};

/** Section title with optional preview mock badge inline. */
export function ShowcaseSectionHeading({
  heading,
  headingClassName,
  usesPreviewMock,
  align = 'start',
  className,
  badgeVariant = 'default',
}: Props) {
  const alignClass = align === 'center' ? 'justify-center text-center' : '';

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', alignClass, className)}>
      <h2 className={headingClassName}>{heading}</h2>
      {usesPreviewMock ? <ShowcasePreviewMockBanner variant={badgeVariant} /> : null}
    </div>
  );
}
